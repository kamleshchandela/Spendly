/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

let handlerConfigured = false;

const ensureHandlerConfigured = (): void => {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
};

export class NotificationService {
  static async requestPermissions(): Promise<boolean> {
    try {
      ensureHandlerConfigured();

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('spendly-default', {
          name: 'Spendly Alerts',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 200, 150, 200],
          lightColor: '#5BAF85',
        });
      }

      const existing = await Notifications.getPermissionsAsync();
      if (existing.granted) {
        return true;
      }

      const requested = await Notifications.requestPermissionsAsync();
      return requested.granted;
    } catch (error) {
      console.warn('NotificationService.requestPermissions failed:', error);
      return false;
    }
  }

  static async hasPermissions(): Promise<boolean> {
    try {
      const status = await Notifications.getPermissionsAsync();
      return status.granted;
    } catch {
      return false;
    }
  }

  static async scheduleLocalNotification(
    title: string,
    body: string,
    trigger: Notifications.NotificationTriggerInput,
    data?: Record<string, unknown>
  ): Promise<string> {
    ensureHandlerConfigured();
    const granted = await this.requestPermissions();
    if (!granted) {
      return '';
    }

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        sound: 'default',
        data: data ?? {},
      },
      trigger,
    });

    return id;
  }

  static async cancelNotification(id: string): Promise<void> {
    if (!id) return;
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch (error) {
      console.warn('NotificationService.cancelNotification failed:', error);
    }
  }

  static async cancelAllNotifications(): Promise<void> {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
    } catch (error) {
      console.warn('NotificationService.cancelAllNotifications failed:', error);
    }
  }

  static async getScheduledNotifications(): Promise<Notifications.NotificationRequest[]> {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch {
      return [];
    }
  }
}
