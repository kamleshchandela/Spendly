/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { generateId } from '../../utils/idUtils';
import { nowISO } from '../../utils/dateUtils';

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', iconName: 'utensils', color: '#E07878', type: 'expense' as const },
  { name: 'Groceries', iconName: 'shopping-cart', color: '#5BAF85', type: 'expense' as const },
  { name: 'Transport', iconName: 'car', color: '#7FB2D4', type: 'expense' as const },
  { name: 'Fuel', iconName: 'fuel', color: '#E8A44A', type: 'expense' as const },
  { name: 'Shopping', iconName: 'shopping-bag', color: '#9B8DD4', type: 'expense' as const },
  { name: 'Bills & Utilities', iconName: 'zap', color: '#E8A44A', type: 'expense' as const },
  { name: 'Rent & Housing', iconName: 'home', color: '#7FB2D4', type: 'expense' as const },
  { name: 'Health & Medical', iconName: 'heart-pulse', color: '#E07878', type: 'expense' as const },
  { name: 'Education', iconName: 'book-open', color: '#7FB2D4', type: 'expense' as const },
  { name: 'Entertainment', iconName: 'film', color: '#9B8DD4', type: 'expense' as const },
  { name: 'Travel', iconName: 'plane', color: '#59C0B4', type: 'expense' as const },
  { name: 'Personal Care', iconName: 'scissors', color: '#D47FAA', type: 'expense' as const },
  { name: 'Subscriptions', iconName: 'smartphone', color: '#9B8DD4', type: 'expense' as const },
  { name: 'Gifts & Donations', iconName: 'gift', color: '#D47FAA', type: 'expense' as const },
  { name: 'Other', iconName: 'package', color: '#A0A0A0', type: 'expense' as const },
];

export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary', iconName: 'briefcase', color: '#5BAF85', type: 'income' as const },
  { name: 'Business', iconName: 'building-2', color: '#5BAF85', type: 'income' as const },
  { name: 'Freelance', iconName: 'laptop', color: '#7FB2D4', type: 'income' as const },
  { name: 'Investment', iconName: 'trending-up', color: '#59C0B4', type: 'income' as const },
  { name: 'Gift', iconName: 'gift', color: '#D47FAA', type: 'income' as const },
  { name: 'Refund', iconName: 'repeat', color: '#E8A44A', type: 'income' as const },
  { name: 'Other', iconName: 'package', color: '#A0A0A0', type: 'income' as const },
];

export const buildDefaultCategoryRecords = () => {
  const now = nowISO();
  const all = [...DEFAULT_EXPENSE_CATEGORIES, ...DEFAULT_INCOME_CATEGORIES];
  return all.map((cat, index) => ({
    id: generateId(),
    name: cat.name,
    type: cat.type,
    iconName: cat.iconName,
    color: cat.color,
    isDefault: 1,
    sortOrder: index,
    isArchived: 0,
    createdAt: now,
    updatedAt: now,
  }));
};
