/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export type RecurringFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly' | 'custom';
export interface RecurringPayment {
  id: string; title: string; amountMinor: number; currencyCode: string;
  categoryId: string; walletId: string; frequency: RecurringFrequency;
  frequencyDays: number | null; startDate: string; endDate: string | null;
  nextDueDate: string; reminderEnabled: boolean; reminderDaysBefore: number;
  reminderTime: string | null; autoCreate: boolean; isActive: boolean;
  note: string | null; createdAt: string; updatedAt: string;
}
export type InsertRecurringPayment = Omit<RecurringPayment, 'id' | 'createdAt' | 'updatedAt'>;
