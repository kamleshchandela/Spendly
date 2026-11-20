/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { BACKUP_VERSION } from '../../constants/config';
import { getDatabase } from '../../database/database';
import { BackupRepository } from '../../database/repositories/BackupRepository';
import { nowISO } from '../../utils/dateUtils';
import {
  decryptBackupString,
  EncryptedBackupEnvelope,
  isEncryptedBackup,
} from './BackupCrypto';
import { BackupValidator, ValidatedBackup } from './BackupValidator';
import {
  BackupTableName,
  ConflictAnalysisSummary,
  ConflictPolicy,
  ConflictResolver,
  resolveConflictAction,
  rowsAreIdentical,
  TABLE_META,
} from './ConflictResolver';

export type PickBackupResult =
  | { canceled: true }
  | { canceled: false; error: string }
  | {
      canceled: false;
      needsPassword: true;
      fileName: string;
      envelope: EncryptedBackupEnvelope;
    }
  | {
      canceled: false;
      needsPassword: false;
      fileName: string;
      backup: ValidatedBackup;
      analysis: ConflictAnalysisSummary;
    };

export interface ImportExecutionResult {
  inserted: number;
  skipped: number;
  conflictsResolved: number;
  failed: number;
}

// FK-safe insertion order: parents before children
const FK_INSERT_ORDER: BackupTableName[] = [
  'wallets',
  'categories',
  'budgets',
  'budget_categories',
  'recurring_payments',
  'transactions',
  'app_settings',
];

// FK-safe deletion order: children before parents
const FK_DELETE_ORDER: BackupTableName[] = [
  'budget_categories',
  'transactions',
  'recurring_payments',
  'budgets',
  'categories',
  'wallets',
  'app_settings',
];

const normalizeRowParams = (
  table: BackupTableName,
  row: Record<string, any>
): any[] => {
  const { columns } = TABLE_META[table];
  return columns.map((col) => {
    const val = row[col];
    if (val === undefined) return null;
    if (typeof val === 'boolean') return val ? 1 : 0;
    return val;
  });
};

const readPickedFileText = async (uri: string): Promise<string> => {
  try {
    const file = new File(uri);
    return await file.text();
  } catch {
    const response = await fetch(uri);
    return await response.text();
  }
};

export class ImportService {
  static async pickBackupFile(): Promise<PickBackupResult> {
    const picked = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      copyToCacheDirectory: true,
      multiple: false,
    });

    if (picked.canceled || !picked.assets || picked.assets.length === 0) {
      return { canceled: true };
    }

    const asset = picked.assets[0];
    const fileName = asset.name || 'backup.spendly';

    let rawText: string;
    try {
      rawText = await readPickedFileText(asset.uri);
    } catch {
      return { canceled: false, error: 'Unable to read the selected file.' };
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      return {
        canceled: false,
        error: 'This file is not a valid Spendly backup file.',
      };
    }

    if (isEncryptedBackup(parsed)) {
      return {
        canceled: false,
        needsPassword: true,
        fileName,
        envelope: parsed,
      };
    }

    const validation = await BackupValidator.validate(parsed);
    if (!validation.valid) {
      return { canceled: false, error: validation.error };
    }

    const db = await getDatabase();
    const analysis = await ConflictResolver.analyze(db, validation.backup.data);

    return {
      canceled: false,
      needsPassword: false,
      fileName,
      backup: validation.backup,
      analysis,
    };
  }

  static async decryptAndAnalyzeBackup(
    envelope: EncryptedBackupEnvelope,
    password: string
  ): Promise<{ backup: ValidatedBackup; analysis: ConflictAnalysisSummary }> {
    const plainText = await decryptBackupString(envelope, password.trim());

    let parsed: unknown;
    try {
      parsed = JSON.parse(plainText);
    } catch {
      throw new Error('This backup file appears to be corrupted.');
    }

    const validation = await BackupValidator.validate(parsed);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    const db = await getDatabase();
    const analysis = await ConflictResolver.analyze(db, validation.backup.data);
    return { backup: validation.backup, analysis };
  }

  static async executeMergeImport(
    backup: ValidatedBackup,
    policy: ConflictPolicy,
    fileName: string = 'Imported backup'
  ): Promise<ImportExecutionResult> {
    const db = await getDatabase();
    const backupRepo = new BackupRepository(db);

    let inserted = 0;
    let skipped = 0;
    let conflictsResolved = 0;
    const failed = 0;

    try {
      await db.withTransactionAsync(async () => {
        for (const table of FK_INSERT_ORDER) {
          const meta = TABLE_META[table];
          const importedRows = backup.data[table] ?? [];
          if (importedRows.length === 0) continue;

          const existingRows = await db.getAllAsync<Record<string, any>>(
            `SELECT * FROM ${table}`
          );
          const existingMap = new Map<string, Record<string, any>>();
          for (const row of existingRows) {
            existingMap.set(meta.getKey(row), row);
          }

          const cols = meta.columns;
          const placeholders = cols.map(() => '?').join(', ');
          const insertSql = `INSERT OR IGNORE INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;

          for (const imported of importedRows) {
            const key = meta.getKey(imported);
            const existing = existingMap.get(key);
            const params = normalizeRowParams(table, imported);

            if (!existing) {
              await db.runAsync(insertSql, params);
              existingMap.set(key, imported);
              inserted++;
            } else if (rowsAreIdentical(table, existing, imported)) {
              skipped++;
            } else {
              const action = resolveConflictAction(table, existing, imported, policy);
              if (action === 'replace') {
                if (table === 'app_settings') {
                  await db.runAsync(
                    `UPDATE app_settings SET setting_value = ?, updated_at = ? WHERE setting_key = ?`,
                    [
                      imported.setting_value ?? '',
                      imported.updated_at ?? nowISO(),
                      imported.setting_key,
                    ]
                  );
                } else if (table === 'budget_categories') {
                  await db.runAsync(insertSql, params);
                } else {
                  const updateCols = cols.filter((c) => c !== 'id');
                  const setClause = updateCols.map((c) => `${c} = ?`).join(', ');
                  const updateParams = updateCols.map((c) => {
                    const val = imported[c];
                    if (val === undefined) return null;
                    if (typeof val === 'boolean') return val ? 1 : 0;
                    return val;
                  });
                  updateParams.push(imported.id);
                  await db.runAsync(
                    `UPDATE ${table} SET ${setClause} WHERE id = ?`,
                    updateParams
                  );
                }
                existingMap.set(key, imported);
                conflictsResolved++;
              } else {
                skipped++;
              }
            }
          }
        }
      });

      await backupRepo.insert({
        backupDate: nowISO(),
        fileName,
        recordCount: inserted + conflictsResolved,
        backupVersion: backup.manifest.backupVersion || BACKUP_VERSION,
        status: 'success',
        note: `Merged (${inserted} added, ${conflictsResolved} updated, ${skipped} skipped)`,
      });

      return { inserted, skipped, conflictsResolved, failed };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Merge import failed';
      await backupRepo
        .insert({
          backupDate: nowISO(),
          fileName,
          recordCount: 0,
          backupVersion: backup.manifest.backupVersion || BACKUP_VERSION,
          status: 'failed',
          note: `Merge failed: ${msg}`,
        })
        .catch(() => {});
      throw error;
    }
  }

  static async executeRestoreReplace(
    backup: ValidatedBackup,
    fileName: string = 'Restored backup'
  ): Promise<ImportExecutionResult> {
    const db = await getDatabase();
    const backupRepo = new BackupRepository(db);

    let inserted = 0;

    try {
      await db.withTransactionAsync(async () => {
        for (const table of FK_DELETE_ORDER) {
          await db.runAsync(`DELETE FROM ${table}`);
        }

        for (const table of FK_INSERT_ORDER) {
          const meta = TABLE_META[table];
          const importedRows = backup.data[table] ?? [];
          if (importedRows.length === 0) continue;

          const cols = meta.columns;
          const placeholders = cols.map(() => '?').join(', ');
          const insertSql = `INSERT INTO ${table} (${cols.join(', ')}) VALUES (${placeholders})`;

          for (const imported of importedRows) {
            const params = normalizeRowParams(table, imported);
            await db.runAsync(insertSql, params);
            inserted++;
          }
        }

        // Preserve onboarding completion when restoring a backup that has wallets
        if ((backup.data.wallets?.length ?? 0) > 0) {
          await db.runAsync(
            `INSERT INTO app_settings (setting_key, setting_value, updated_at)
             VALUES ('onboarding_completed', 'true', ?)
             ON CONFLICT(setting_key) DO UPDATE SET setting_value = 'true', updated_at = excluded.updated_at`,
            [nowISO()]
          );
        }
      });

      await backupRepo.insert({
        backupDate: nowISO(),
        fileName,
        recordCount: inserted,
        backupVersion: backup.manifest.backupVersion || BACKUP_VERSION,
        status: 'success',
        note: `Full restore (${inserted} records replaced)`,
      });

      return { inserted, skipped: 0, conflictsResolved: 0, failed: 0 };
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Restore failed';
      await backupRepo
        .insert({
          backupDate: nowISO(),
          fileName,
          recordCount: 0,
          backupVersion: backup.manifest.backupVersion || BACKUP_VERSION,
          status: 'failed',
          note: `Restore failed: ${msg}`,
        })
        .catch(() => {});
      throw error;
    }
  }
}
