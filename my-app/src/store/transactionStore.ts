/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { create } from 'zustand';
import {
  InsertTransaction,
  Transaction,
  TransactionFilters,
  TransactionWithDetails,
} from '../types/transaction.types';
import { TransactionRepository } from '../database/repositories/TransactionRepository';
import { getDatabase } from '../database/database';

interface TransactionState {
  transactions: TransactionWithDetails[];
  filters: TransactionFilters;
  isLoading: boolean;
  setFilters: (filters: TransactionFilters) => void;
  loadTransactions: (filters?: TransactionFilters) => Promise<void>;
  addTransaction: (data: InsertTransaction) => Promise<Transaction>;
  addTransfer: (
    debit: InsertTransaction,
    credit: InsertTransaction
  ) => Promise<[Transaction, Transaction]>;
  updateTransaction: (id: string, data: Partial<InsertTransaction>) => Promise<Transaction>;
  deleteTransaction: (id: string) => Promise<void>;
  restoreTransaction: (id: string) => Promise<void>;
}

export const useTransactionStore = create<TransactionState>((set, get) => ({
  transactions: [],
  filters: {},
  isLoading: false,

  setFilters: (filters) => set({ filters }),

  loadTransactions: async (filters) => {
    const activeFilters = filters ?? get().filters;
    if (filters !== undefined) {
      set({ filters });
    }
    set({ isLoading: true });
    try {
      const db = await getDatabase();
      const repo = new TransactionRepository(db);
      const transactions = await repo.getAll(activeFilters);
      set({ transactions, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  addTransaction: async (data) => {
    const db = await getDatabase();
    const repo = new TransactionRepository(db);
    const created = await repo.insert(data);
    await get().loadTransactions();
    return created;
  },

  addTransfer: async (debit, credit) => {
    const db = await getDatabase();
    const repo = new TransactionRepository(db);
    const created = await repo.insertTransfer(debit, credit);
    await get().loadTransactions();
    return created;
  },

  updateTransaction: async (id, data) => {
    const db = await getDatabase();
    const repo = new TransactionRepository(db);
    const updated = await repo.update(id, data);
    await get().loadTransactions();
    return updated;
  },

  deleteTransaction: async (id) => {
    const db = await getDatabase();
    const repo = new TransactionRepository(db);
    await repo.softDelete(id);
    await get().loadTransactions();
  },

  restoreTransaction: async (id) => {
    const db = await getDatabase();
    const repo = new TransactionRepository(db);
    await repo.restore(id);
    await get().loadTransactions();
  },
}));
