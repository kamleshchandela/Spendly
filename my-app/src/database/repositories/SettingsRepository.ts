/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { getDefaultSettingsWithTimestamp } from '../seed/defaultSettings';
import { nowISO } from '../../utils/dateUtils';

export class SettingsRepository {
  constructor(private db: SQLiteDatabase) {}

  async getSetting(key: string): Promise<string | null> {
    const row = await this.db.getFirstAsync<{ setting_value: string }>(
      'SELECT setting_value FROM app_settings WHERE setting_key = ?',
      [key]
    );
    return row ? row.setting_value : null;
  }

  async setSetting(key: string, value: string): Promise<void> {
    const now = nowISO();
    await this.db.runAsync(
      `INSERT INTO app_settings (setting_key, setting_value, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(setting_key) DO UPDATE SET
         setting_value = excluded.setting_value,
         updated_at = excluded.updated_at`,
      [key, value, now]
    );
  }

  async getAllSettings(): Promise<Record<string, string>> {
    const rows = await this.db.getAllAsync<{ setting_key: string; setting_value: string }>(
      'SELECT setting_key, setting_value FROM app_settings'
    );
    const result: Record<string, string> = {};
    for (const row of rows) {
      result[row.setting_key] = row.setting_value;
    }
    return result;
  }

  async initializeDefaultSettings(): Promise<void> {
    const defaults = getDefaultSettingsWithTimestamp();
    await this.db.withTransactionAsync(async () => {
      for (const item of defaults) {
        await this.db.runAsync(
          `INSERT OR IGNORE INTO app_settings (setting_key, setting_value, updated_at)
           VALUES (?, ?, ?)`,
          [item.setting_key, item.setting_value, item.updated_at]
        );
      }
    });
  }
}
