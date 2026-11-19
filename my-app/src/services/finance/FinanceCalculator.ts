/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { getDatabase } from '../../database/database';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { BudgetRepository } from '../../database/repositories/BudgetRepository';
import { differenceInDays } from '../../utils/dateUtils';

export class FinanceCalculator {
  static async getWalletBalance(walletId: string): Promise<number> {
    const db = await getDatabase();
    const walletRepo = new WalletRepository(db);
    return walletRepo.getWalletBalance(walletId);
  }

  static async getTotalBalance(): Promise<number> {
    const db = await getDatabase();
    const walletRepo = new WalletRepository(db);
    return walletRepo.getTotal();
  }

  static async getBudgetUsed(budgetId: string): Promise<number> {
    const db = await getDatabase();
    const budgetRepo = new BudgetRepository(db);
    const progress = await budgetRepo.calculateBudgetProgress(budgetId);
    return progress.usedMinor;
  }

  static async getCategorySpending(
    categoryId: string,
    startDate: string,
    endDate: string
  ): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number | null }>(
      `SELECT COALESCE(SUM(amount_minor), 0) AS total
       FROM transactions
       WHERE is_deleted = 0
         AND type = 'expense'
         AND category_id = ?
         AND transaction_date >= ?
         AND transaction_date <= ?`,
      [categoryId, startDate, endDate]
    );
    return row?.total ?? 0;
  }

  static async getDailyAverage(startDate: string, endDate: string): Promise<number> {
    const db = await getDatabase();
    const row = await db.getFirstAsync<{ total: number | null }>(
      `SELECT COALESCE(SUM(amount_minor), 0) AS total
       FROM transactions
       WHERE is_deleted = 0
         AND type = 'expense'
         AND transaction_date >= ?
         AND transaction_date <= ?`,
      [startDate, endDate]
    );

    const totalExpense = row?.total ?? 0;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const now = new Date();
    const effectiveEnd = now < end ? now : end;
    const elapsedDays = Math.max(1, differenceInDays(effectiveEnd, start) + 1);
    return Math.round(totalExpense / elapsedDays);
  }

  static async getProjectedSpend(startDate: string, endDate: string): Promise<number> {
    const dailyAverage = await this.getDailyAverage(startDate, endDate);
    const start = new Date(startDate);
    const end = new Date(endDate);
    const totalDays = Math.max(1, differenceInDays(end, start) + 1);
    return Math.round(dailyAverage * totalDays);
  }
}
