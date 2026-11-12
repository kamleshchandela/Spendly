/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { Platform } from 'react-native';
export const Shadows = {
  card: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.05, shadowOffset: { width: 0, height: 2 }, shadowRadius: 10 },
    android: { elevation: 3 },
  }),
  button: Platform.select({
    ios: { shadowColor: '#5BAF85', shadowOpacity: 0.25, shadowOffset: { width: 0, height: 4 }, shadowRadius: 10 },
    android: { elevation: 4 },
  }),
  fab: Platform.select({
    ios: { shadowColor: '#5BAF85', shadowOpacity: 0.35, shadowOffset: { width: 0, height: 6 }, shadowRadius: 20 },
    android: { elevation: 8 },
  }),
  bottomSheet: Platform.select({
    ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowOffset: { width: 0, height: -4 }, shadowRadius: 24 },
    android: { elevation: 12 },
  }),
};
