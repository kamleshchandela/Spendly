/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { CREATE_TABLES_SQL, CREATE_INDEXES_SQL } from '../schema';
import { nowISO } from '../../utils/dateUtils';

export const runMigrations = async (db: SQLiteDatabase): Promise<void> => {
  await db.execAsync(CREATE_TABLES_SQL);
  await db.execAsync(CREATE_INDEXES_SQL);
  await db.runAsync(
    'INSERT OR IGNORE INTO schema_migrations (version, applied_at) VALUES (?, ?)',
    [1, nowISO()]
  );
};
