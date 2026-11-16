/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { BackupHistory } from '../../types/backup.types';
import { generateId } from '../../utils/idUtils';
import { nowISO } from '../../utils/dateUtils';

export class BackupRepository {
  constructor(private db: SQLiteDatabase) {}

  private mapRow(row: any): BackupHistory {
    return {
      id: row.id,
      backupDate: row.backup_date,
      fileName: row.file_name,
      recordCount: row.record_count,
      backupVersion: row.backup_version,
      status: row.status as 'success' | 'failed',
      note: row.note ?? null,
      createdAt: row.created_at,
    };
  }

  async getAll(): Promise<BackupHistory[]> {
    const rows = await this.db.getAllAsync<any>(
      'SELECT * FROM backup_history ORDER BY backup_date DESC, created_at DESC'
    );
    return rows.map((row) => this.mapRow(row));
  }

  async insert(data: Omit<BackupHistory, 'id' | 'createdAt'>): Promise<BackupHistory> {
    const id = generateId();
    const now = nowISO();

    await this.db.runAsync(
      `INSERT INTO backup_history (
        id, backup_date, file_name, record_count, backup_version, status, note, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.backupDate,
        data.fileName,
        data.recordCount,
        data.backupVersion,
        data.status,
        data.note,
        now,
      ]
    );

    const row = await this.db.getFirstAsync<any>('SELECT * FROM backup_history WHERE id = ?', [id]);
    if (!row) throw new Error('Failed to insert backup history');
    return this.mapRow(row);
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM backup_history WHERE id = ?', [id]);
  }
}
