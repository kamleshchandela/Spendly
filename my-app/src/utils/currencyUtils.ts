/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export const toMinorUnits = (amount: number): number => Math.round(amount * 100);
export const fromMinorUnits = (minor: number): number => minor / 100;
export const toMajorUnits = fromMinorUnits;

export const parseCurrencyToMinor = (displayValue: string): number => {
  const cleaned = displayValue.replace(/[^0-9.-]/g, '');
  const amount = parseFloat(cleaned) || 0;
  return toMinorUnits(amount);
};

export const getCurrencySymbol = (code: string): string => {
  const symbols: Record<string, string> = {
    INR: '₹',
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    AED: 'د.إ',
    SGD: 'S$',
    CAD: 'CA$',
    AUD: 'A$',
    CNY: '¥',
    CHF: 'Fr',
    KRW: '₩',
    BRL: 'R$',
    MXN: '$',
    RUB: '₽',
    HKD: 'HK$',
    NOK: 'kr',
    SEK: 'kr',
    DKK: 'kr',
    NZD: 'NZ$',
    ZAR: 'R',
    TRY: '₺',
    SAR: '﷼',
    QAR: '﷼',
    KWD: 'د.ك',
    MYR: 'RM',
    THB: '฿',
    IDR: 'Rp',
    PHP: '₱',
    PKR: '₨',
    BDT: '৳',
    NPR: '₨',
  };
  return symbols[code] || code + ' ';
};

export const formatNumber = (
  num: number,
  format: 'indian' | 'international' = 'indian',
  decimalPlaces: number = 2
): string => {
  const isNegative = num < 0;
  const absNum = Math.abs(num);
  const [intPart, decPart] = absNum.toFixed(decimalPlaces).split('.');
  let formatted: string;
  if (format === 'indian') {
    if (intPart.length <= 3) {
      formatted = intPart;
    } else {
      let result = intPart.slice(-3);
      let remaining = intPart.slice(0, -3);
      while (remaining.length > 2) {
        result = remaining.slice(-2) + ',' + result;
        remaining = remaining.slice(0, -2);
      }
      if (remaining.length > 0) result = remaining + ',' + result;
      formatted = result;
    }
  } else {
    formatted = parseInt(intPart, 10).toLocaleString('en-US');
  }
  return (isNegative ? '-' : '') + formatted + (decimalPlaces > 0 && decPart !== undefined ? '.' + decPart : '');
};

export const formatCurrency = (
  minor: number,
  currencyCode: string = 'INR',
  format: 'indian' | 'international' = 'indian',
  decimalPlaces: number = 2
): string => {
  const symbol = getCurrencySymbol(currencyCode);
  const amount = fromMinorUnits(minor);
  const isNegative = amount < 0;
  const formatted = formatNumber(Math.abs(amount), format, decimalPlaces);
  return (isNegative ? '-' : '') + symbol + formatted;
};
