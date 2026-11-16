/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { create } from 'zustand';
import { InsertWallet, Wallet } from '../types/wallet.types';
import { WalletRepository } from '../database/repositories/WalletRepository';
import { getDatabase } from '../database/database';

interface WalletState {
  wallets: Wallet[];
  balances: Record<string, number>;
  totalBalanceMinor: number;
  isLoading: boolean;
  loadWallets: () => Promise<void>;
  refreshBalances: () => Promise<void>;
  addWallet: (data: InsertWallet) => Promise<Wallet>;
  updateWallet: (id: string, data: Partial<InsertWallet>) => Promise<Wallet>;
  archiveWallet: (id: string) => Promise<void>;
  reorderWallet: (walletId: string, newOrder: number) => Promise<void>;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallets: [],
  balances: {},
  totalBalanceMinor: 0,
  isLoading: false,

  loadWallets: async () => {
    set({ isLoading: true });
    try {
      const db = await getDatabase();
      const repo = new WalletRepository(db);
      const wallets = await repo.getAll(false);
      const balances: Record<string, number> = {};
      let totalBalanceMinor = 0;

      for (const wallet of wallets) {
        const balance = await repo.getWalletBalance(wallet.id);
        balances[wallet.id] = balance;
        if (wallet.includeInTotal) {
          totalBalanceMinor += balance;
        }
      }

      set({ wallets, balances, totalBalanceMinor, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  refreshBalances: async () => {
    const db = await getDatabase();
    const repo = new WalletRepository(db);
    const { wallets } = get();
    const balances: Record<string, number> = {};
    let totalBalanceMinor = 0;

    for (const wallet of wallets) {
      const balance = await repo.getWalletBalance(wallet.id);
      balances[wallet.id] = balance;
      if (wallet.includeInTotal) {
        totalBalanceMinor += balance;
      }
    }

    set({ balances, totalBalanceMinor });
  },

  addWallet: async (data) => {
    const db = await getDatabase();
    const repo = new WalletRepository(db);
    const created = await repo.insert(data);
    await get().loadWallets();
    return created;
  },

  updateWallet: async (id, data) => {
    const db = await getDatabase();
    const repo = new WalletRepository(db);
    const updated = await repo.update(id, data);
    await get().loadWallets();
    return updated;
  },

  archiveWallet: async (id) => {
    const db = await getDatabase();
    const repo = new WalletRepository(db);
    await repo.archive(id);
    await get().loadWallets();
  },

  reorderWallet: async (walletId, newOrder) => {
    const db = await getDatabase();
    const repo = new WalletRepository(db);
    await repo.reorder(walletId, newOrder);
    await get().loadWallets();
  },
}));
