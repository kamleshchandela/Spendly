/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  Check,
  ChevronLeft,
  CreditCard,
  Landmark,
  PiggyBank,
  Wallet,
  X,
} from 'lucide-react-native';
import { getDatabase } from '../../database/database';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { useSettingsStore } from '../../store/settingsStore';
import { useWalletStore } from '../../store/walletStore';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import type { WalletType } from '../../types/wallet.types';
import { getCurrencySymbol, parseCurrencyToMinor } from '../../utils/currencyUtils';

interface WalletTypeOption {
  type: WalletType;
  label: string;
  iconName: string;
}

const WALLET_TYPES: WalletTypeOption[] = [
  { type: 'cash', label: 'Cash', iconName: 'banknote' },
  { type: 'bank', label: 'Bank', iconName: 'landmark' },
  { type: 'savings', label: 'Savings', iconName: 'piggy-bank' },
  { type: 'credit', label: 'Credit Card', iconName: 'credit-card' },
];

const WALLET_COLORS = Colors.categoryColors.slice(0, 6);

function WalletTypeIcon({
  type,
  size,
  color,
}: {
  type: WalletType;
  size: number;
  color: string;
}) {
  switch (type) {
    case 'bank':
      return <Landmark size={size} color={color} strokeWidth={2.1} />;
    case 'savings':
      return <PiggyBank size={size} color={color} strokeWidth={2.1} />;
    case 'credit':
      return <CreditCard size={size} color={color} strokeWidth={2.1} />;
    case 'cash':
    default:
      return <Wallet size={size} color={color} strokeWidth={2.1} />;
  }
}

function sanitizeDecimalInput(text: string): string {
  const cleaned = text.replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  if (parts.length <= 1) return cleaned;
  return `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
}

export default function WalletSetupScreen() {
  const router = useRouter();
  const { settings, updateSetting } = useSettingsStore();
  const { loadWallets } = useWalletStore();

  const baseCurrency = settings?.baseCurrency || 'INR';
  const currencySymbol = getCurrencySymbol(baseCurrency);

  const [walletName, setWalletName] = useState('My Wallet');
  const [selectedType, setSelectedType] = useState<WalletType>('cash');
  const [balanceText, setBalanceText] = useState('');
  const [selectedColor, setSelectedColor] = useState<string>(WALLET_COLORS[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 450,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleBalanceChange = useCallback((value: string) => {
    setBalanceText(sanitizeDecimalInput(value));
  }, []);

  const handleStartTracking = useCallback(async () => {
    if (isSubmitting) return;
    Keyboard.dismiss();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const trimmedName = walletName.trim();
      if (trimmedName.length > 0) {
        const db = await getDatabase();
        const walletRepo = new WalletRepository(db);
        const typeOption = WALLET_TYPES.find((t) => t.type === selectedType) ?? WALLET_TYPES[0];
        const openingBalanceMinor = balanceText.trim()
          ? parseCurrencyToMinor(balanceText)
          : 0;

        await walletRepo.insert({
          name: trimmedName,
          type: selectedType,
          currencyCode: baseCurrency,
          openingBalanceMinor,
          color: selectedColor,
          iconName: typeOption.iconName,
          includeInTotal: true,
          isArchived: false,
        });
        await loadWallets();
      }

      await updateSetting('onboardingCompleted', true);
      router.replace('/(tabs)/' as never);
    } catch (error) {
      console.error('Failed to complete wallet setup:', error);
      setErrorMessage('Could not save your wallet. Please try again.');
      setIsSubmitting(false);
    }
  }, [
    isSubmitting,
    walletName,
    selectedType,
    balanceText,
    baseCurrency,
    selectedColor,
    loadWallets,
    updateSetting,
    router,
  ]);

  const handleSkip = useCallback(async () => {
    if (isSubmitting) return;
    Keyboard.dismiss();
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await updateSetting('onboardingCompleted', true);
      router.replace('/(tabs)/' as never);
    } catch (error) {
      console.error('Failed to skip wallet setup:', error);
      setErrorMessage('Something went wrong. Please try again.');
      setIsSubmitting(false);
    }
  }, [isSubmitting, updateSetting, router]);

  const activeTypeOption = WALLET_TYPES.find((t) => t.type === selectedType) ?? WALLET_TYPES[0];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Animated.View
          style={[
            styles.flex,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
          ]}
        >
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
              disabled={isSubmitting}
            >
              <ChevronLeft size={22} color={Colors.textPrimary} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.progressPill}>
              <Text style={styles.progress}>2 of 2</Text>
            </View>
          </View>

          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Title */}
            <View style={styles.titleBlock}>
              <Text style={styles.heading}>Set up your first wallet</Text>
              <Text style={styles.subtitle}>Track your money across different accounts</Text>
            </View>

            {/* Live Wallet Preview Card */}
            <View style={[styles.previewCard, { backgroundColor: selectedColor }]}>
              <View style={styles.previewTopRow}>
                <Text style={styles.previewName} numberOfLines={1}>
                  {walletName.trim() || 'My Wallet'}
                </Text>
                <View style={styles.previewTypePill}>
                  <WalletTypeIcon
                    type={activeTypeOption.type}
                    size={13}
                    color={Colors.textInverse}
                  />
                  <Text style={styles.previewTypeText}>{activeTypeOption.label}</Text>
                </View>
              </View>
              <Text style={styles.previewBalance}>
                {currencySymbol}
                {balanceText.trim() || '0.00'}
              </Text>
              <Text style={styles.previewCurrency}>{baseCurrency}</Text>
            </View>

            {/* Form Card */}
            <View style={styles.formCard}>
              {/* Wallet Name */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Wallet name</Text>
                <View style={styles.inputContainer}>
                  <TextInput
                    style={styles.textInput}
                    value={walletName}
                    onChangeText={setWalletName}
                    placeholder="e.g., Cash, HDFC Bank"
                    placeholderTextColor={Colors.textDisabled}
                    maxLength={40}
                    returnKeyType="next"
                    editable={!isSubmitting}
                  />
                  {walletName.length > 0 && (
                    <Pressable
                      style={styles.clearBtn}
                      onPress={() => setWalletName('')}
                      accessibilityRole="button"
                      accessibilityLabel="Clear wallet name"
                      hitSlop={8}
                      disabled={isSubmitting}
                    >
                      <View style={styles.clearCircle}>
                        <X size={13} color={Colors.textSecondary} strokeWidth={2.4} />
                      </View>
                    </Pressable>
                  )}
                </View>
              </View>

              {/* Wallet Type Selector */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Wallet type</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipsRow}
                >
                  {WALLET_TYPES.map((option) => {
                    const isSelected = selectedType === option.type;
                    return (
                      <Pressable
                        key={option.type}
                        style={({ pressed }) => [
                          styles.chip,
                          isSelected && styles.chipSelected,
                          pressed && styles.chipPressed,
                        ]}
                        onPress={() => setSelectedType(option.type)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={option.label}
                        disabled={isSubmitting}
                      >
                        <View style={styles.chipIconWrap}>
                          <WalletTypeIcon
                            type={option.type}
                            size={16}
                            color={isSelected ? Colors.primary : Colors.textSecondary}
                          />
                        </View>
                        <Text style={[styles.chipText, isSelected && styles.chipTextSelected]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              </View>

              {/* Current Balance */}
              <View style={styles.fieldGroup}>
                <Text style={styles.label}>Current balance (optional)</Text>
                <View style={styles.balanceInputContainer}>
                  <Text style={styles.currencyPrefix}>{currencySymbol}</Text>
                  <TextInput
                    style={styles.balanceInput}
                    value={balanceText}
                    onChangeText={handleBalanceChange}
                    placeholder="0.00"
                    placeholderTextColor={Colors.textDisabled}
                    keyboardType="decimal-pad"
                    returnKeyType="done"
                    maxLength={12}
                    editable={!isSubmitting}
                  />
                  <View style={styles.currencyCodeBadge}>
                    <Text style={styles.currencyCodeText}>{baseCurrency}</Text>
                  </View>
                </View>
              </View>

              {/* Color Picker */}
              <View style={styles.fieldGroupLast}>
                <Text style={styles.label}>Card color</Text>
                <View style={styles.colorRow}>
                  {WALLET_COLORS.map((color) => {
                    const isSelected = selectedColor === color;
                    return (
                      <Pressable
                        key={color}
                        style={({ pressed }) => [
                          styles.colorTouchTarget,
                          isSelected && { borderColor: color, borderWidth: 2 },
                          pressed && styles.colorPressed,
                        ]}
                        onPress={() => setSelectedColor(color)}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: isSelected }}
                        accessibilityLabel={`Select color ${color}`}
                        disabled={isSubmitting}
                      >
                        <View style={[styles.colorCircle, { backgroundColor: color }]}>
                          {isSelected && (
                            <Check size={16} color={Colors.textInverse} strokeWidth={2.75} />
                          )}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>

            {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}
          </ScrollView>

          {/* Footer CTA & Skip */}
          <SafeAreaView edges={['bottom']} style={styles.footerWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed,
                isSubmitting && styles.ctaButtonDisabled,
              ]}
              onPress={handleStartTracking}
              accessibilityRole="button"
              accessibilityLabel="Start Tracking"
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <>
                  <Text style={styles.ctaText}>Start Tracking</Text>
                  <ArrowRight size={18} color={Colors.textInverse} strokeWidth={2.3} />
                </>
              )}
            </Pressable>

            <Pressable
              style={({ pressed }) => [styles.skipBtn, pressed && styles.skipBtnPressed]}
              onPress={handleSkip}
              accessibilityRole="button"
              accessibilityLabel="Skip for now"
              disabled={isSubmitting}
            >
              <Text style={styles.skipText}>Skip for now</Text>
            </Pressable>
          </SafeAreaView>
        </Animated.View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  flex: {
    flex: 1,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing['2xl'],
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  backBtnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
  progressPill: {
    backgroundColor: '#F3F6F2',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  progress: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  scrollContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing['2xl'],
  },

  // Title
  titleBlock: {
    paddingTop: Spacing.xs,
    marginBottom: Spacing.xl,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Preview Card
  previewCard: {
    borderRadius: 22,
    padding: Spacing.xl,
    marginBottom: Spacing.xl,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 18,
      },
      android: { elevation: 5 },
    }),
  },
  previewTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.lg,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textInverse,
    flex: 1,
  },
  previewTypePill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 1,
    borderRadius: 100,
  },
  previewTypeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  previewBalance: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.textInverse,
    fontVariant: ['tabular-nums'],
    marginBottom: Spacing.xs,
  },
  previewCurrency: {
    fontSize: 12,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.82)',
    letterSpacing: 0.6,
  },

  // Form Card
  formCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 22,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  fieldGroup: {
    marginBottom: Spacing.xl,
  },
  fieldGroupLast: {
    marginBottom: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },

  // Text Input
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAF8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs,
    height: 52,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    height: '100%',
  },
  clearBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clearCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Wallet Type Chips
  chipsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs + 2,
    backgroundColor: '#F3F6F2',
    borderRadius: 100,
    paddingHorizontal: Spacing.lg,
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  chipSelected: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
  },
  chipPressed: {
    opacity: 0.78,
  },
  chipIconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Balance Input
  balanceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAF8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingHorizontal: Spacing.lg,
    height: 56,
    gap: Spacing.sm,
  },
  currencyPrefix: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.primary,
  },
  balanceInput: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    height: '100%',
  },
  currencyCodeBadge: {
    backgroundColor: '#E5F4EC',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#C6E8D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyCodeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },

  // Color Picker
  colorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  colorTouchTarget: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
  colorCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },

  errorText: {
    marginTop: Spacing.md,
    fontSize: 13,
    color: Colors.expense,
    textAlign: 'center',
    fontWeight: '500',
  },

  // Footer
  footerWrapper: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    backgroundColor: Colors.bgMain,
    borderTopWidth: 1,
    borderTopColor: '#F0F4EF',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  ctaButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  ctaButtonDisabled: {
    opacity: 0.65,
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textInverse,
    letterSpacing: 0.2,
  },
  skipBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  skipBtnPressed: {
    opacity: 0.6,
  },
  skipText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
