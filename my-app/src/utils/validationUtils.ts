/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export const validateAmount = (amount: number): string | null => {
  if (!amount || amount <= 0) return 'Please enter an amount';
  if (amount > 999999999) return 'Amount seems too large. Please check.';
  return null;
};

export const validateRequired = (value: string, fieldName: string): string | null => {
  if (!value || value.trim().length === 0) return `${fieldName} cannot be empty`;
  return null;
};

export const validateBudgetDates = (startDate: string, endDate: string): string | null => {
  if (new Date(endDate) <= new Date(startDate)) return 'End date must be after start date';
  return null;
};
