/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { create } from 'zustand';

interface TabBarState {
  isTabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
}

export const useTabBarStore = create<TabBarState>((set) => ({
  isTabBarVisible: true,
  setTabBarVisible: (visible: boolean) => set({ isTabBarVisible: visible }),
}));
