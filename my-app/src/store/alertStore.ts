/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { create } from 'zustand';

export interface AlertButton {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  cancelable?: boolean;
  onDismiss?: () => void;
}

export interface AlertData {
  title: string;
  message?: string;
  buttons: AlertButton[];
  options?: AlertOptions;
}

interface AlertState {
  currentAlert: AlertData | null;
  showAlert: (
    title: string,
    message?: string,
    buttons?: AlertButton[],
    options?: AlertOptions
  ) => void;
  hideAlert: () => void;
}

export const useAlertStore = create<AlertState>((set) => ({
  currentAlert: null,
  showAlert: (title, message, buttons, options) => {
    const resolvedButtons: AlertButton[] =
      buttons && buttons.length > 0 ? buttons : [{ text: 'OK', style: 'default' }];

    set({
      currentAlert: {
        title,
        message,
        buttons: resolvedButtons,
        options,
      },
    });
  },
  hideAlert: () => {
    set({ currentAlert: null });
  },
}));

export const showAlert = (
  title: string,
  message?: string,
  buttons?: AlertButton[],
  options?: AlertOptions
) => {
  useAlertStore.getState().showAlert(title, message, buttons, options);
};

export const Alert = {
  alert: showAlert,
};
