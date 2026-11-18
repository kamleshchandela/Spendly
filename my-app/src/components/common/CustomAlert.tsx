/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  AlertCircle,
  AlertTriangle,
  Archive,
  CheckCircle2,
  HelpCircle,
  Trash2,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import {
  AlertButton,
  AlertOptions,
  Alert,
  showAlert,
  useAlertStore,
} from '../../store/alertStore';

export { AlertButton, AlertOptions, Alert, showAlert };

export function AppAlertModal() {
  const currentAlert = useAlertStore((s) => s.currentAlert);
  const hideAlert = useAlertStore((s) => s.hideAlert);

  const scaleAnim = useRef(new Animated.Value(0.92)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (currentAlert) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      scaleAnim.setValue(0.92);
      fadeAnim.setValue(0);
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 160,
          useNativeDriver: true,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 180,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [currentAlert]);

  if (!currentAlert) return null;

  const titleLower = currentAlert.title.toLowerCase();
  const hasDestructiveBtn = currentAlert.buttons.some((b) => b.style === 'destructive');
  const isDestructive =
    hasDestructiveBtn ||
    titleLower.includes('delete') ||
    titleLower.includes('clear') ||
    titleLower.includes('remove');
  const isArchive = titleLower.includes('archive');
  const isError = titleLower.includes('error') || titleLower.includes('failed');
  const isWarning =
    titleLower.includes('warning') || titleLower.includes('confirmation');
  const isSuccess =
    titleLower.includes('thank') ||
    titleLower.includes('complete') ||
    titleLower.includes('cleared') ||
    titleLower.includes('success') ||
    titleLower.includes('saved');

  // Pick appropriate soft badge
  let badgeBg = Colors.primarySoft;
  let badgeBorder = '#C8E8D5';
  let badgeIcon = <CheckCircle2 size={24} color={Colors.primary} strokeWidth={2.2} />;

  if (isDestructive) {
    badgeBg = Colors.expenseSoft;
    badgeBorder = '#F7D4D4';
    badgeIcon = <Trash2 size={24} color={Colors.expense} strokeWidth={2.2} />;
  } else if (isArchive) {
    badgeBg = Colors.expenseSoft;
    badgeBorder = '#F7D4D4';
    badgeIcon = <Archive size={24} color={Colors.expense} strokeWidth={2.2} />;
  } else if (isError) {
    badgeBg = Colors.expenseSoft;
    badgeBorder = '#F7D4D4';
    badgeIcon = <AlertCircle size={24} color={Colors.expense} strokeWidth={2.2} />;
  } else if (isWarning) {
    badgeBg = Colors.warningSoft;
    badgeBorder = '#F5DEC0';
    badgeIcon = <AlertTriangle size={24} color={Colors.warning} strokeWidth={2.2} />;
  } else if (!isSuccess) {
    badgeBg = Colors.primarySoft;
    badgeBorder = '#C8E8D5';
    badgeIcon = <HelpCircle size={24} color={Colors.primary} strokeWidth={2.2} />;
  }

  const handlePressButton = (btn: AlertButton) => {
    Haptics.selectionAsync().catch(() => {});
    hideAlert();
    if (btn.onPress) {
      setTimeout(() => {
        try {
          btn.onPress?.();
        } catch {}
      }, 50);
    }
  };

  const handleBackdropPress = () => {
    if (currentAlert.options?.cancelable) {
      hideAlert();
      currentAlert.options.onDismiss?.();
    }
  };

  const isRowLayout = currentAlert.buttons.length === 2;

  return (
    <Modal
      visible={true}
      transparent
      animationType="none"
      onRequestClose={handleBackdropPress}
    >
      <View style={styles.overlay}>
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={handleBackdropPress}
        />

        <Animated.View
          style={[
            styles.card,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Soft Badge Icon */}
          <View style={[styles.badgeCircle, { backgroundColor: badgeBg, borderColor: badgeBorder }]}>
            {badgeIcon}
          </View>

          {/* Title */}
          <Text style={styles.title}>{currentAlert.title}</Text>

          {/* Message */}
          {currentAlert.message ? (
            <Text style={styles.message}>{currentAlert.message}</Text>
          ) : null}

          {/* Action Buttons */}
          <View style={isRowLayout ? styles.buttonRow : styles.buttonCol}>
            {currentAlert.buttons.map((btn, index) => {
              const isCancel = btn.style === 'cancel';
              const isBtnDestructive = btn.style === 'destructive';

              let btnBg = Colors.primary;
              let textColor = Colors.textInverse;
              let borderStyle = undefined;

              if (isCancel) {
                btnBg = '#F3F6F2';
                textColor = Colors.textPrimary;
                borderStyle = styles.cancelBorder;
              } else if (isBtnDestructive) {
                btnBg = Colors.expense;
                textColor = Colors.textInverse;
              }

              return (
                <Pressable
                  key={`${btn.text}-${index}`}
                  onPress={() => handlePressButton(btn)}
                  style={({ pressed }) => [
                    styles.button,
                    isRowLayout && styles.buttonFlex,
                    { backgroundColor: btnBg },
                    borderStyle,
                    pressed && styles.buttonPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={btn.text}
                >
                  <Text
                    style={[
                      styles.buttonText,
                      { color: textColor },
                      isCancel ? styles.buttonTextMedium : styles.buttonTextBold,
                    ]}
                    numberOfLines={1}
                  >
                    {btn.text}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 30, 22, 0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 335,
    backgroundColor: Colors.bgCard,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    paddingTop: 24,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#10281A',
        shadowOpacity: 0.14,
        shadowOffset: { width: 0, height: 10 },
        shadowRadius: 24,
      },
      android: {
        elevation: 10,
      },
    }),
  },
  badgeCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 20,
    letterSpacing: 0.1,
  },
  buttonRow: {
    flexDirection: 'row',
    width: '100%',
    gap: 10,
  },
  buttonCol: {
    width: '100%',
    gap: 10,
  },
  button: {
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  buttonFlex: {
    flex: 1,
  },
  cancelBorder: {
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  buttonText: {
    fontSize: 15,
    letterSpacing: 0.1,
  },
  buttonTextBold: {
    fontWeight: '700',
  },
  buttonTextMedium: {
    fontWeight: '600',
  },
});
