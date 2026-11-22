/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
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
import * as Haptics from 'expo-haptics';
import { Check, ChevronLeft, Search } from 'lucide-react-native';
import { CURRENCIES, POPULAR_CURRENCIES, type Currency } from '../../constants/currencies';
import { useSettingsStore } from '../../store/settingsStore';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/shadows';
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
        c.symbol.includes(q)
    );
    return results.map((c) => ({ kind: 'currency' as const, currency: c }));
  }

  const popularCodes = new Set(POPULAR_CURRENCIES.map((c) => c.code));
  const rest = CURRENCIES.filter((c) => !popularCodes.has(c.code)).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return [
    { kind: 'header', label: 'Popular', id: 'h-popular' },
    ...POPULAR_CURRENCIES.map((c) => ({ kind: 'currency' as const, currency: c })),
    { kind: 'header', label: 'All Currencies', id: 'h-all' },
    ...rest.map((c) => ({ kind: 'currency' as const, currency: c })),
  ];
}

export default function CurrencySettingsScreen() {
  const router = useRouter();
  const { settings, updateSetting } = useSettingsStore();
  const currentCode = settings?.baseCurrency || 'INR';
  const hapticEnabled = settings?.hapticEnabled ?? true;

  const [search, setSearch] = useState('');
  const listData = useMemo(() => buildListData(search), [search]);

  const handleSelect = useCallback(
    async (code: string) => {
      if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
      Keyboard.dismiss();
      await updateSetting('baseCurrency', code);
      router.back();
    },
    [hapticEnabled, updateSetting, router]
  );

  const renderItem = useCallback(
    ({ item }: { item: ListItem }) => {
      if (item.kind === 'header') {
        return (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{item.label}</Text>
          </View>
        );
      }

      const isSelected = currentCode === item.currency.code;
      return (
        <Pressable
          style={({ pressed }) => [
            styles.currencyRow,
            isSelected && styles.currencyRowSelected,
            pressed && styles.currencyRowPressed,
          ]}
          onPress={() => handleSelect(item.currency.code)}
          accessibilityRole="radio"
          accessibilityState={{ checked: isSelected }}
          accessibilityLabel={`${item.currency.name} ${item.currency.code}`}
        >
          <View
            style={[
              styles.symbolBadge,
              isSelected ? styles.symbolBadgeSelected : styles.symbolBadgeUnselected,
            ]}
          >
            <Text
              style={[
                styles.symbolBadgeText,
                isSelected && styles.symbolBadgeTextSelected,
              ]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {item.currency.symbol}
            </Text>
          </View>
          <View style={styles.currencyInfo}>
            <Text style={[styles.currencyName, isSelected && styles.currencyNameSelected]}>
              {item.currency.name}
            </Text>
            <Text style={[styles.currencyCodeSub, isSelected && styles.currencyCodeSelected]}>
              {item.currency.code}
            </Text>
          </View>
          {isSelected ? (
            <View style={styles.checkmarkCircle}>
              <Check size={14} color={Colors.textInverse} strokeWidth={3} />
            </View>
          ) : null}
        </Pressable>
      );
    },
    [currentCode, handleSelect]
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
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel="Go back"
            hitSlop={8}
          >
            <ChevronLeft size={20} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Base Currency</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Search */}
        <View style={styles.searchContainer}>
          <Search size={18} color={Colors.textSecondary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search currencies (e.g. INR, USD, €)..."
            placeholderTextColor={Colors.textDisabled}
            value={search}
            onChangeText={setSearch}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
            returnKeyType="search"
          />
        </View>

        <FlatList
          data={listData}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          initialNumToRender={18}
          maxToRenderPerBatch={20}
          windowSize={10}
        />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    marginHorizontal: Spacing.xl,
    marginBottom: Spacing.md,
    paddingHorizontal: Spacing.md,
    height: 48,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    gap: Spacing.sm,
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    height: '100%',
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  sectionHeader: {
    paddingVertical: Spacing.xs,
    paddingTop: Spacing.sm,
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
    height: 62,
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
    opacity: 0.78,
  },
  symbolBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  symbolBadgeSelected: {
    backgroundColor: '#C6E8D5',
  },
  symbolBadgeUnselected: {
    backgroundColor: '#F3F6F2',
  },
  symbolBadgeText: {
    fontSize: 16,
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
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  currencyNameSelected: {
    color: Colors.primary,
  },
  currencyCodeSub: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    marginTop: 2,
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
  pressed: {
    opacity: 0.72,
  },
});
