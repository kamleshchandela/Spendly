/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { nowISO } from '../../utils/dateUtils';

export const DEFAULT_SETTINGS: Array<{ setting_key: string; setting_value: string }> = [
  { setting_key: 'base_currency', setting_value: 'INR' },
  { setting_key: 'user_name', setting_value: '' },
  { setting_key: 'date_format', setting_value: 'DD/MM/YYYY' },
  { setting_key: 'number_format', setting_value: 'indian' },
  { setting_key: 'decimal_places', setting_value: '2' },
  { setting_key: 'first_day_of_week', setting_value: '1' },
  { setting_key: 'fiscal_year_start', setting_value: '1' },
  { setting_key: 'accent_color', setting_value: '#5BAF85' },
  { setting_key: 'hide_balance', setting_value: 'false' },
  { setting_key: 'haptic_enabled', setting_value: 'true' },
  { setting_key: 'budget_warning_threshold', setting_value: '80' },
  { setting_key: 'recurring_reminder_days', setting_value: '2' },
  { setting_key: 'app_locked', setting_value: 'false' },
  { setting_key: 'backup_encrypt', setting_value: 'false' },
  { setting_key: 'onboarding_completed', setting_value: 'false' },
  { setting_key: 'first_launch_date', setting_value: '' },
];

export const getDefaultSettingsWithTimestamp = () => {
  const now = nowISO();
  return DEFAULT_SETTINGS.map((s) => ({ ...s, updated_at: now }));
};
