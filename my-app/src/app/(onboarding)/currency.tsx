/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowRight, Check, ChevronLeft, Search, X } from 'lucide-react-native';
import { CURRENCIES, POPULAR_CURRENCIES, type Currency } from '../../constants/currencies';
import { useSettingsStore } from '../../store/settingsStore';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

type ListItem =
  | { kind: 'header'; label: string; id: string }
  | { kind: 'currency'; currency: Currency };

function buildListData(search: string): ListItem[] {
  const q = search.trim().toLowerCase();

  if (q) {
    const results = CURRENCIES.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.code.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q),
    );
    return results.map((c) => ({ kind: 'currency' as const, currency: c }));
  }

  const popularCodes = new Set(POPULAR_CURRENCIES.map((c) => c.code));
  const rest = CURRENCIES.filter((c) => !popularCodes.has(c.code)).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return [
    { kind: 'header', label: 'Popular', id: 'h-popular' },
    ...POPULAR_CURRENCIES.map((c) => ({ kind: 'currency' as const, currency: c })),
    { kind: 'header', label: 'All Currencies', id: 'h-all' },
    ...rest.map((c) => ({ kind: 'currency' as const, currency: c })),
  ];
}

interface CurrencyItemProps {
  currency: Currency;
  isSelected: boolean;
  onSelect: (code: string) => void;
}

function CurrencyItem({ currency, isSelected, onSelect }: CurrencyItemProps) {
  const symbolFontSize =
    currency.symbol.length > 3 ? 11 : currency.symbol.length > 2 ? 12 : 16;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.currencyRow,
        isSelected && styles.currencyRowSelected,
        pressed && styles.currencyRowPressed,
      ]}
      onPress={() => onSelect(currency.code)}
      accessibilityRole="radio"
      accessibilityState={{ checked: isSelected }}
      accessibilityLabel={`${currency.name} ${currency.code}`}
    >
      <View
        style={[
          styles.symbolBadge,
          isSelected ? styles.symbolBadgeSelected : styles.symbolBadgeDefault,
        ]}
      >
        <Text
          style={[
            styles.symbolBadgeText,
            { fontSize: symbolFontSize },
            isSelected && styles.symbolBadgeTextSelected,
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {currency.symbol}
        </Text>
      </View>

      <View style={styles.currencyInfo}>
        <Text
          style={[styles.currencyName, isSelected && styles.currencyNameSelected]}
          numberOfLines={1}
        >
          {currency.name}
        </Text>
      </View>

      <Text style={[styles.currencyCode, isSelected && styles.currencyCodeSelected]}>
        {currency.code}
      </Text>

      {isSelected && (
        <View style={styles.checkmarkCircle}>
          <Check size={14} color={Colors.textInverse} strokeWidth={2.75} />
        </View>
      )}
    </Pressable>
  );
}

function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{label}</Text>
    </View>
  );
}

export default function CurrencyScreen() {
  const router = useRouter();
  const { updateSetting } = useSettingsStore();
  const [selected, setSelected] = useState('INR');
  const [search, setSearch] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const searchRef = useRef<React.ComponentRef<typeof TextInput>>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => searchRef.current?.focus(), 450);
    return () => clearTimeout(t);
  }, [fadeAnim]);

  const listData = useMemo(() => buildListData(search), [search]);

  const handleSelect = useCallback((code: string) => {
    setSelected(code);
    Keyboard.dismiss();
  }, []);

  const handleContinue = useCallback(async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await updateSetting('baseCurrency', selected);
      router.push('/(onboarding)/wallet-setup' as never);
    } catch (error) {
      console.error('Failed to save base currency:', error);
    } finally {
      setIsSaving(false);
    }
  }, [isSaving, selected, updateSetting, router]);

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'header') {
        return <SectionHeader label={item.label} />;
      }
      return (
        <CurrencyItem
          currency={item.currency}
          isSelected={selected === item.currency.code}
          onSelect={handleSelect}
        />
      );
    },
    [selected, handleSelect],
  );

  const keyExtractor = useCallback((item: ListItem) => {
    if (item.kind === 'header') return item.id;
    return item.currency.code;
  }, []);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
        <Animated.View style={[styles.flex, { opacity: fadeAnim }]}>
          {/* Header */}
          <View style={styles.header}>
            <Pressable
              style={({ pressed }) => [styles.backBtn, pressed && styles.backBtnPressed]}
              onPress={() => router.back()}
              accessibilityRole="button"
              accessibilityLabel="Go back"
              hitSlop={8}
            >
              <ChevronLeft size={22} color={Colors.textPrimary} strokeWidth={2.2} />
            </Pressable>
            <View style={styles.progressPill}>
              <Text style={styles.progress}>1 of 2</Text>
            </View>
          </View>

          {/* Title */}
          <View style={styles.titleBlock}>
            <Text style={styles.heading}>{"What's your base\ncurrency?"}</Text>
            <Text style={styles.subtitle}>You can change this later in settings</Text>
          </View>

          {/* Search */}
          <View style={styles.searchContainer}>
            <View style={styles.searchIconWrap}>
              <Search size={18} color={Colors.textSecondary} strokeWidth={2} />
            </View>
            <TextInput
              ref={searchRef}
              style={styles.searchInput}
              placeholder="Search currencies..."
              placeholderTextColor={Colors.textDisabled}
              value={search}
              onChangeText={setSearch}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
            />
            {search.length > 0 && (
              <Pressable
                style={styles.searchClearBtn}
                onPress={() => setSearch('')}
                accessibilityRole="button"
                accessibilityLabel="Clear search"
                hitSlop={6}
              >
                <View style={styles.searchClearCircle}>
                  <X size={13} color={Colors.textSecondary} strokeWidth={2.4} />
                </View>
              </Pressable>
            )}
          </View>

          {/* Currency list */}
          <FlatList
            data={listData}
            keyExtractor={keyExtractor}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            initialNumToRender={15}
            maxToRenderPerBatch={20}
            windowSize={10}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <View style={styles.emptyIconCircle}>
                  <Search size={22} color={Colors.textDisabled} strokeWidth={2} />
                </View>
                <Text style={styles.emptyText}>No currencies match &ldquo;{search.trim()}&rdquo;</Text>
              </View>
            }
          />

          {/* CTA */}
          <SafeAreaView edges={['bottom']} style={styles.ctaWrapper}>
            <Pressable
              style={({ pressed }) => [
                styles.ctaButton,
                pressed && styles.ctaButtonPressed,
                isSaving && styles.ctaButtonDisabled,
              ]}
              onPress={handleContinue}
              accessibilityRole="button"
              accessibilityLabel="Continue"
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator color={Colors.textInverse} size="small" />
              ) : (
                <>
                  <Text style={styles.ctaText}>Continue</Text>
                  <ArrowRight size={18} color={Colors.textInverse} strokeWidth={2.3} />
                </>
              )}
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

  // Title
  titleBlock: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.lg,
  },
  heading: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.sm,
    letterSpacing: -0.3,
    lineHeight: 31,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },

  // Search
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    marginHorizontal: Spacing['2xl'],
    marginBottom: Spacing.sm,
    paddingLeft: Spacing.md,
    paddingRight: Spacing.xs,
    height: 48,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  searchIconWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.xs,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    height: '100%',
  },
  searchClearBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchClearCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // List
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: Spacing['2xl'],
    paddingBottom: Spacing.xl,
  },
  sectionHeader: {
    paddingVertical: Spacing.sm,
    paddingTop: Spacing.lg,
  },
  sectionHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  currencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    paddingHorizontal: Spacing.md,
    minHeight: 62,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  currencyRowSelected: {
    borderColor: '#C6E8D5',
    backgroundColor: '#E5F4EC',
  },
  currencyRowPressed: {
    opacity: 0.8,
  },
  symbolBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  symbolBadgeDefault: {
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  symbolBadgeSelected: {
    backgroundColor: '#C6E8D5',
    borderWidth: 1,
    borderColor: '#B2E0C4',
  },
  symbolBadgeText: {
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  symbolBadgeTextSelected: {
    color: Colors.primary,
  },
  currencyInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  currencyName: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  currencyNameSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  currencyCode: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
  },
  currencyCodeSelected: {
    color: Colors.primary,
  },
  checkmarkCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // CTA
  ctaWrapper: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
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
  emptyState: {
    paddingVertical: Spacing['3xl'],
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  emptyIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
});
