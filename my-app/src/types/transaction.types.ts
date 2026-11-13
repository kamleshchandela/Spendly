/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export type TransactionType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  type: TransactionType;
  amountMinor: number;
  currencyCode: string;
  categoryId: string | null;
  walletId: string;
  destinationWalletId: string | null;
  transferGroupId: string | null;
  title: string;
  note: string | null;
  transactionDate: string;
  recurringId: string | null;
  isDeleted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TransactionWithDetails extends Transaction {
  categoryName?: string;
  categoryColor?: string;
  categoryIcon?: string;
  walletName?: string;
  destinationWalletName?: string;
}

export interface TransactionFilters {
  type?: TransactionType | 'all';
  categoryIds?: string[];
  walletIds?: string[];
  startDate?: string;
  endDate?: string;
  minAmountMinor?: number;
  maxAmountMinor?: number;
  searchQuery?: string;
  sortBy?: 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc';
  limit?: number;
  offset?: number;
}

export type InsertTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted'>;
