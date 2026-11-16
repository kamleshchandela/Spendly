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
  Budget,
  BudgetPeriodType,
  BudgetRecurrence,
  BudgetWithProgress,
  InsertBudget,
} from '../../types/budget.types';
import { generateId } from '../../utils/idUtils';
import { nowISO, getDaysRemaining } from '../../utils/dateUtils';

export class BudgetRepository {
  constructor(private db: SQLiteDatabase) {}

  private mapRow(row: any): Budget {
    return {
      id: row.id,
      name: row.name,
      amountMinor: row.amount_minor,
      currencyCode: row.currency_code,
      periodType: row.period_type as BudgetPeriodType,
      recurrence: row.recurrence as BudgetRecurrence,
      startDate: row.start_date,
      endDate: row.end_date,
      warningThreshold: row.warning_threshold,
      applyToAllCats: Boolean(row.apply_to_all_cats),
      isActive: Boolean(row.is_active),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAll(includeInactive: boolean = false): Promise<BudgetWithProgress[]> {
    const where = includeInactive ? '' : 'WHERE is_active = 1';
    const rows = await this.db.getAllAsync<any>(
      `SELECT id FROM budgets ${where} ORDER BY created_at DESC`
    );
    const results: BudgetWithProgress[] = [];
    for (const row of rows) {
      results.push(await this.calculateBudgetProgress(row.id));
    }
    return results;
  }

  async getById(id: string): Promise<BudgetWithProgress | null> {
    const row = await this.db.getFirstAsync<any>('SELECT id FROM budgets WHERE id = ?', [id]);
    if (!row) return null;
    return this.calculateBudgetProgress(id);
  }

  async calculateBudgetProgress(budgetId: string): Promise<BudgetWithProgress> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM budgets WHERE id = ?', [budgetId]);
    if (!row) throw new Error(`Budget not found: ${budgetId}`);
    const budget = this.mapRow(row);

    const catRows = await this.db.getAllAsync<{ category_id: string }>(
      'SELECT category_id FROM budget_categories WHERE budget_id = ?',
      [budgetId]
    );
    const categoryIds = catRows.map((r) => r.category_id);

    let usedRow: { used_minor: number | null } | null = null;
    if (budget.applyToAllCats) {
      usedRow = await this.db.getFirstAsync<{ used_minor: number | null }>(
        `SELECT COALESCE(SUM(t.amount_minor), 0) AS used_minor
         FROM transactions t
         WHERE t.is_deleted = 0
           AND t.type = 'expense'
           AND t.transaction_date >= ?
           AND t.transaction_date <= ?`,
        [budget.startDate, budget.endDate]
      );
    } else {
      usedRow = await this.db.getFirstAsync<{ used_minor: number | null }>(
        `SELECT COALESCE(SUM(t.amount_minor), 0) AS used_minor
         FROM transactions t
         INNER JOIN budget_categories bc ON bc.category_id = t.category_id
         WHERE bc.budget_id = ?
           AND t.is_deleted = 0
           AND t.type = 'expense'
           AND t.transaction_date >= ?
           AND t.transaction_date <= ?`,
        [budgetId, budget.startDate, budget.endDate]
      );
    }

    const usedMinor = usedRow?.used_minor ?? 0;
    const remainingMinor = budget.amountMinor - usedMinor;
    const percentage = budget.amountMinor > 0 ? (usedMinor / budget.amountMinor) * 100 : 0;
    const daysLeft = getDaysRemaining(budget.endDate);

    return {
      ...budget,
      usedMinor,
      remainingMinor,
      percentage,
      daysLeft,
      categoryIds,
    };
  }

  async insert(data: InsertBudget, categoryIds: string[] = []): Promise<BudgetWithProgress> {
    const id = generateId();
    const now = nowISO();

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO budgets (
          id, name, amount_minor, currency_code, period_type, recurrence,
          start_date, end_date, warning_threshold, apply_to_all_cats,
          is_active, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          id,
          data.name,
          data.amountMinor,
          data.currencyCode,
          data.periodType,
          data.recurrence,
          data.startDate,
          data.endDate,
          data.warningThreshold,
          data.applyToAllCats ? 1 : 0,
          data.isActive ? 1 : 0,
          now,
          now,
        ]
      );

      if (!data.applyToAllCats && categoryIds.length > 0) {
        for (const categoryId of categoryIds) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO budget_categories (budget_id, category_id) VALUES (?, ?)',
            [id, categoryId]
          );
        }
      }
    });

    return this.calculateBudgetProgress(id);
  }

  async update(
    id: string,
    data: Partial<InsertBudget>,
    categoryIds?: string[]
  ): Promise<BudgetWithProgress> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.amountMinor !== undefined) {
      fields.push('amount_minor = ?');
      params.push(data.amountMinor);
    }
    if (data.currencyCode !== undefined) {
      fields.push('currency_code = ?');
      params.push(data.currencyCode);
    }
    if (data.periodType !== undefined) {
      fields.push('period_type = ?');
      params.push(data.periodType);
    }
    if (data.recurrence !== undefined) {
      fields.push('recurrence = ?');
      params.push(data.recurrence);
    }
    if (data.startDate !== undefined) {
      fields.push('start_date = ?');
      params.push(data.startDate);
    }
    if (data.endDate !== undefined) {
      fields.push('end_date = ?');
      params.push(data.endDate);
    }
    if (data.warningThreshold !== undefined) {
      fields.push('warning_threshold = ?');
      params.push(data.warningThreshold);
    }
    if (data.applyToAllCats !== undefined) {
      fields.push('apply_to_all_cats = ?');
      params.push(data.applyToAllCats ? 1 : 0);
    }
    if (data.isActive !== undefined) {
      fields.push('is_active = ?');
      params.push(data.isActive ? 1 : 0);
    }

    fields.push('updated_at = ?');
    params.push(nowISO());
    params.push(id);

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(`UPDATE budgets SET ${fields.join(', ')} WHERE id = ?`, params);

      if (categoryIds !== undefined) {
        await this.db.runAsync('DELETE FROM budget_categories WHERE budget_id = ?', [id]);
        for (const categoryId of categoryIds) {
          await this.db.runAsync(
            'INSERT OR IGNORE INTO budget_categories (budget_id, category_id) VALUES (?, ?)',
            [id, categoryId]
          );
        }
      }
    });

    return this.calculateBudgetProgress(id);
  }

  async delete(id: string): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync('DELETE FROM budget_categories WHERE budget_id = ?', [id]);
      await this.db.runAsync('DELETE FROM budgets WHERE id = ?', [id]);
    });
  }
}
