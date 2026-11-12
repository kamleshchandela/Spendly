/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { Platform, StyleSheet, TextStyle } from 'react-native';

const systemFont = Platform.select({
  ios: 'System',
  android: 'sans-serif',
  default: 'System',
});

export const Typography = StyleSheet.create({
  display: {
    fontFamily: systemFont,
    fontSize: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    lineHeight: 42,
    fontVariant: ['tabular-nums'],
  } as TextStyle,
  titleXl: {
    fontFamily: systemFont,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 30,
  } as TextStyle,
  titleLg: {
    fontFamily: systemFont,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    lineHeight: 26,
  } as TextStyle,
  titleMd: {
    fontFamily: systemFont,
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
    lineHeight: 22,
  } as TextStyle,
  titleSm: {
    fontFamily: systemFont,
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.1,
    lineHeight: 20,
  } as TextStyle,
  bodyLg: {
    fontFamily: systemFont,
    fontSize: 15,
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: 22,
  } as TextStyle,
  bodyMd: {
    fontFamily: systemFont,
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: 20,
  } as TextStyle,
  bodySm: {
    fontFamily: systemFont,
    fontSize: 13,
    fontWeight: '400',
    letterSpacing: 0.1,
    lineHeight: 18,
  } as TextStyle,
  caption: {
    fontFamily: systemFont,
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.3,
    lineHeight: 16,
  } as TextStyle,
  label: {
    fontFamily: systemFont,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.5,
    lineHeight: 14,
  } as TextStyle,
});
