/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export interface AppSettings {
  baseCurrency: string; userName: string; dateFormat: string;
  numberFormat: 'indian' | 'international'; decimalPlaces: number;
  firstDayOfWeek: number; fiscalYearStart: number; accentColor: string;
  hideBalance: boolean; hapticEnabled: boolean; budgetWarningThreshold: number;
  recurringReminderDays: number; appLocked: boolean; backupEncrypt: boolean;
  onboardingCompleted: boolean; firstLaunchDate: string;
}
