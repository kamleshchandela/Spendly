/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import * as Crypto from 'expo-crypto';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { format } from 'date-fns';
import { APP_VERSION, BACKUP_VERSION, SCHEMA_VERSION } from '../../constants/config';
import { getDatabase } from '../../database/database';
import { BackupRepository } from '../../database/repositories/BackupRepository';
import { SettingsRepository } from '../../database/repositories/SettingsRepository';
import { nowISO } from '../../utils/dateUtils';
import { encryptBackupString } from './BackupCrypto';
import { BackupTableData, BackupValidator, RawBackupPayload } from './BackupValidator';

export interface ExportOptions {
  password?: string;
  share?: boolean;
}

export interface ExportResult {
  fileName: string;
  fileUri: string;
  totalRecords: number;
  encrypted: boolean;
  createdAt: string;
  recordCounts: Record<string, number>;
  shared: boolean;
}

export class ExportService {
  static async createAndShareBackup(options: ExportOptions = {}): Promise<ExportResult> {
    const db = await getDatabase();
    const backupRepo = new BackupRepository(db);
    const settingsRepo = new SettingsRepository(db);
    const createdAt = nowISO();
    const fileName = `Spendly_Backup_${format(new Date(), 'yyyy-MM-dd_HHmm')}.spendly`;

    try {
      const [
        wallets,
        categories,
        transactions,
        budgets,
        budget_categories,
        recurring_payments,
        app_settings,
      ] = await Promise.all([
        db.getAllAsync<Record<string, any>>('SELECT * FROM wallets'),
        db.getAllAsync<Record<string, any>>('SELECT * FROM categories'),
        db.getAllAsync<Record<string, any>>('SELECT * FROM transactions'),
        db.getAllAsync<Record<string, any>>('SELECT * FROM budgets'),
        db.getAllAsync<Record<string, any>>('SELECT * FROM budget_categories'),
        db.getAllAsync<Record<string, any>>('SELECT * FROM recurring_payments'),
        db.getAllAsync<Record<string, any>>('SELECT * FROM app_settings'),
      ]);

      const data: BackupTableData = {
        wallets,
        categories,
        transactions,
        budgets,
        budget_categories,
        recurring_payments,
        app_settings,
      };

      const recordCounts: Record<string, number> = {
        wallets: wallets.length,
        categories: categories.length,
        transactions: transactions.length,
        budgets: budgets.length,
        budget_categories: budget_categories.length,
        recurring_payments: recurring_payments.length,
        app_settings: app_settings.length,
      };

      const totalRecords =
        wallets.length +
        categories.length +
        transactions.length +
        budgets.length +
        recurring_payments.length;

      const checksum = await BackupValidator.computeChecksum(data);

      const firstLaunch = (await settingsRepo.getSetting('first_launch_date')) || 'spendly-local';
      const deviceHashFull = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        `spendly:${firstLaunch}`
      );
      const deviceIdHash = deviceHashFull.slice(0, 16);

      const payload: RawBackupPayload = {
        manifest: {
          app_name: 'Spendly',
          backup_version: BACKUP_VERSION,
          schema_version: SCHEMA_VERSION,
          app_version: APP_VERSION,
          created_at: createdAt,
          device_id_hash: deviceIdHash,
          record_counts: recordCounts,
          checksum,
        },
        data,
      };

      const plainJson = JSON.stringify(payload, null, 2);
      const useEncryption = Boolean(options.password && options.password.trim().length > 0);

      const fileContent = useEncryption
        ? JSON.stringify(await encryptBackupString(plainJson, options.password!.trim()), null, 2)
        : plainJson;

      const file = new File(Paths.cache, fileName);
      if (file.exists) {
        file.delete();
      }
      await file.write(fileContent);

      // Verify the written file parses cleanly before sharing
      const readBack = await file.text();
      const parsedBack = JSON.parse(readBack);
      if (!parsedBack || typeof parsedBack !== 'object') {
        throw new Error('Backup verification failed after writing file.');
      }

      let shared = false;
      const shouldShare = options.share !== false;
      if (shouldShare && (await Sharing.isAvailableAsync())) {
        await Sharing.shareAsync(file.uri, {
          mimeType: 'application/json',
          dialogTitle: 'Export Spendly Backup',
          UTI: 'public.json',
        });
        shared = true;
      }

      await backupRepo.insert({
        backupDate: createdAt,
        fileName,
        recordCount: totalRecords,
        backupVersion: BACKUP_VERSION,
        status: 'success',
        note: useEncryption ? 'Encrypted export' : 'Standard export',
      });

      return {
        fileName,
        fileUri: file.uri,
        totalRecords,
        encrypted: useEncryption,
        createdAt,
        recordCounts,
        shared,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      await backupRepo
        .insert({
          backupDate: createdAt,
          fileName,
          recordCount: 0,
          backupVersion: BACKUP_VERSION,
          status: 'failed',
          note: message,
        })
        .catch(() => {});
      throw error;
    }
  }
}
