/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { format } from 'date-fns';
import { getDatabase } from '../../database/database';
import { SettingsRepository } from '../../database/repositories/SettingsRepository';
import { NotificationService } from './NotificationService';

type NotifiedLevel = 'none' | 'warning' | 'exceeded';

const inMemoryNotified = new Map<string, NotifiedLevel>();

const getPeriodKey = (budgetId: string): string => {
  const monthTag = format(new Date(), 'yyyy-MM');
  return `budget_notif_${budgetId}_${monthTag}`;
};

export class BudgetNotifier {
  static async checkAndNotify(
    budgetId: string,
    currentPercentage: number,
    budgetName: string,
    warningThresholdOverride?: number
  ): Promise<void> {
    try {
      const db = await getDatabase();
      const settingsRepo = new SettingsRepository(db);

      const warningsEnabled = await settingsRepo.getSetting('budget_warnings_enabled');
      if (warningsEnabled === 'false') {
        return;
      }

      const rawThreshold = await settingsRepo.getSetting('budget_warning_threshold');
      const threshold =
        warningThresholdOverride ??
        (rawThreshold ? Math.max(10, Math.min(100, parseInt(rawThreshold, 10) || 80)) : 80);

      const periodKey = getPeriodKey(budgetId);
      let lastLevel: NotifiedLevel =
        inMemoryNotified.get(periodKey) ??
        ((await settingsRepo.getSetting(periodKey)) as NotifiedLevel | null) ??
        'none';

      // If spending dropped back below threshold (e.g. transaction deleted), reset state
      if (currentPercentage < threshold) {
        if (lastLevel !== 'none') {
          inMemoryNotified.set(periodKey, 'none');
          await settingsRepo.setSetting(periodKey, 'none');
        }
        return;
      }

      if (currentPercentage >= 100 && lastLevel !== 'exceeded') {
        await NotificationService.scheduleLocalNotification(
          `Budget Exceeded: ${budgetName}`,
          `You have reached ${Math.round(currentPercentage)}% of your "${budgetName}" budget.`,
          null,
          { type: 'budget_exceeded', budgetId }
        );
        inMemoryNotified.set(periodKey, 'exceeded');
        await settingsRepo.setSetting(periodKey, 'exceeded');
        return;
      }

      if (
        currentPercentage >= threshold &&
        currentPercentage < 100 &&
        lastLevel === 'none'
      ) {
        await NotificationService.scheduleLocalNotification(
          `Budget Warning: ${budgetName}`,
          `You have used ${Math.round(currentPercentage)}% of your "${budgetName}" budget.`,
          null,
          { type: 'budget_warning', budgetId }
        );
        inMemoryNotified.set(periodKey, 'warning');
        await settingsRepo.setSetting(periodKey, 'warning');
      }
    } catch (error) {
      console.warn('BudgetNotifier.checkAndNotify failed:', error);
    }
  }

  static async resetNotificationState(budgetId: string): Promise<void> {
    try {
      const periodKey = getPeriodKey(budgetId);
      inMemoryNotified.delete(periodKey);
      const db = await getDatabase();
      const settingsRepo = new SettingsRepository(db);
      await settingsRepo.setSetting(periodKey, 'none');
    } catch (error) {
      console.warn('BudgetNotifier.resetNotificationState failed:', error);
    }
  }
}
