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
  InsertTransaction,
  Transaction,
  TransactionFilters,
  TransactionType,
  TransactionWithDetails,
} from '../../types/transaction.types';
import { generateId } from '../../utils/idUtils';
import { nowISO } from '../../utils/dateUtils';

export class TransactionRepository {
  constructor(private db: SQLiteDatabase) {}

  private mapRow(row: any): TransactionWithDetails {
    return {
      id: row.id,
      type: row.type as TransactionType,
      amountMinor: row.amount_minor,
      currencyCode: row.currency_code,
      categoryId: row.category_id ?? null,
      walletId: row.wallet_id,
      destinationWalletId: row.destination_wallet_id ?? null,
      transferGroupId: row.transfer_group_id ?? null,
      title: row.title,
      note: row.note ?? null,
      transactionDate: row.transaction_date,
      recurringId: row.recurring_id ?? null,
      isDeleted: Boolean(row.is_deleted),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      categoryName: row.category_name ?? undefined,
      categoryColor: row.category_color ?? undefined,
      categoryIcon: row.category_icon ?? undefined,
      walletName: row.wallet_name ?? undefined,
      destinationWalletName: row.destination_wallet_name ?? undefined,
    };
  }

  async getAll(filters?: TransactionFilters): Promise<TransactionWithDetails[]> {
    const conditions: string[] = ['t.is_deleted = 0'];
    const params: any[] = [];

    if (filters?.type && filters.type !== 'all') {
      conditions.push('t.type = ?');
      params.push(filters.type);
    }

    if (filters?.categoryIds && filters.categoryIds.length > 0) {
      const placeholders = filters.categoryIds.map(() => '?').join(', ');
      conditions.push(`t.category_id IN (${placeholders})`);
      params.push(...filters.categoryIds);
    }

    if (filters?.walletIds && filters.walletIds.length > 0) {
      const placeholders = filters.walletIds.map(() => '?').join(', ');
      conditions.push(`(t.wallet_id IN (${placeholders}) OR t.destination_wallet_id IN (${placeholders}))`);
      params.push(...filters.walletIds, ...filters.walletIds);
    }

    if (filters?.startDate) {
      conditions.push('t.transaction_date >= ?');
      params.push(filters.startDate);
    }

    if (filters?.endDate) {
      conditions.push('t.transaction_date <= ?');
      params.push(filters.endDate);
    }

    if (filters?.minAmountMinor !== undefined) {
      conditions.push('t.amount_minor >= ?');
      params.push(filters.minAmountMinor);
    }

    if (filters?.maxAmountMinor !== undefined) {
      conditions.push('t.amount_minor <= ?');
      params.push(filters.maxAmountMinor);
    }

    if (filters?.searchQuery && filters.searchQuery.trim().length > 0) {
      const query = `%${filters.searchQuery.trim()}%`;
      conditions.push('(t.title LIKE ? OR t.note LIKE ? OR c.name LIKE ? OR w.name LIKE ?)');
      params.push(query, query, query, query);
    }

    let orderBy = 't.transaction_date DESC, t.created_at DESC';
    switch (filters?.sortBy) {
      case 'date_asc':
        orderBy = 't.transaction_date ASC, t.created_at ASC';
        break;
      case 'amount_desc':
        orderBy = 't.amount_minor DESC, t.transaction_date DESC';
        break;
      case 'amount_asc':
        orderBy = 't.amount_minor ASC, t.transaction_date DESC';
        break;
      case 'date_desc':
      default:
        orderBy = 't.transaction_date DESC, t.created_at DESC';
        break;
    }

    let limitClause = '';
    if (filters?.limit !== undefined) {
      limitClause += ' LIMIT ?';
      params.push(filters.limit);
      if (filters?.offset !== undefined) {
        limitClause += ' OFFSET ?';
        params.push(filters.offset);
      }
    }

    const sql = `
      SELECT
        t.*,
        c.name AS category_name,
        c.color AS category_color,
        c.icon_name AS category_icon,
        w.name AS wallet_name,
        dw.name AS destination_wallet_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN wallets w ON w.id = t.wallet_id
      LEFT JOIN wallets dw ON dw.id = t.destination_wallet_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY ${orderBy}
      ${limitClause}
    `;

    const rows = await this.db.getAllAsync<any>(sql, params);
    return rows.map((row) => this.mapRow(row));
  }

  async getById(id: string): Promise<TransactionWithDetails | null> {
    const row = await this.db.getFirstAsync<any>(
      `SELECT
        t.*,
        c.name AS category_name,
        c.color AS category_color,
        c.icon_name AS category_icon,
        w.name AS wallet_name,
        dw.name AS destination_wallet_name
      FROM transactions t
      LEFT JOIN categories c ON c.id = t.category_id
      LEFT JOIN wallets w ON w.id = t.wallet_id
      LEFT JOIN wallets dw ON dw.id = t.destination_wallet_id
      WHERE t.id = ?`,
      [id]
    );
    return row ? this.mapRow(row) : null;
  }

  async insert(data: InsertTransaction): Promise<Transaction> {
    const id = generateId();
    const now = nowISO();

    await this.db.runAsync(
      `INSERT INTO transactions (
        id, type, amount_minor, currency_code, category_id, wallet_id,
        destination_wallet_id, transfer_group_id, title, note,
        transaction_date, recurring_id, is_deleted, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      [
        id,
        data.type,
        data.amountMinor,
        data.currencyCode,
        data.categoryId,
        data.walletId,
        data.destinationWalletId,
        data.transferGroupId,
        data.title,
        data.note,
        data.transactionDate,
        data.recurringId,
        now,
        now,
      ]
    );

    const created = await this.getById(id);
    if (!created) throw new Error('Failed to insert transaction');
    return created;
  }

  async update(id: string, data: Partial<InsertTransaction>): Promise<Transaction> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.type !== undefined) {
      fields.push('type = ?');
      params.push(data.type);
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
    if (data.destinationWalletId !== undefined) {
      fields.push('destination_wallet_id = ?');
      params.push(data.destinationWalletId);
    }
    if (data.transferGroupId !== undefined) {
      fields.push('transfer_group_id = ?');
      params.push(data.transferGroupId);
    }
    if (data.title !== undefined) {
      fields.push('title = ?');
      params.push(data.title);
    }
    if (data.note !== undefined) {
      fields.push('note = ?');
      params.push(data.note);
    }
    if (data.transactionDate !== undefined) {
      fields.push('transaction_date = ?');
      params.push(data.transactionDate);
    }
    if (data.recurringId !== undefined) {
      fields.push('recurring_id = ?');
      params.push(data.recurringId);
    }

    fields.push('updated_at = ?');
    params.push(nowISO());
    params.push(id);

    await this.db.runAsync(`UPDATE transactions SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = await this.getById(id);
    if (!updated) throw new Error(`Transaction not found: ${id}`);
    return updated;
  }

  async insertTransfer(
    debit: InsertTransaction,
    credit: InsertTransaction
  ): Promise<[Transaction, Transaction]> {
    const transferGroupId = debit.transferGroupId || credit.transferGroupId || generateId();
    const debitId = generateId();
    const creditId = generateId();
    const now = nowISO();

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `INSERT INTO transactions (
          id, type, amount_minor, currency_code, category_id, wallet_id,
          destination_wallet_id, transfer_group_id, title, note,
          transaction_date, recurring_id, is_deleted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          debitId,
          'transfer',
          debit.amountMinor,
          debit.currencyCode,
          debit.categoryId,
          debit.walletId,
          debit.destinationWalletId,
          transferGroupId,
          debit.title,
          debit.note,
          debit.transactionDate,
          debit.recurringId,
          now,
          now,
        ]
      );

      await this.db.runAsync(
        `INSERT INTO transactions (
          id, type, amount_minor, currency_code, category_id, wallet_id,
          destination_wallet_id, transfer_group_id, title, note,
          transaction_date, recurring_id, is_deleted, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          creditId,
          'transfer',
          credit.amountMinor,
          credit.currencyCode,
          credit.categoryId,
          credit.walletId,
          null,
          transferGroupId,
          credit.title,
          credit.note,
          credit.transactionDate,
          credit.recurringId,
          now,
          now,
        ]
      );
    });

    const createdDebit = await this.getById(debitId);
    const createdCredit = await this.getById(creditId);
    if (!createdDebit || !createdCredit) {
      throw new Error('Failed to insert transfer transactions');
    }
    return [createdDebit, createdCredit];
  }

  async softDelete(id: string): Promise<void> {
    const existing = await this.getById(id);
    const now = nowISO();
    if (existing?.transferGroupId) {
      await this.db.runAsync(
        'UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE transfer_group_id = ?',
        [now, existing.transferGroupId]
      );
    } else {
      await this.db.runAsync(
        'UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE id = ?',
        [now, id]
      );
    }
  }

  async restore(id: string): Promise<void> {
    const existing = await this.getById(id);
    const now = nowISO();
    if (existing?.transferGroupId) {
      await this.db.runAsync(
        'UPDATE transactions SET is_deleted = 0, updated_at = ? WHERE transfer_group_id = ?',
        [now, existing.transferGroupId]
      );
    } else {
      await this.db.runAsync(
        'UPDATE transactions SET is_deleted = 0, updated_at = ? WHERE id = ?',
        [now, id]
      );
    }
  }

  async getSummary(
    startDate: string,
    endDate: string
  ): Promise<{ incomeMinor: number; expenseMinor: number; netMinor: number }> {
    const row = await this.db.getFirstAsync<{
      income_minor: number | null;
      expense_minor: number | null;
    }>(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount_minor ELSE 0 END), 0) AS income_minor,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_minor ELSE 0 END), 0) AS expense_minor
       FROM transactions
       WHERE is_deleted = 0 AND transaction_date >= ? AND transaction_date <= ?`,
      [startDate, endDate]
    );

    const incomeMinor = row?.income_minor ?? 0;
    const expenseMinor = row?.expense_minor ?? 0;
    return {
      incomeMinor,
      expenseMinor,
      netMinor: incomeMinor - expenseMinor,
    };
  }

  async getCategorySpending(
    startDate: string,
    endDate: string
  ): Promise<
    Array<{
      categoryId: string;
      categoryName: string;
      categoryColor: string;
      categoryIcon: string;
      amountMinor: number;
      percentage: number;
    }>
  > {
    const rows = await this.db.getAllAsync<{
      category_id: string | null;
      category_name: string | null;
      category_color: string | null;
      category_icon: string | null;
      amount_minor: number;
    }>(
      `SELECT
        t.category_id,
        c.name AS category_name,
        c.color AS category_color,
        c.icon_name AS category_icon,
        SUM(t.amount_minor) AS amount_minor
       FROM transactions t
       LEFT JOIN categories c ON c.id = t.category_id
       WHERE t.is_deleted = 0
         AND t.type = 'expense'
         AND t.transaction_date >= ?
         AND t.transaction_date <= ?
       GROUP BY t.category_id
       ORDER BY amount_minor DESC`,
      [startDate, endDate]
    );

    const totalExpense = rows.reduce((acc, r) => acc + (r.amount_minor ?? 0), 0);

    return rows.map((row) => ({
      categoryId: row.category_id ?? 'uncategorized',
      categoryName: row.category_name ?? 'Uncategorized',
      categoryColor: row.category_color ?? '#A0A0A0',
      categoryIcon: row.category_icon ?? 'package',
      amountMinor: row.amount_minor ?? 0,
      percentage: totalExpense > 0 ? Math.round(((row.amount_minor ?? 0) / totalExpense) * 100) : 0,
    }));
  }
}
