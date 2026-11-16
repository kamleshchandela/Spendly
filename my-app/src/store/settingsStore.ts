/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { create } from 'zustand';
import { AppSettings } from '../types/settings.types';
import { SettingsRepository } from '../database/repositories/SettingsRepository';
import { getDatabase } from '../database/database';

interface SettingsState {
  settings: AppSettings | null;
  isLoaded: boolean;
  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

const settingsKeyMap: Record<keyof AppSettings, string> = {
  baseCurrency: 'base_currency',
  userName: 'user_name',
  dateFormat: 'date_format',
  numberFormat: 'number_format',
  decimalPlaces: 'decimal_places',
  firstDayOfWeek: 'first_day_of_week',
  fiscalYearStart: 'fiscal_year_start',
  accentColor: 'accent_color',
  hideBalance: 'hide_balance',
  hapticEnabled: 'haptic_enabled',
  budgetWarningThreshold: 'budget_warning_threshold',
  recurringReminderDays: 'recurring_reminder_days',
  appLocked: 'app_locked',
  backupEncrypt: 'backup_encrypt',
  onboardingCompleted: 'onboarding_completed',
  firstLaunchDate: 'first_launch_date',
};

export const useSettingsStore = create<SettingsState>((set) => ({
  settings: null,
  isLoaded: false,
  loadSettings: async () => {
    const db = await getDatabase();
    const repo = new SettingsRepository(db);
    const raw = await repo.getAllSettings();
    const settings: AppSettings = {
      baseCurrency: raw['base_currency'] || 'INR',
      userName: raw['user_name'] || '',
      dateFormat: raw['date_format'] || 'DD/MM/YYYY',
      numberFormat: (raw['number_format'] as 'indian' | 'international') || 'indian',
      decimalPlaces: parseInt(raw['decimal_places'] || '2', 10),
      firstDayOfWeek: parseInt(raw['first_day_of_week'] || '1', 10),
      fiscalYearStart: parseInt(raw['fiscal_year_start'] || '1', 10),
      accentColor: raw['accent_color'] || '#5BAF85',
      hideBalance: raw['hide_balance'] === 'true',
      hapticEnabled: raw['haptic_enabled'] !== 'false',
      budgetWarningThreshold: parseInt(raw['budget_warning_threshold'] || '80', 10),
      recurringReminderDays: parseInt(raw['recurring_reminder_days'] || '2', 10),
      appLocked: raw['app_locked'] === 'true',
      backupEncrypt: raw['backup_encrypt'] === 'true',
      onboardingCompleted: raw['onboarding_completed'] === 'true',
      firstLaunchDate: raw['first_launch_date'] || '',
    };
    set({ settings, isLoaded: true });
  },
  updateSetting: async (key, value) => {
    const db = await getDatabase();
    const repo = new SettingsRepository(db);
    const dbKey = settingsKeyMap[key];
    await repo.setSetting(dbKey, String(value));
    set((state) => ({
      settings: state.settings ? { ...state.settings, [key]: value } : null,
    }));
  },
}));
