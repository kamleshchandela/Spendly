/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export type WalletType = 'cash' | 'bank' | 'savings' | 'credit' | 'other';

export interface Wallet {
  id: string;
  name: string;
  type: WalletType;
  currencyCode: string;
  openingBalanceMinor: number;
  color: string;
  iconName: string;
  sortOrder: number;
  includeInTotal: boolean;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
}

export type InsertWallet = Omit<Wallet, 'id' | 'createdAt' | 'updatedAt' | 'sortOrder'>;
