/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export type CategoryType = 'expense' | 'income';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  iconName: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InsertCategory = Omit<Category, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>;
