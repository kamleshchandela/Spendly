/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { BackupTableData } from './BackupValidator';

export type ConflictPolicy = 'keep_existing' | 'use_imported' | 'keep_newer' | 'skip_conflicts';

export type BackupTableName =
  | 'wallets'
  | 'categories'
  | 'transactions'
  | 'budgets'
  | 'budget_categories'
  | 'recurring_payments'
  | 'app_settings';

export interface TableConflictStats {
  table: BackupTableName;
  label: string;
  totalImported: number;
  newCount: number;
  identicalCount: number;
  conflictCount: number;
}

export interface ConflictAnalysisSummary {
  totalImported: number;
  newCount: number;
  identicalCount: number;
  conflictCount: number;
  byTable: Record<BackupTableName, TableConflictStats>;
}

interface TableSchemaMeta {
  label: string;
  columns: string[];
  getKey: (row: Record<string, any>) => string;
  hasUpdatedAt: boolean;
}

export const TABLE_META: Record<BackupTableName, TableSchemaMeta> = {
  wallets: {
    label: 'Wallets',
    columns: [
      'id',
      'name',
      'type',
      'currency_code',
      'opening_balance_minor',
      'color',
      'icon_name',
      'sort_order',
      'include_in_total',
      'is_archived',
      'created_at',
      'updated_at',
    ],
    getKey: (r) => String(r.id),
    hasUpdatedAt: true,
  },
  categories: {
    label: 'Categories',
    columns: [
      'id',
      'name',
      'type',
      'icon_name',
      'color',
      'is_default',
      'sort_order',
      'is_archived',
      'created_at',
      'updated_at',
    ],
    getKey: (r) => String(r.id),
    hasUpdatedAt: true,
  },
  transactions: {
    label: 'Transactions',
    columns: [
      'id',
      'type',
      'amount_minor',
      'currency_code',
      'category_id',
      'wallet_id',
      'destination_wallet_id',
      'transfer_group_id',
      'title',
      'note',
      'transaction_date',
      'recurring_id',
      'is_deleted',
      'created_at',
      'updated_at',
    ],
    getKey: (r) => String(r.id),
    hasUpdatedAt: true,
  },
  budgets: {
    label: 'Budgets',
    columns: [
      'id',
      'name',
      'amount_minor',
      'currency_code',
      'period_type',
      'recurrence',
      'start_date',
      'end_date',
      'warning_threshold',
      'apply_to_all_cats',
      'is_active',
      'created_at',
      'updated_at',
    ],
    getKey: (r) => String(r.id),
    hasUpdatedAt: true,
  },
  budget_categories: {
    label: 'Budget Links',
    columns: ['budget_id', 'category_id'],
    getKey: (r) => `${String(r.budget_id)}::${String(r.category_id)}`,
    hasUpdatedAt: false,
  },
  recurring_payments: {
    label: 'Recurring Payments',
    columns: [
      'id',
      'title',
      'amount_minor',
      'currency_code',
      'category_id',
      'wallet_id',
      'frequency',
      'frequency_days',
      'start_date',
      'end_date',
      'next_due_date',
      'reminder_enabled',
      'reminder_days_before',
      'reminder_time',
      'auto_create',
      'is_active',
      'note',
      'created_at',
      'updated_at',
    ],
    getKey: (r) => String(r.id),
    hasUpdatedAt: true,
  },
  app_settings: {
    label: 'Settings',
    columns: ['setting_key', 'setting_value', 'updated_at'],
    getKey: (r) => String(r.setting_key),
    hasUpdatedAt: true,
  },
};

export const ALL_BACKUP_TABLES: BackupTableName[] = [
  'wallets',
  'categories',
  'transactions',
  'budgets',
  'budget_categories',
  'recurring_payments',
  'app_settings',
];

const normalizeValue = (val: unknown): string => {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  return String(val);
};

export const rowsAreIdentical = (
  table: BackupTableName,
  existing: Record<string, any>,
  imported: Record<string, any>
): boolean => {
  const { columns } = TABLE_META[table];
  for (const col of columns) {
    if (normalizeValue(existing[col]) !== normalizeValue(imported[col])) {
      return false;
    }
  }
  return true;
};

export const resolveConflictAction = (
  table: BackupTableName,
  existing: Record<string, any>,
  imported: Record<string, any>,
  policy: ConflictPolicy
): 'replace' | 'skip' => {
  switch (policy) {
    case 'use_imported':
      return 'replace';
    case 'keep_existing':
    case 'skip_conflicts':
      return 'skip';
    case 'keep_newer': {
      if (!TABLE_META[table].hasUpdatedAt) return 'skip';
      const existingTs = existing.updated_at ? new Date(existing.updated_at).getTime() : 0;
      const importedTs = imported.updated_at ? new Date(imported.updated_at).getTime() : 0;
      return importedTs > existingTs ? 'replace' : 'skip';
    }
  }
};

export class ConflictResolver {
  static async analyze(
    db: SQLiteDatabase,
    backupData: BackupTableData
  ): Promise<ConflictAnalysisSummary> {
    const byTable = {} as Record<BackupTableName, TableConflictStats>;
    let totalImported = 0;
    let totalNew = 0;
    let totalIdentical = 0;
    let totalConflict = 0;

    for (const table of ALL_BACKUP_TABLES) {
      const meta = TABLE_META[table];
      const importedRows = backupData[table] ?? [];
      const existingRows = await db.getAllAsync<Record<string, any>>(`SELECT * FROM ${table}`);

      const existingMap = new Map<string, Record<string, any>>();
      for (const row of existingRows) {
        existingMap.set(meta.getKey(row), row);
      }

      let newCount = 0;
      let identicalCount = 0;
      let conflictCount = 0;

      for (const imported of importedRows) {
        const key = meta.getKey(imported);
        const existing = existingMap.get(key);
        if (!existing) {
          newCount++;
        } else if (rowsAreIdentical(table, existing, imported)) {
          identicalCount++;
        } else {
          conflictCount++;
        }
      }

      byTable[table] = {
        table,
        label: meta.label,
        totalImported: importedRows.length,
        newCount,
        identicalCount,
        conflictCount,
      };

      totalImported += importedRows.length;
      totalNew += newCount;
      totalIdentical += identicalCount;
      totalConflict += conflictCount;
    }

    return {
      totalImported,
      newCount: totalNew,
      identicalCount: totalIdentical,
      conflictCount: totalConflict,
      byTable,
    };
  }
}
