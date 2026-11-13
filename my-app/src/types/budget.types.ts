/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export type BudgetPeriodType = 'weekly' | 'monthly' | 'yearly' | 'custom';
export type BudgetRecurrence = 'once' | 'recurring';
export interface Budget {
  id: string; name: string; amountMinor: number; currencyCode: string;
  periodType: BudgetPeriodType; recurrence: BudgetRecurrence;
  startDate: string; endDate: string; warningThreshold: number;
  applyToAllCats: boolean; isActive: boolean; createdAt: string; updatedAt: string;
}
export interface BudgetWithProgress extends Budget {
  usedMinor: number; remainingMinor: number; percentage: number;
  daysLeft: number; categoryIds: string[];
}
export type InsertBudget = Omit<Budget, 'id' | 'createdAt' | 'updatedAt'>;
