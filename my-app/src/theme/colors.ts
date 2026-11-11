/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export const Colors = {
  bgMain: '#F4F6F3',
  bgCard: '#FFFFFF',
  primary: '#5BAF85',
  primarySoft: '#E5F4EC',
  secondary: '#7FB2D4',
  secondarySoft: '#E8F3FA',
  accentLavender: '#9B8DD4',
  accentLavenderSoft: '#EDE9F8',
  expense: '#E07878',
  expenseSoft: '#FAECEC',
  warning: '#E8A44A',
  warningSoft: '#FDF3E3',
  textPrimary: '#1E2B25',
  textSecondary: '#7A8880',
  textDisabled: '#B8C4BF',
  textInverse: '#FFFFFF',
  border: '#ECF0EB',
  borderStrong: '#D8DED7',
  categoryColors: ['#5BAF85','#7FB2D4','#9B8DD4','#E07878','#E8A44A','#59C0B4','#D47FAA','#8DB4E8','#C4B45A','#A0A0A0'] as const,
};
export type ColorToken = keyof typeof Colors;
