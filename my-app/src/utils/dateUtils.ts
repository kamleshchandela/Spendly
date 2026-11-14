/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import {
  format,
  addDays,
  addMonths,
  addYears,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  isToday,
  isYesterday,
  differenceInDays,
  isSameDay,
} from 'date-fns';

export { format, addDays, addMonths, addYears, isToday, isYesterday, differenceInDays, isSameDay };

export const nowISO = (): string => new Date().toISOString();
export const toISO = (date: Date): string => date.toISOString();
export const fromISO = (iso: string): Date => new Date(iso);

export const formatDisplay = (iso: string | Date, fmt: string = 'dd MMM yyyy'): string => {
  try {
    const d = typeof iso === 'string' ? new Date(iso) : iso;
    return format(d, fmt);
  } catch {
    return String(iso);
  }
};

export const formatRelative = (iso: string): string => {
  const date = new Date(iso);
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'dd MMM yyyy');
};

export const formatTime = (iso: string): string => {
  try {
    return format(new Date(iso), 'h:mm a');
  } catch {
    return '';
  }
};

export const getDaysRemaining = (endDate: string): number => {
  const end = new Date(endDate);
  const now = new Date();
  return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
};

export const getPeriodRange = (
  period: 'today' | 'week' | 'month' | 'year',
  date = new Date()
): { start: string; end: string } => {
  switch (period) {
    case 'today':
      return { start: toISO(startOfDay(date)), end: toISO(endOfDay(date)) };
    case 'week':
      return {
        start: toISO(startOfWeek(date, { weekStartsOn: 1 })),
        end: toISO(endOfWeek(date, { weekStartsOn: 1 })),
      };
    case 'month':
      return { start: toISO(startOfMonth(date)), end: toISO(endOfMonth(date)) };
    case 'year':
      return { start: toISO(startOfYear(date)), end: toISO(endOfYear(date)) };
  }
};

export const getGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  if (hour < 21) return 'Good evening';
  return 'Good night';
};

export const calculateNextDueDate = (
  frequency: string,
  frequencyDays: number | null,
  fromDate: Date = new Date()
): Date => {
  switch (frequency) {
    case 'daily':
      return addDays(fromDate, 1);
    case 'weekly':
      return addDays(fromDate, 7);
    case 'biweekly':
      return addDays(fromDate, 14);
    case 'monthly':
      return addMonths(fromDate, 1);
    case 'yearly':
      return addYears(fromDate, 1);
    case 'custom':
      return addDays(fromDate, frequencyDays || 30);
    default:
      return addMonths(fromDate, 1);
  }
};
