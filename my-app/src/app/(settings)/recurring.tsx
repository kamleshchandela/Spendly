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
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '../../components/common/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { differenceInCalendarDays, format } from 'date-fns';
import * as Haptics from 'expo-haptics';
import {
  Bell,
  CheckCircle2,
  ChevronLeft,
  PauseCircle,
  PlayCircle,
  Plus,
  Repeat,
  Trash2,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Shapes } from '../../theme/shapes';
import { Shadows } from '../../theme/shadows';
import { Spacing } from '../../theme/spacing';
import { Card, EmptyState, LoadingState } from '../../components/common';
import { getDatabase } from '../../database/database';
import { RecurringRepository } from '../../database/repositories/RecurringRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { RecurringService } from '../../services/recurring/RecurringService';
import { renderCategoryIcon } from '../../services/recurring/iconHelper';
import { useSettingsStore } from '../../store/settingsStore';
import { useWalletStore } from '../../store/walletStore';
import { useTransactionStore } from '../../store/transactionStore';
import { formatCurrency } from '../../utils/currencyUtils';
import { RecurringPayment } from '../../types/recurring.types';
import { Category } from '../../types/category.types';
import { Wallet } from '../../types/wallet.types';

export default function RecurringPaymentsScreen() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const refreshBalances = useWalletStore((s) => s.refreshBalances);
  const loadTransactions = useTransactionStore((s) => s.loadTransactions);

  const currency = settings?.baseCurrency || 'INR';
  const numberFormat = settings?.numberFormat || 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  const hapticEnabled = settings?.hapticEnabled ?? true;

  const [items, setItems] = useState<RecurringPayment[]>([]);
  const [categoryMap, setCategoryMap] = useState<Record<string, Category>>({});
  const [walletMap, setWalletMap] = useState<Record<string, Wallet>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    try {
      const created = await RecurringService.processDueAutoCreate();
      if (created > 0) {
        await Promise.all([refreshBalances(), loadTransactions()]);
      }

      const db = await getDatabase();
      const recRepo = new RecurringRepository(db);
      const catRepo = new CategoryRepository(db);
      const walletRepo = new WalletRepository(db);

      const [allRecurring, allCategories, allWallets] = await Promise.all([
        recRepo.getAll(true),
        catRepo.getAll(undefined, true),
        walletRepo.getAll(true),
      ]);

      const cMap: Record<string, Category> = {};
      for (const c of allCategories) cMap[c.id] = c;

      const wMap: Record<string, Wallet> = {};
      for (const w of allWallets) wMap[w.id] = w;

      setItems(allRecurring);
      setCategoryMap(cMap);
      setWalletMap(wMap);
    } catch (error) {
      console.error('Failed to load recurring payments:', error);
    } finally {
      setIsLoading(false);
      setRefreshing(false);
    }
  }, [refreshBalances, loadTransactions]);

  useFocusEffect(
    useCallback(() => {
      loadData(items.length > 0);
    }, [loadData])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadData(true);
  }, [loadData]);

  const { upcomingItems, activeItems, inactiveItems } = useMemo(() => {
    const today = new Date();
    const upcoming: RecurringPayment[] = [];
    const active: RecurringPayment[] = [];
    const inactive: RecurringPayment[] = [];

    for (const item of items) {
      if (!item.isActive) {
        inactive.push(item);
        continue;
      }
      active.push(item);
      const daysUntil = differenceInCalendarDays(new Date(item.nextDueDate), today);
      if (daysUntil <= 7) {
        upcoming.push(item);
      }
    }

    return { upcomingItems: upcoming, activeItems: active, inactiveItems: inactive };
  }, [items]);

  const handleToggleActive = async (item: RecurringPayment) => {
    if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
    try {
      const db = await getDatabase();
      const recRepo = new RecurringRepository(db);
      await recRepo.toggleActive(item.id, !item.isActive);
      await loadData(true);
    } catch (error) {
      console.error('Toggle active failed:', error);
      Alert.alert('Error', 'Could not update recurring payment status.');
    }
  };

  const handleMarkPaid = (item: RecurringPayment) => {
    Alert.alert(
      'Log Payment Now',
      `Record ${formatCurrency(item.amountMinor, item.currencyCode || currency, numberFormat, decimalPlaces)} for "${item.title}" and advance the next due date?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log Payment',
          onPress: async () => {
            try {
              if (hapticEnabled) {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              }
              await RecurringService.markAsPaid(item);
              await Promise.all([refreshBalances(), loadTransactions(), loadData(true)]);
            } catch (error) {
              console.error('Mark as paid failed:', error);
              Alert.alert('Error', 'Failed to record payment.');
            }
          },
        },
      ]
    );
  };

  const handleDelete = (item: RecurringPayment) => {
    Alert.alert(
      'Delete Recurring Payment',
      `Remove "${item.title}"? Past transactions already logged will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              const recRepo = new RecurringRepository(db);
              await recRepo.delete(item.id);
              await loadData(true);
            } catch (error) {
              console.error('Delete recurring failed:', error);
              Alert.alert('Error', 'Could not delete recurring payment.');
            }
          },
        },
      ]
    );
  };

  const renderRecurringCard = (item: RecurringPayment, highlighted = false) => {
    const category = categoryMap[item.categoryId];
    const wallet = walletMap[item.walletId];
    const catColor = category?.color || Colors.primary;
    const catIcon = category?.iconName || 'repeat';

    const dueDate = new Date(item.nextDueDate);
    const daysLeft = differenceInCalendarDays(dueDate, new Date());
    const isUrgent = item.isActive && daysLeft <= 3;

    let badgeLabel = '';
    if (!item.isActive) {
      badgeLabel = 'Paused';
    } else if (daysLeft < 0) {
      badgeLabel = `${Math.abs(daysLeft)}d overdue`;
    } else if (daysLeft === 0) {
      badgeLabel = 'Due today';
    } else if (daysLeft === 1) {
      badgeLabel = 'Tomorrow';
    } else {
      badgeLabel = `In ${daysLeft}d`;
    }

    const freqText = RecurringService.getFrequencyLabel(
      item.frequency,
      item.frequencyDays,
      item.nextDueDate
    );

    return (
      <Card
        key={`${highlighted ? 'up' : 'all'}-${item.id}`}
        compact
        onPress={() =>
          router.push({
            pathname: '/modals/add-recurring',
            params: { id: item.id },
          } as never)
        }
        style={[
          styles.itemCard,
          highlighted && styles.highlightedCard,
          !item.isActive && styles.inactiveCard,
        ]}
      >
        <View style={styles.cardTopRow}>
          {/* Left: Category Icon */}
          <View style={[styles.catCircle, { backgroundColor: `${catColor}20` }]}>
            {renderCategoryIcon(catIcon, 20, catColor)}
          </View>

          {/* Center: Title, Frequency, Wallet */}
          <View style={styles.cardCenter}>
            <View style={styles.titleRow}>
              <Text style={styles.itemTitle} numberOfLines={1}>
                {item.title}
              </Text>
              {item.reminderEnabled && item.isActive ? (
                <Bell size={12} color={Colors.primary} />
              ) : null}
            </View>
            <Text style={styles.itemFreq} numberOfLines={1}>
              {freqText}
            </Text>
            <Text style={styles.itemWallet} numberOfLines={1}>
              {wallet?.name || 'Wallet'}
              {item.autoCreate ? ' · Auto-log' : ''}
            </Text>
          </View>

          {/* Right: Amount, Due Date, Days Badge */}
          <View style={styles.cardRight}>
            <Text style={styles.itemAmount}>
              {formatCurrency(
                item.amountMinor,
                item.currencyCode || currency,
                numberFormat,
                decimalPlaces
              )}
            </Text>
            <Text style={styles.itemDueDate}>
              {isNaN(dueDate.getTime()) ? '' : format(dueDate, 'dd MMM')}
            </Text>
            <View
              style={[
                styles.daysBadge,
                !item.isActive
                  ? styles.daysBadgeMuted
                  : isUrgent
                    ? styles.daysBadgeUrgent
                    : styles.daysBadgeNormal,
              ]}
            >
              <Text
                style={[
                  styles.daysBadgeText,
                  !item.isActive
                    ? styles.daysBadgeTextMuted
                    : isUrgent
                      ? styles.daysBadgeTextUrgent
                      : styles.daysBadgeTextNormal,
                ]}
              >
                {badgeLabel}
              </Text>
            </View>
          </View>
        </View>

        {/* Quick Actions Footer */}
        <View style={styles.cardActions}>
          {item.isActive ? (
            <Pressable
              onPress={() => handleMarkPaid(item)}
              style={({ pressed }) => [styles.actionChip, styles.payChip, pressed && styles.pressed]}
            >
              <CheckCircle2 size={14} color={Colors.primary} />
              <Text style={[styles.actionChipText, { color: Colors.primary }]}>Mark Paid</Text>
            </Pressable>
          ) : null}

          <Pressable
            onPress={() => handleToggleActive(item)}
            style={({ pressed }) => [styles.actionChip, pressed && styles.pressed]}
          >
            {item.isActive ? (
              <>
                <PauseCircle size={14} color={Colors.textSecondary} />
                <Text style={styles.actionChipText}>Pause</Text>
              </>
            ) : (
              <>
                <PlayCircle size={14} color={Colors.primary} />
                <Text style={[styles.actionChipText, { color: Colors.primary }]}>Resume</Text>
              </>
            )}
          </Pressable>

          <Pressable
            onPress={() => handleDelete(item)}
            style={({ pressed }) => [styles.actionChip, styles.deleteChip, pressed && styles.pressed]}
          >
            <Trash2 size={14} color={Colors.expense} />
          </Pressable>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Recurring Payments</Text>
        <Pressable
          onPress={() => {
            if (hapticEnabled) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
            router.push('/modals/add-recurring' as never);
          }}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add recurring payment"
        >
          <Plus size={20} color={Colors.textInverse} strokeWidth={2.5} />
        </Pressable>
      </View>

      {isLoading ? (
        <LoadingState message="Loading recurring payments..." />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Repeat size={32} color={Colors.primary} />}
            heading="No recurring payments yet"
            subtitle="Track subscriptions, rent, utilities, and regular bills with automatic reminders."
            ctaLabel="Add Recurring Payment"
            onCtaPress={() => router.push('/modals/add-recurring' as never)}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          {/* Section 1: Upcoming (Next 7 Days) */}
          {upcomingItems.length > 0 ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>UPCOMING (NEXT 7 DAYS)</Text>
                <Text style={styles.sectionCount}>{upcomingItems.length}</Text>
              </View>
              <View style={styles.cardsStack}>
                {upcomingItems.map((item) => renderRecurringCard(item, true))}
              </View>
            </View>
          ) : null}

          {/* Section 2: Active Recurring */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>ACTIVE RECURRING</Text>
              <Text style={styles.sectionCount}>{activeItems.length}</Text>
            </View>
            {activeItems.length === 0 ? (
              <Card compact>
                <Text style={styles.sectionEmptyText}>No active recurring items.</Text>
              </Card>
            ) : (
              <View style={styles.cardsStack}>
                {activeItems.map((item) => renderRecurringCard(item, false))}
              </View>
            )}
          </View>

          {/* Section 3: Inactive */}
          {inactiveItems.length > 0 ? (
            <View style={styles.sectionBlock}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionTitle}>INACTIVE</Text>
                <Text style={styles.sectionCount}>{inactiveItems.length}</Text>
              </View>
              <View style={styles.cardsStack}>
                {inactiveItems.map((item) => renderRecurringCard(item, false))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  iconBtn: {
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
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 100,
    gap: Spacing.xl,
  },
  sectionBlock: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  sectionEmptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.sm,
  },
  cardsStack: {
    gap: 12,
  },
  itemCard: {
    padding: 16,
    gap: 12,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  highlightedCard: {
    borderColor: '#C6E8D5',
    backgroundColor: '#FAFCFA',
  },
  inactiveCard: {
    opacity: 0.72,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  catCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardCenter: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    flexShrink: 1,
    letterSpacing: -0.2,
  },
  itemFreq: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  itemWallet: {
    fontSize: 11,
    color: Colors.textDisabled,
  },
  cardRight: {
    alignItems: 'flex-end',
    gap: 3,
  },
  itemAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  itemDueDate: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  daysBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 100,
    borderWidth: 1,
  },
  daysBadgeUrgent: {
    backgroundColor: Colors.expenseSoft,
    borderColor: '#FCDAD7',
  },
  daysBadgeNormal: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
  },
  daysBadgeMuted: {
    backgroundColor: '#F3F6F2',
    borderColor: '#EDF1EC',
  },
  daysBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  daysBadgeTextUrgent: {
    color: Colors.expense,
  },
  daysBadgeTextNormal: {
    color: Colors.primary,
  },
  daysBadgeTextMuted: {
    color: Colors.textSecondary,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: '#F0F4EF',
    paddingTop: 10,
  },
  actionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  payChip: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
  },
  deleteChip: {
    backgroundColor: Colors.expenseSoft,
    borderColor: '#FCDAD7',
    paddingHorizontal: 10,
  },
  actionChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pressed: {
    opacity: 0.72,
  },
});
