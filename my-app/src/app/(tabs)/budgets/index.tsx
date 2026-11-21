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
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Clock, Plus, Target } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { startOfDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from 'date-fns';
import { Colors, Shapes, Shadows, Spacing, Typography } from '../../../theme';
import { BudgetPeriodType, BudgetWithProgress } from '../../../types/budget.types';
import { getDatabase } from '../../../database/database';
import { BudgetRepository } from '../../../database/repositories/BudgetRepository';
import { useSettingsStore } from '../../../store/settingsStore';
import { formatCurrency } from '../../../utils/currencyUtils';
import { differenceInDays, formatDisplay } from '../../../utils/dateUtils';
import {
  Badge,
  BadgeStatus,
  Button,
  Chip,
  EmptyState,
  LoadingState,
  ProgressBar,
} from '../../../components/common';

type FilterPeriod = 'active' | 'month' | 'week' | 'all';

const FILTER_OPTIONS: Array<{ key: FilterPeriod; label: string }> = [
  { key: 'active', label: 'Active' },
  { key: 'month', label: 'This Month' },
  { key: 'week', label: 'This Week' },
  { key: 'all', label: 'All Time' },
];

const PERIOD_TYPE_LABELS: Record<BudgetPeriodType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  yearly: 'Yearly',
  custom: 'Custom',
};

function getBudgetStatus(percentage: number): { status: BadgeStatus; label: string } {
  if (percentage >= 90) {
    return { status: 'over-budget', label: 'Over Budget' };
  }
  if (percentage >= 70) {
    return { status: 'warning', label: 'Warning' };
  }
  return { status: 'on-track', label: 'On Track' };
}

function formatPeriodRange(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    const sameMonth =
      start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${formatDisplay(start, 'MMM d')} - ${formatDisplay(end, 'd')}`;
    }
    const sameYear = start.getFullYear() === end.getFullYear();
    if (sameYear) {
      return `${formatDisplay(start, 'MMM d')} - ${formatDisplay(end, 'MMM d')}`;
    }
    return `${formatDisplay(start, 'MMM d, yyyy')} - ${formatDisplay(end, 'MMM d, yyyy')}`;
  } catch {
    return '';
  }
}

function getDaysLeftText(endDateIso: string): string {
  const today = startOfDay(new Date());
  const endDay = startOfDay(new Date(endDateIso));
  const diff = differenceInDays(endDay, today);
  if (diff > 1) return `${diff} days left`;
  if (diff === 1) return '1 day left';
  if (diff === 0) return 'Ends today';
  const absDiff = Math.abs(diff);
  return absDiff === 1 ? 'Ended 1 day ago' : `Ended ${absDiff} days ago`;
}

export default function BudgetsListScreen() {
  const router = useRouter();
  const { settings } = useSettingsStore();
  const [budgets, setBudgets] = useState<BudgetWithProgress[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<FilterPeriod>('active');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const numberFormat = settings?.numberFormat ?? 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 0;

  const loadBudgets = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const db = await getDatabase();
      const repo = new BudgetRepository(db);
      const allBudgets = await repo.getAll(true);
      setBudgets(allBudgets);
    } catch (error) {
      console.error('Failed to load budgets:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadBudgets(budgets.length === 0);
    }, [loadBudgets])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadBudgets(false);
  }, [loadBudgets]);

  const filteredBudgets = useMemo(() => {
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    switch (selectedFilter) {
      case 'active':
        return budgets.filter((b) => b.isActive);
      case 'month':
        return budgets.filter((b) => {
          const start = new Date(b.startDate);
          const end = new Date(b.endDate);
          return start <= monthEnd && end >= monthStart;
        });
      case 'week':
        return budgets.filter((b) => {
          const start = new Date(b.startDate);
          const end = new Date(b.endDate);
          return start <= weekEnd && end >= weekStart;
        });
      case 'all':
      default:
        return budgets;
    }
  }, [budgets, selectedFilter]);

  const handleCreateBudget = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    router.push('/modals/add-budget' as never);
  };

  const handleOpenDetail = (budgetId: string) => {
    Haptics.selectionAsync().catch(() => {});
    router.push(`/(tabs)/budgets/${budgetId}` as never);
  };

  const renderBudgetCard = ({ item }: { item: BudgetWithProgress }) => {
    const { status, label } = getBudgetStatus(item.percentage);
    const periodLabel = `${PERIOD_TYPE_LABELS[item.periodType]} · ${formatPeriodRange(
      item.startDate,
      item.endDate
    )}`;
    const isOver = item.percentage > 100 || item.remainingMinor < 0;
    const spentFormatted = formatCurrency(
      item.usedMinor,
      item.currencyCode,
      numberFormat,
      decimalPlaces
    );
    const totalFormatted = formatCurrency(
      item.amountMinor,
      item.currencyCode,
      numberFormat,
      decimalPlaces
    );
    const remainingAbsFormatted = formatCurrency(
      Math.abs(item.remainingMinor),
      item.currencyCode,
      numberFormat,
      decimalPlaces
    );
    const daysText = getDaysLeftText(item.endDate);

    return (
      <Pressable
        onPress={() => handleOpenDetail(item.id)}
        accessibilityRole="button"
        accessibilityLabel={`${item.name} budget`}
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      >
        {/* TOP ROW */}
        <View style={styles.topRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.budgetName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.periodLabel} numberOfLines={1}>
              {periodLabel}
            </Text>
          </View>
          <Badge status={status} label={label} />
        </View>

        {/* AMOUNT ROW */}
        <View style={styles.amountRow}>
          <Text style={styles.spentText}>{spentFormatted} spent</Text>
          <Text style={styles.totalText}>of {totalFormatted}</Text>
        </View>

        {/* PROGRESS BAR */}
        <View style={styles.progressRow}>
          <View style={styles.progressBarWrap}>
            <ProgressBar
              percentage={item.percentage}
              height={8}
              trackColor="#EDF2EC"
            />
          </View>
          {item.percentage > 100 && (
            <View style={styles.overBadge}>
              <Text style={styles.overBadgeText}>OVER</Text>
            </View>
          )}
        </View>

        {/* BOTTOM ROW */}
        <View style={styles.bottomRow}>
          <Text
            style={[
              styles.remainingText,
              { color: isOver ? Colors.expense : Colors.primary },
            ]}
          >
            {isOver
              ? `${remainingAbsFormatted} over`
              : `${remainingAbsFormatted} remaining`}
          </Text>
          <View style={styles.daysBadge}>
            <Clock size={13} color={Colors.textSecondary} />
            <Text style={styles.daysText}>{daysText}</Text>
          </View>
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Budgets</Text>
        <Pressable
          onPress={handleCreateBudget}
          hitSlop={6}
          accessibilityRole="button"
          accessibilityLabel="Create new budget"
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
        >
          <Plus size={20} color={Colors.primary} strokeWidth={2.2} />
        </Pressable>
      </View>

      {/* PERIOD FILTER ROW */}
      <View style={styles.filterContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScrollContent}
        >
          {FILTER_OPTIONS.map((option) => (
            <Chip
              key={option.key}
              label={option.label}
              active={selectedFilter === option.key}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setSelectedFilter(option.key);
              }}
            />
          ))}
        </ScrollView>
      </View>

      {/* BODY */}
      {isLoading ? (
        <LoadingState message="Loading budgets..." />
      ) : filteredBudgets.length === 0 ? (
        <ScrollView
          contentContainerStyle={styles.emptyScroll}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        >
          <View style={styles.emptyWrap}>
            <EmptyState
              icon={<Target size={30} color={Colors.primary} strokeWidth={2} />}
              heading={
                budgets.length === 0
                  ? 'No budgets yet'
                  : `No budgets in "${
                      FILTER_OPTIONS.find((f) => f.key === selectedFilter)?.label ?? ''
                    }"`
              }
              subtitle={
                budgets.length === 0
                  ? 'Create a monthly budget to track your spending'
                  : 'Try switching the filter or create a new budget for this period'
              }
              style={styles.emptyInner}
            />
            <Button
              title="Create Budget"
              icon={<Plus size={18} color={Colors.textInverse} strokeWidth={2.5} />}
              onPress={handleCreateBudget}
              fullWidth={false}
              style={styles.emptyCta}
            />
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={filteredBudgets}
          keyExtractor={(item) => item.id}
          renderItem={renderBudgetCard}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerTitle: {
    ...Typography.titleLg,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  addButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  addButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  filterContainer: {
    marginBottom: Spacing.sm,
  },
  filterScrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.xs,
    gap: 8,
  },
  listContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: 160,
    gap: 12,
  },
  emptyScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: 130,
  },
  emptyWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyInner: {
    paddingBottom: Spacing.lg,
  },
  emptyCta: {
    paddingHorizontal: Spacing['2xl'],
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  cardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  titleBlock: {
    flex: 1,
  },
  budgetName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 3,
  },
  periodLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  spentText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  totalText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 14,
  },
  progressBarWrap: {
    flex: 1,
  },
  overBadge: {
    backgroundColor: Colors.expenseSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#F5C6C6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.expense,
    letterSpacing: 0.5,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  remainingText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.1,
  },
  daysBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: '#FAFBF9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  daysText: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
});
