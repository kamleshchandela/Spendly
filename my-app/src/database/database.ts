/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export const getDatabase = async (): Promise<SQLite.SQLiteDatabase> => {
  if (!_db) {
    _db = await SQLite.openDatabaseAsync('finance.db');
    await _db.execAsync('PRAGMA journal_mode = WAL;');
    await _db.execAsync('PRAGMA foreign_keys = ON;');
  }
  return _db;
};
