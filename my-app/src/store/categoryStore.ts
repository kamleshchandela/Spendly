/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { create } from 'zustand';
import { Category, CategoryType, InsertCategory } from '../types/category.types';
import { CategoryRepository } from '../database/repositories/CategoryRepository';
import { getDatabase } from '../database/database';

interface CategoryState {
  categories: Category[];
  isLoading: boolean;
  loadCategories: (type?: CategoryType) => Promise<void>;
  addCategory: (data: InsertCategory) => Promise<Category>;
  updateCategory: (id: string, data: Partial<InsertCategory>) => Promise<Category>;
  archiveCategory: (id: string) => Promise<void>;
  getByType: (type: CategoryType) => Category[];
}

export const useCategoryStore = create<CategoryState>((set, get) => ({
  categories: [],
  isLoading: false,

  loadCategories: async (type) => {
    set({ isLoading: true });
    try {
      const db = await getDatabase();
      const repo = new CategoryRepository(db);
      const categories = await repo.getAll(type, false);
      set({ categories, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  addCategory: async (data) => {
    const db = await getDatabase();
    const repo = new CategoryRepository(db);
    const created = await repo.insert(data);
    await get().loadCategories();
    return created;
  },

  updateCategory: async (id, data) => {
    const db = await getDatabase();
    const repo = new CategoryRepository(db);
    const updated = await repo.update(id, data);
    await get().loadCategories();
    return updated;
  },

  archiveCategory: async (id) => {
    const db = await getDatabase();
    const repo = new CategoryRepository(db);
    await repo.archive(id);
    await get().loadCategories();
  },

  getByType: (type) => get().categories.filter((c) => c.type === type && !c.isArchived),
}));
