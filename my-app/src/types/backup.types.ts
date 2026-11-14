/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export interface BackupManifest {
  appName: string; backupVersion: number; schemaVersion: number;
  appVersion: string; createdAt: string; deviceIdHash: string;
  recordCounts: Record<string, number>; checksum: string;
}
export interface BackupFile {
  manifest: BackupManifest;
  data: { wallets: any[]; transactions: any[]; categories: any[]; budgets: any[]; budgetCategories: any[]; recurringPayments: any[]; appSettings: any[]; };
}
export interface BackupHistory {
  id: string; backupDate: string; fileName: string; recordCount: number;
  backupVersion: number; status: 'success' | 'failed'; note: string | null; createdAt: string;
}
