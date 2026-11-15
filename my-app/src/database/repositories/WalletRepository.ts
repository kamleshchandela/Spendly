/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import { InsertWallet, Wallet, WalletType } from '../../types/wallet.types';
import { generateId } from '../../utils/idUtils';
import { nowISO } from '../../utils/dateUtils';

export class WalletRepository {
  constructor(private db: SQLiteDatabase) {}

  mapRow(row: any): Wallet {
    return {
      id: row.id,
      name: row.name,
      type: row.type as WalletType,
      currencyCode: row.currency_code,
      openingBalanceMinor: row.opening_balance_minor,
      color: row.color,
      iconName: row.icon_name,
      sortOrder: row.sort_order,
      includeInTotal: Boolean(row.include_in_total),
      isArchived: Boolean(row.is_archived),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async getAll(includeArchived: boolean = false): Promise<Wallet[]> {
    const where = includeArchived ? '' : 'WHERE is_archived = 0';
    const rows = await this.db.getAllAsync<any>(
      `SELECT * FROM wallets ${where} ORDER BY sort_order ASC, created_at ASC`
    );
    return rows.map((row) => this.mapRow(row));
  }

  async getById(id: string): Promise<Wallet | null> {
    const row = await this.db.getFirstAsync<any>('SELECT * FROM wallets WHERE id = ?', [id]);
    return row ? this.mapRow(row) : null;
  }

  async getWalletBalance(walletId: string): Promise<number> {
    const wallet = await this.getById(walletId);
    if (!wallet) return 0;

    const row = await this.db.getFirstAsync<{
      income: number | null;
      expense: number | null;
      transfer_out: number | null;
      transfer_in: number | null;
    }>(
      `SELECT
        COALESCE(SUM(CASE WHEN type = 'income' AND wallet_id = ? THEN amount_minor ELSE 0 END), 0) AS income,
        COALESCE(SUM(CASE WHEN type = 'expense' AND wallet_id = ? THEN amount_minor ELSE 0 END), 0) AS expense,
        COALESCE(SUM(CASE WHEN type = 'transfer' AND wallet_id = ? AND destination_wallet_id IS NOT NULL THEN amount_minor ELSE 0 END), 0) AS transfer_out,
        COALESCE(SUM(CASE
          WHEN type = 'transfer' AND wallet_id = ? AND destination_wallet_id IS NULL AND transfer_group_id IS NOT NULL THEN amount_minor
          WHEN type = 'transfer' AND destination_wallet_id = ? AND transfer_group_id IS NULL THEN amount_minor
          ELSE 0
        END), 0) AS transfer_in
       FROM transactions
       WHERE is_deleted = 0 AND (wallet_id = ? OR destination_wallet_id = ?)`,
      [walletId, walletId, walletId, walletId, walletId, walletId, walletId]
    );

    const income = row?.income ?? 0;
    const expense = row?.expense ?? 0;
    const transferOut = row?.transfer_out ?? 0;
    const transferIn = row?.transfer_in ?? 0;

    return wallet.openingBalanceMinor + income - expense + transferIn - transferOut;
  }

  async getTotal(): Promise<number> {
    const wallets = await this.getAll(false);
    const included = wallets.filter((w) => w.includeInTotal);
    let total = 0;
    for (const wallet of included) {
      total += await this.getWalletBalance(wallet.id);
    }
    return total;
  }

  async insert(data: InsertWallet): Promise<Wallet> {
    const id = generateId();
    const now = nowISO();
    const maxOrderRow = await this.db.getFirstAsync<{ max_order: number | null }>(
      'SELECT MAX(sort_order) as max_order FROM wallets'
    );
    const sortOrder = (maxOrderRow?.max_order ?? -1) + 1;

    await this.db.runAsync(
      `INSERT INTO wallets (
        id, name, type, currency_code, opening_balance_minor,
        color, icon_name, sort_order, include_in_total, is_archived,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        data.name,
        data.type,
        data.currencyCode,
        data.openingBalanceMinor,
        data.color,
        data.iconName,
        sortOrder,
        data.includeInTotal ? 1 : 0,
        data.isArchived ? 1 : 0,
        now,
        now,
      ]
    );

    const created = await this.getById(id);
    if (!created) throw new Error('Failed to insert wallet');
    return created;
  }

  async update(id: string, data: Partial<InsertWallet>): Promise<Wallet> {
    const fields: string[] = [];
    const params: any[] = [];

    if (data.name !== undefined) {
      fields.push('name = ?');
      params.push(data.name);
    }
    if (data.type !== undefined) {
      fields.push('type = ?');
      params.push(data.type);
    }
    if (data.currencyCode !== undefined) {
      fields.push('currency_code = ?');
      params.push(data.currencyCode);
    }
    if (data.openingBalanceMinor !== undefined) {
      fields.push('opening_balance_minor = ?');
      params.push(data.openingBalanceMinor);
    }
    if (data.color !== undefined) {
      fields.push('color = ?');
      params.push(data.color);
    }
    if (data.iconName !== undefined) {
      fields.push('icon_name = ?');
      params.push(data.iconName);
    }
    if (data.includeInTotal !== undefined) {
      fields.push('include_in_total = ?');
      params.push(data.includeInTotal ? 1 : 0);
    }
    if (data.isArchived !== undefined) {
      fields.push('is_archived = ?');
      params.push(data.isArchived ? 1 : 0);
    }

    fields.push('updated_at = ?');
    params.push(nowISO());
    params.push(id);

    await this.db.runAsync(`UPDATE wallets SET ${fields.join(', ')} WHERE id = ?`, params);
    const updated = await this.getById(id);
    if (!updated) throw new Error(`Wallet not found: ${id}`);
    return updated;
  }

  async archive(id: string): Promise<void> {
    await this.db.runAsync('UPDATE wallets SET is_archived = 1, updated_at = ? WHERE id = ?', [
      nowISO(),
      id,
    ]);
  }

  async reorder(walletId: string, newOrder: number): Promise<void> {
    await this.db.runAsync('UPDATE wallets SET sort_order = ?, updated_at = ? WHERE id = ?', [
      newOrder,
      nowISO(),
      walletId,
    ]);
  }
}
