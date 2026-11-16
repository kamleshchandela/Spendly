/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import {
  InsertRecurringPayment,
  RecurringFrequency,
  RecurringPayment,
} from '../../types/recurring.types';
import { generateId } from '../../utils/idUtils';
import { addDays, nowISO, toISO } from '../../utils/dateUtils';

export class RecurringRepository {
  constructor(private db: SQLiteDatabase) {}

  private mapRow(row: any): RecurringPayment {
    return {
      id: row.id,
      title: row.title,
      amountMinor: row.amount_minor,
      currencyCode: row.currency_code,
      categoryId: row.category_id,
      walletId: row.wallet_id,
      frequency: row.frequency as RecurringFrequency,
      frequencyDays: row.frequency_days ?? null,
      startDate: row.start_date,
      endDate: row.end_date ?? null,
      nextDueDate: row.next_due_date,
      reminderEnabled: Boolean(row.reminder_enabled),
      reminderDaysBefore: row.reminder_days_before,
      reminderTime: row.reminder_time ?? null,
      autoCreate: Boolean(row.auto_create),
      isActive: Boolean(row.is_active),
      note: row.note ?? null,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAll(includeInactive: boolean = true): Promise<RecurringPayment[]> {
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM recurring_payments ${where} ORDER BY next_due_date ASC`
    );
    return rows.map((row) => this.mapRow(row));
  }

  async getById(id: string): Promise<RecurringPayment | null> {
    const row = await this.db.getFirstAsync<any>(
      'SELECT * FROM recurring_payments WHERE id = ?',
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async getUpcoming(daysAhead: number = 7): Promise<RecurringPayment[]> {
    const cutoff = toISO(addDays(new Date(), daysAhead));
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM recurring_payments
       WHERE is_active = 1 AND next_due_date <= ?
       ORDER BY next_due_date ASC`,
      [cutoff]
    );
    return rows.map((row) => this.mapRow(row));
  }

  async insert(data: InsertRecurringPayment): Promise<RecurringPayment> {
    const id = generateId();
    const now = nowISO();

    await this.db.runAsync(
      `INSERT INTO recurring_payments (
        id, title, amount_minor, currency_code, category_id, wallet_id,
        frequency, frequency_days, start_date, end_date, next_due_date,
        reminder_enabled, reminder_days_before, reminder_time,
        auto_create, is_active, note, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.title,
        data.amountMinor,
        data.currencyCode,
        data.categoryId,
        data.walletId,
        data.frequency,
        data.frequencyDays,
        data.startDate,
        data.endDate,
        data.nextDueDate,
        data.reminderEnabled ? 1 : 0,
        data.reminderDaysBefore,
        data.reminderTime,
        data.autoCreate ? 1 : 0,
        data.isActive ? 1 : 0,
        data.note,
        now,
        now,
      ]
    );

    const created = await this.getById(id);
    if (!created) throw new Error('Failed to insert recurring payment');
    return created;
  }

  async update(id: string, data: Partial<InsertRecurringPayment>): Promise<RecurringPayment> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      params.push(data.title);
    }
    if (data.amountMinor !== undefined) {
      fields.push('amount_minor = ?');
      params.push(data.amountMinor);
    }
    if (data.currencyCode !== undefined) {
      fields.push('currency_code = ?');
      params.push(data.currencyCode);
    }
    if (data.categoryId !== undefined) {
      fields.push('category_id = ?');
      params.push(data.categoryId);
    }
    if (data.walletId !== undefined) {
      fields.push('wallet_id = ?');
      params.push(data.walletId);
    }
    if (data.frequency !== undefined) {
      fields.push('frequency = ?');
      params.push(data.frequency);
    }
    if (data.frequencyDays !== undefined) {
      fields.push('frequency_days = ?');
      params.push(data.frequencyDays);
    }
    if (data.startDate !== undefined) {
      fields.push('start_date = ?');
      params.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      fields.push('end_date = ?');
      params.push(data.endDate);
    }
    if (data.nextDueDate !== undefined) {
      fields.push('next_due_date = ?');
      params.push(data.nextDueDate);
    }
    if (data.reminderEnabled !== undefined) {
      fields.push('reminder_enabled = ?');
      params.push(data.reminderEnabled ? 1 : 0);
    }
    if (data.reminderDaysBefore !== undefined) {
      fields.push('reminder_days_before = ?');
      params.push(data.reminderDaysBefore);
    }
    if (data.reminderTime !== undefined) {
      fields.push('reminder_time = ?');
      params.push(data.reminderTime);
    }
    if (data.autoCreate !== undefined) {
      fields.push('auto_create = ?');
      params.push(data.autoCreate ? 1 : 0);
    }
    if (data.isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }
    if (data.note !== undefined) {
      fields.push('note = ?');
      params.push(data.note);
    }

    fields.push('updated_at = ?');
    params.push(nowISO());
    params.push(id);

    await this.db.runAsync(`UPDATE recurring_payments SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = await this.getById(id);
    if (!updated) throw new Error(`Recurring payment not found: ${id}`);
    return updated;
  }

  async updateNextDueDate(id: string, nextDate: string): Promise<void> {
    await this.db.runAsync(
      'UPDATE recurring_payments SET next_due_date = ?, updated_at = ? WHERE id = ?',
      [nextDate, nowISO(), id]
    );
  }

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    await this.db.runAsync(
      'UPDATE recurring_payments SET is_active = ?, updated_at = ? WHERE id = ?',
      [isActive ? 1 : 0, nowISO(), id]
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync('DELETE FROM recurring_payments WHERE id = ?', [id]);
  }
}
