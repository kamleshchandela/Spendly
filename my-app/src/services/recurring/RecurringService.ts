/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { addDays, format, isAfter, isBefore, parseISO, subDays } from 'date-fns';
import * as Notifications from 'expo-notifications';
import { getDatabase } from '../../database/database';
import { RecurringRepository } from '../../database/repositories/RecurringRepository';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { SettingsRepository } from '../../database/repositories/SettingsRepository';
import { RecurringFrequency, RecurringPayment } from '../../types/recurring.types';
import { calculateNextDueDate, toISO } from '../../utils/dateUtils';
import { formatCurrency } from '../../utils/currencyUtils';
import { NotificationService } from '../notifications/NotificationService';

const getOrdinalSuffix = (day: number): string => {
  if (day >= 11 && day <= 13) return `${day}th`;
  switch (day % 10) {
    case 1:
      return `${day}st`;
    case 2:
      return `${day}nd`;
    case 3:
      return `${day}rd`;
    default:
      return `${day}th`;
  }
};

export class RecurringService {
  static getFrequencyLabel(
    frequency: RecurringFrequency,
    frequencyDays?: number | null,
    referenceDateIso?: string
  ): string {
    const refDate = referenceDateIso ? new Date(referenceDateIso) : new Date();
    const isValidDate = !isNaN(refDate.getTime());

    switch (frequency) {
      case 'daily':
        return 'Daily';
      case 'weekly':
        return isValidDate ? `Weekly · Every ${format(refDate, 'EEE')}` : 'Weekly';
      case 'biweekly':
        return 'Bi-weekly · Every 2 weeks';
      case 'monthly':
        return isValidDate
          ? `Monthly · Every ${getOrdinalSuffix(refDate.getDate())}`
          : 'Monthly';
      case 'yearly':
        return isValidDate ? `Yearly · ${format(refDate, 'MMM d')}` : 'Yearly';
      case 'custom':
        return `Every ${frequencyDays || 30} days`;
      default:
        return 'Monthly';
    }
  }

  static computeNextDueDate(item: Pick<RecurringPayment, 'frequency' | 'frequencyDays' | 'nextDueDate'>): string {
    const currentDue = new Date(item.nextDueDate);
    const baseDate = isNaN(currentDue.getTime()) ? new Date() : currentDue;
    const next = calculateNextDueDate(item.frequency, item.frequencyDays, baseDate);
    return toISO(next);
  }

  static async markAsPaid(item: RecurringPayment): Promise<void> {
    const db = await getDatabase();
    const txRepo = new TransactionRepository(db);
    const recRepo = new RecurringRepository(db);

    await txRepo.insert({
      type: 'expense',
      amountMinor: item.amountMinor,
      currencyCode: item.currencyCode,
      categoryId: item.categoryId,
      walletId: item.walletId,
      destinationWalletId: null,
      transferGroupId: null,
      title: item.title,
      note: item.note ?? `Recurring payment (${this.getFrequencyLabel(item.frequency, item.frequencyDays, item.nextDueDate)})`,
      transactionDate: toISO(new Date()),
      recurringId: item.id,
    });

    const nextDue = this.computeNextDueDate(item);
    if (item.endDate && isAfter(new Date(nextDue), new Date(item.endDate))) {
      await recRepo.update(item.id, { nextDueDate: nextDue, isActive: false });
    } else {
      await recRepo.updateNextDueDate(item.id, nextDue);
      if (item.reminderEnabled) {
        await this.scheduleReminder({ ...item, nextDueDate: nextDue });
      }
    }
  }

  static async processDueAutoCreate(): Promise<number> {
    const db = await getDatabase();
    const recRepo = new RecurringRepository(db);
    const txRepo = new TransactionRepository(db);

    const allActive = await recRepo.getAll(false);
    const now = new Date();
    let createdCount = 0;

    for (const item of allActive) {
      if (!item.autoCreate) continue;
      let due = parseISO(item.nextDueDate);
      if (isNaN(due.getTime())) continue;

      let safetyGuard = 0;
      while (!isAfter(due, now) && safetyGuard < 12) {
        safetyGuard++;
        await txRepo.insert({
          type: 'expense',
          amountMinor: item.amountMinor,
          currencyCode: item.currencyCode,
          categoryId: item.categoryId,
          walletId: item.walletId,
          destinationWalletId: null,
          transferGroupId: null,
          title: item.title,
          note: item.note ?? 'Auto-created recurring payment',
          transactionDate: toISO(due),
          recurringId: item.id,
        });
        createdCount++;

        due = calculateNextDueDate(item.frequency, item.frequencyDays, due);
        if (item.endDate && isAfter(due, new Date(item.endDate))) {
          await recRepo.update(item.id, { nextDueDate: toISO(due), isActive: false });
          break;
        }
        await recRepo.updateNextDueDate(item.id, toISO(due));
      }
    }

    return createdCount;
  }

  static async scheduleReminder(item: RecurringPayment): Promise<string | null> {
    try {
      if (!item.isActive || !item.reminderEnabled) return null;

      const db = await getDatabase();
      const settingsRepo = new SettingsRepository(db);
      const remindersEnabled = await settingsRepo.getSetting('recurring_reminders_enabled');
      if (remindersEnabled === 'false') return null;

      const dueDate = new Date(item.nextDueDate);
      if (isNaN(dueDate.getTime())) return null;

      const daysBefore = Math.max(0, item.reminderDaysBefore);
      const triggerDate = subDays(dueDate, daysBefore);
      triggerDate.setHours(9, 0, 0, 0);

      const now = new Date();
      if (isBefore(triggerDate, now)) {
        // If reminder time already passed but due date is still in future, notify in 1 minute
        if (isAfter(dueDate, now)) {
          const soon = addDays(now, 0);
          soon.setMinutes(soon.getMinutes() + 1);
          return await NotificationService.scheduleLocalNotification(
            `Upcoming Bill: ${item.title}`,
            `${formatCurrency(item.amountMinor, item.currencyCode)} is due on ${format(dueDate, 'dd MMM')}.`,
            {
              type: Notifications.SchedulableTriggerInputTypes.DATE,
              date: soon,
            },
            { type: 'recurring_reminder', recurringId: item.id }
          );
        }
        return null;
      }

      return await NotificationService.scheduleLocalNotification(
        `Upcoming Bill: ${item.title}`,
        `${formatCurrency(item.amountMinor, item.currencyCode)} is due on ${format(dueDate, 'dd MMM')}.`,
        {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: triggerDate,
        },
        { type: 'recurring_reminder', recurringId: item.id }
      );
    } catch (error) {
      console.warn('RecurringService.scheduleReminder failed:', error);
      return null;
    }
  }
}
