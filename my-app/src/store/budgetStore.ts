/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { create } from 'zustand';
import { BudgetWithProgress, InsertBudget } from '../types/budget.types';
import { BudgetRepository } from '../database/repositories/BudgetRepository';
import { getDatabase } from '../database/database';

interface BudgetState {
  budgets: BudgetWithProgress[];
  isLoading: boolean;
  loadBudgets: (includeInactive?: boolean) => Promise<void>;
  addBudget: (data: InsertBudget, categoryIds?: string[]) => Promise<BudgetWithProgress>;
  updateBudget: (
    id: string,
    data: Partial<InsertBudget>,
    categoryIds?: string[]
  ) => Promise<BudgetWithProgress>;
  deleteBudget: (id: string) => Promise<void>;
}

export const useBudgetStore = create<BudgetState>((set, get) => ({
  budgets: [],
  isLoading: false,

  loadBudgets: async (includeInactive: boolean = false) => {
    set({ isLoading: true });
    try {
      const db = await getDatabase();
      const repo = new BudgetRepository(db);
      const budgets = await repo.getAll(includeInactive);
      set({ budgets, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  addBudget: async (data, categoryIds = []) => {
    const db = await getDatabase();
    const repo = new BudgetRepository(db);
    const created = await repo.insert(data, categoryIds);
    await get().loadBudgets();
    return created;
  },

  updateBudget: async (id, data, categoryIds) => {
    const db = await getDatabase();
    const repo = new BudgetRepository(db);
    const updated = await repo.update(id, data, categoryIds);
    await get().loadBudgets();
    return updated;
  },

  deleteBudget: async (id) => {
    const db = await getDatabase();
    const repo = new BudgetRepository(db);
    await repo.delete(id);
    await get().loadBudgets();
  },
}));
