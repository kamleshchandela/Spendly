/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  AppState,
  AppStateStatus,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SplashScreen from 'expo-splash-screen';
import { Lock, ShieldCheck } from 'lucide-react-native';
import { getDatabase } from '../database/database';
import { runMigrations } from '../database/migrations';
import { SettingsRepository } from '../database/repositories/SettingsRepository';
import { CategoryRepository } from '../database/repositories/CategoryRepository';
import { RecurringRepository } from '../database/repositories/RecurringRepository';
import { RecurringService } from '../services/recurring/RecurringService';
import { NotificationService } from '../services/notifications/NotificationService';
import { useSettingsStore } from '../store/settingsStore';
import { APP_LOCK_TIMEOUT_MS } from '../constants/config';
import { Colors } from '../theme/colors';
import { Shapes } from '../theme/shapes';
import { Shadows } from '../theme/shadows';
import { Spacing } from '../theme/spacing';
import { AppAlertModal } from '../components/common/CustomAlert';
import { AnimatedSplashScreen } from '../components/common/AnimatedSplashScreen';

// Keep native splash screen visible while JS bundle and resources initialize
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [isReady, setIsReady] = useState(false);
  const [splashVisible, setSplashVisible] = useState(true);
  const [isLocked, setIsLocked] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAuthenticating, setIsAuthenticating] = useState(false);

  const router = useRouter();
  const segments = useSegments();
  const { loadSettings, settings } = useSettingsStore();

  const backgroundedAtRef = useRef<number | null>(null);
  const initialLockCheckedRef = useRef(false);

  const authenticate = useCallback(async () => {
    if (isAuthenticating) return;
    setIsAuthenticating(true);
    setAuthError(null);
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        setIsLocked(false);
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Spendly',
        fallbackLabel: 'Use Passcode',
        disableDeviceFallback: false,
      });

      if (result.success) {
        setIsLocked(false);
        setAuthError(null);
      } else {
        setAuthError('Authentication was cancelled. Tap below to try again.');
      }
    } catch (error) {
      console.warn('Biometric auth error:', error);
      setAuthError('Unable to verify identity. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  }, [isAuthenticating]);

  useEffect(() => {
    const init = async () => {
      try {
        const db = await getDatabase();
        await runMigrations(db);
        const settingsRepo = new SettingsRepository(db);
        await settingsRepo.initializeDefaultSettings();
        const categoryRepo = new CategoryRepository(db);
        await categoryRepo.seedDefaults();
        await loadSettings();

        // Non-blocking on-app-open recurring payments due check & reminder scheduling
        try {
          await RecurringService.processDueAutoCreate();
          const recurringRepo = new RecurringRepository(db);
          const upcoming = await recurringRepo.getUpcoming(7);
          const scheduled = await NotificationService.getScheduledNotifications();
          const scheduledRecurringIds = new Set(
            scheduled
              .map((n) => n.content.data?.recurringId)
              .filter((id): id is string => typeof id === 'string')
          );

          for (const item of upcoming) {
            if (item.reminderEnabled && !scheduledRecurringIds.has(item.id)) {
              await RecurringService.scheduleReminder(item);
            }
          }
        } catch (recurringErr) {
          console.warn('Recurring startup check failed:', recurringErr);
        }
      } catch (e) {
        console.error('Init error:', e);
      } finally {
        setIsReady(true);
      }
    };
    init();
  }, [loadSettings]);

  // Onboarding redirect guard
  useEffect(() => {
    if (!isReady || !settings) return;
    const inOnboarding = segments[0] === '(onboarding)';
    if (!settings.onboardingCompleted && !inOnboarding) {
      router.replace('/(onboarding)/welcome' as never);
    }
  }, [isReady, settings, segments, router]);

  // Initial biometric lock check once settings are loaded
  useEffect(() => {
    if (!isReady || !settings) return;

    if (!settings.appLocked) {
      setIsLocked(false);
      initialLockCheckedRef.current = true;
      return;
    }

    if (!initialLockCheckedRef.current && settings.appLocked) {
      initialLockCheckedRef.current = true;
      setIsLocked(true);
      authenticate();
    }
  }, [isReady, settings, authenticate]);

  // Re-lock app when returning from background after > APP_LOCK_TIMEOUT_MS (60s)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === 'background' || nextState === 'inactive') {
        if (backgroundedAtRef.current === null) {
          backgroundedAtRef.current = Date.now();
        }
      } else if (nextState === 'active') {
        const backgroundedAt = backgroundedAtRef.current;
        backgroundedAtRef.current = null;

        if (
          settings?.appLocked &&
          backgroundedAt !== null &&
          Date.now() - backgroundedAt > APP_LOCK_TIMEOUT_MS
        ) {
          setIsLocked(true);
          authenticate();
        }
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, [settings?.appLocked, authenticate]);

  return (
    <GestureHandlerRootView style={styles.root}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(settings)" />
        <Stack.Screen name="modals" options={{ presentation: 'modal' }} />
      </Stack>

      {/* Global Soft UI Custom Alert Popup */}
      <AppAlertModal />

      {isLocked ? (
        <View style={styles.lockOverlay}>
          <View style={styles.lockCard}>
            <View style={styles.lockBadgeWrapper}>
              <View style={styles.lockOuterRing}>
                <View style={styles.lockInnerCircle}>
                  <Lock size={30} color={Colors.primary} />
                </View>
              </View>
              <View style={styles.shieldAccent}>
                <ShieldCheck size={16} color={Colors.textInverse} />
              </View>
            </View>

            <Text style={styles.lockTitle}>Spendly is Locked</Text>
            <Text style={styles.lockSubtitle}>
              Verify your identity to access your personal finances.
            </Text>
            {authError ? <Text style={styles.lockError}>{authError}</Text> : null}

            <Pressable
              onPress={authenticate}
              disabled={isAuthenticating}
              accessibilityRole="button"
              accessibilityLabel="Unlock Spendly"
              style={({ pressed }) => [
                styles.unlockButton,
                pressed && styles.unlockButtonPressed,
                isAuthenticating && styles.unlockButtonDisabled,
              ]}
            >
              {isAuthenticating ? (
                <ActivityIndicator size="small" color={Colors.textInverse} />
              ) : (
                <View style={styles.unlockButtonRow}>
                  <ShieldCheck size={18} color={Colors.textInverse} />
                  <Text style={styles.unlockButtonText}>Unlock Spendly</Text>
                </View>
              )}
            </Pressable>
          </View>
        </View>
      ) : null}

      {/* Soft Animated Splash Screen */}
      {splashVisible ? (
        <AnimatedSplashScreen
          isReady={isReady}
          onAnimationComplete={() => setSplashVisible(false)}
        />
      ) : null}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.bgMain,
  },
  lockOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: Colors.bgMain,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing['2xl'],
    zIndex: 999,
  },
  lockCard: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: Colors.bgCard,
    borderRadius: Shapes.cardRadius,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing['2xl'],
    alignItems: 'center',
    ...Shadows.card,
  },
  lockBadgeWrapper: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  lockOuterRing: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockInnerCircle: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  shieldAccent: {
    position: 'absolute',
    right: 2,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  lockSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: Spacing.xl,
  },
  lockError: {
    fontSize: 13,
    color: Colors.expense,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  unlockButton: {
    width: '100%',
    height: 52,
    borderRadius: Shapes.buttonRadius,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.button,
  },
  unlockButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  unlockButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  unlockButtonDisabled: {
    opacity: 0.6,
  },
  unlockButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textInverse,
  },
});
