/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export * from './wallet.types';
export * from './transaction.types';
export * from './category.types';
export * from './budget.types';
export * from './recurring.types';
export * from './settings.types';
export * from './backup.types';

export type PeriodType = 'today' | 'week' | 'month' | 'year' | 'all';

export interface CategorySpending {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon?: string;
  amountMinor: number;
  percentage: number;
}
