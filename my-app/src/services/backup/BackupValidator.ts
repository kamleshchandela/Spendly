/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import * as Crypto from 'expo-crypto';
import { BACKUP_VERSION } from '../../constants/config';
import { BackupManifest } from '../../types/backup.types';

export interface RawBackupManifest {
  app_name: string;
  backup_version: number;
  schema_version: number;
  app_version: string;
  created_at: string;
  device_id_hash: string;
  record_counts: Record<string, number>;
  checksum: string;
}

export interface BackupTableData {
  wallets: Record<string, any>[];
  categories: Record<string, any>[];
  transactions: Record<string, any>[];
  budgets: Record<string, any>[];
  budget_categories: Record<string, any>[];
  recurring_payments: Record<string, any>[];
  app_settings: Record<string, any>[];
}

export interface RawBackupPayload {
  manifest: RawBackupManifest;
  data: BackupTableData;
}

export interface ValidatedBackup {
  manifest: BackupManifest;
  data: BackupTableData;
}

export type BackupValidationResult =
  | { valid: true; backup: ValidatedBackup }
  | { valid: false; error: string };

const readArray = (obj: Record<string, any>, snakeKey: string, camelKey: string): Record<string, any>[] | null => {
  const val = obj[snakeKey] ?? obj[camelKey];
  if (val === undefined) return [];
  if (!Array.isArray(val)) return null;
  return val;
};

export class BackupValidator {
  static async computeChecksum(data: unknown): Promise<string> {
    return Crypto.digestStringAsync(
      Crypto.CryptoDigestAlgorithm.SHA256,
      JSON.stringify(data)
    );
  }

  static async validate(parsed: unknown): Promise<BackupValidationResult> {
    if (!parsed || typeof parsed !== 'object') {
      return { valid: false, error: 'This file is not a valid Spendly backup.' };
    }

    const root = parsed as Record<string, any>;
    const rawManifest = root.manifest;
    const rawData = root.data;

    if (!rawManifest || typeof rawManifest !== 'object' || !rawData || typeof rawData !== 'object') {
      return { valid: false, error: 'This file is missing required Spendly backup structure.' };
    }

    const appName = rawManifest.app_name ?? rawManifest.appName;
    if (appName !== 'Spendly') {
      return { valid: false, error: 'This file is not a Spendly backup file.' };
    }

    const backupVersion = Number(rawManifest.backup_version ?? rawManifest.backupVersion);
    if (!Number.isFinite(backupVersion) || backupVersion < 1) {
      return { valid: false, error: 'This backup file has an invalid version header.' };
    }

    if (backupVersion > BACKUP_VERSION) {
      return {
        valid: false,
        error: 'This backup was created with a newer version of Spendly. Please update the app.',
      };
    }

    const checksum = rawManifest.checksum;
    if (typeof checksum !== 'string' || checksum.trim().length === 0) {
      return { valid: false, error: 'This backup file appears to be corrupted.' };
    }

    const computedChecksum = await this.computeChecksum(rawData);
    if (computedChecksum.toLowerCase() !== checksum.toLowerCase()) {
      return { valid: false, error: 'This backup file appears to be corrupted.' };
    }

    const wallets = readArray(rawData, 'wallets', 'wallets');
    const categories = readArray(rawData, 'categories', 'categories');
    const transactions = readArray(rawData, 'transactions', 'transactions');
    const budgets = readArray(rawData, 'budgets', 'budgets');
    const budgetCategories = readArray(rawData, 'budget_categories', 'budgetCategories');
    const recurringPayments = readArray(rawData, 'recurring_payments', 'recurringPayments');
    const appSettings = readArray(rawData, 'app_settings', 'appSettings');

    if (
      !wallets ||
      !categories ||
      !transactions ||
      !budgets ||
      !budgetCategories ||
      !recurringPayments ||
      !appSettings
    ) {
      return { valid: false, error: 'This backup file contains malformed table data.' };
    }

    const data: BackupTableData = {
      wallets,
      categories,
      transactions,
      budgets,
      budget_categories: budgetCategories,
      recurring_payments: recurringPayments,
      app_settings: appSettings,
    };

    const recordCounts: Record<string, number> = {
      wallets: wallets.length,
      categories: categories.length,
      transactions: transactions.length,
      budgets: budgets.length,
      budget_categories: budgetCategories.length,
      recurring_payments: recurringPayments.length,
      app_settings: appSettings.length,
    };

    const manifest: BackupManifest = {
      appName: String(appName),
      backupVersion,
      schemaVersion: Number(rawManifest.schema_version ?? rawManifest.schemaVersion ?? 1),
      appVersion: String(rawManifest.app_version ?? rawManifest.appVersion ?? '1.0.0'),
      createdAt: String(rawManifest.created_at ?? rawManifest.createdAt ?? ''),
      deviceIdHash: String(rawManifest.device_id_hash ?? rawManifest.deviceIdHash ?? ''),
      recordCounts: (rawManifest.record_counts ?? rawManifest.recordCounts ?? recordCounts) as Record<
        string,
        number
      >,
      checksum,
    };

    return {
      valid: true,
      backup: {
        manifest,
        data,
      },
    };
  }
}
