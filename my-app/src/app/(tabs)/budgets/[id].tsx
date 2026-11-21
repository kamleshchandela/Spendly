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
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '../../../components/common/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, G } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { startOfDay } from 'date-fns';
import {
  Baby,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Camera,
  Car,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coffee,
  Dog,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  MoreVertical,
  Music,
  Package,
  Pencil,
  PieChart,
  Pizza,
  Plane,
  Printer,
  Repeat,
  Scissors,
  Search,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sprout,
  Train,
  Trash2,
  TrendingUp,
  Tv,
  Utensils,
  Watch,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react-native';
import { Colors, Shapes, Shadows, Spacing } from '../../../theme';
import { BudgetWithProgress } from '../../../types/budget.types';
import { Category } from '../../../types/category.types';
import { TransactionWithDetails } from '../../../types/transaction.types';
import { getDatabase } from '../../../database/database';
import { BudgetRepository } from '../../../database/repositories/BudgetRepository';
import { CategoryRepository } from '../../../database/repositories/CategoryRepository';
import { TransactionRepository } from '../../../database/repositories/TransactionRepository';
import { FinanceCalculator } from '../../../services/finance/FinanceCalculator';
import { useBudgetStore } from '../../../store/budgetStore';
import { useSettingsStore } from '../../../store/settingsStore';
import { formatCurrency } from '../../../utils/currencyUtils';
import {
  differenceInDays,
  formatDisplay,
  formatRelative,
  formatTime,
} from '../../../utils/dateUtils';
import {
  Badge,
  BadgeStatus,
  EmptyState,
  LoadingState,
  ProgressBar,
  getProgressColor,
} from '../../../components/common';

interface CategoryBreakdownItem {
  category: Category;
  spentMinor: number;
  percentageOfBudget: number;
}

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  utensils: Utensils,
  'shopping-cart': ShoppingCart,
  car: Car,
  fuel: Fuel,
  'shopping-bag': ShoppingBag,
  zap: Zap,
  home: Home,
  'heart-pulse': HeartPulse,
  'book-open': BookOpen,
  film: Film,
  plane: Plane,
  scissors: Scissors,
  smartphone: Smartphone,
  gift: Gift,
  package: Package,
  briefcase: Briefcase,
  'building-2': Building2,
  laptop: Laptop,
  'trending-up': TrendingUp,
  repeat: Repeat,
  coffee: Coffee,
  music: Music,
  'gamepad-2': Gamepad2,
  dumbbell: Dumbbell,
  baby: Baby,
  dog: Dog,
  plant: Sprout,
  wrench: Wrench,
  shield: Shield,
  'graduation-cap': GraduationCap,
  bus: Bus,
  train: Train,
  bike: Bike,
  pizza: Pizza,
  beer: Beer,
  shirt: Shirt,
  watch: Watch,
  camera: Camera,
  tv: Tv,
  wifi: Wifi,
  printer: Printer,
  tool: Wrench,
};

function CategoryIcon({
  iconName,
  size = 18,
  color = Colors.textPrimary,
}: {
  iconName?: string;
  size?: number;
  color?: string;
}) {
  const IconComp = (iconName && ICON_MAP[iconName]) || Package;
  return <IconComp size={size} color={color} />;
}

function getBudgetStatus(percentage: number): { status: BadgeStatus; label: string } {
  if (percentage >= 90) {
    return { status: 'over-budget', label: 'Over Budget' };
  }
  if (percentage >= 70) {
    return { status: 'warning', label: 'Warning' };
  }
  return { status: 'on-track', label: 'On Track' };
}

function formatDetailPeriod(startIso: string, endIso: string): string {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (start.getFullYear() === end.getFullYear()) {
      return `${formatDisplay(start, 'MMM d')} - ${formatDisplay(end, 'MMM d, yyyy')}`;
    }
    return `${formatDisplay(start, 'MMM d, yyyy')} - ${formatDisplay(end, 'MMM d, yyyy')}`;
  } catch {
    return '';
  }
}

function getDaysStatusLabel(endDateIso: string): { text: string; isEnded: boolean } {
  const today = startOfDay(new Date());
  const endDay = startOfDay(new Date(endDateIso));
  const diff = differenceInDays(endDay, today);
  if (diff > 1) return { text: `${diff} days`, isEnded: false };
  if (diff === 1) return { text: '1 day', isEnded: false };
  if (diff === 0) return { text: 'Ends today', isEnded: false };
  const absDiff = Math.abs(diff);
  return {
    text: absDiff === 1 ? 'Ended 1 day ago' : `Ended ${absDiff} days ago`,
    isEnded: true,
  };
}

export default function BudgetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { settings } = useSettingsStore();
  const { loadBudgets } = useBudgetStore();

  const [budget, setBudget] = useState<BudgetWithProgress | null>(null);
  const [categoryBreakdown, setCategoryBreakdown] = useState<CategoryBreakdownItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);

  const numberFormat = settings?.numberFormat ?? 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 0;

  const loadDetail = useCallback(
    async (showSpinner = false) => {
      if (!id) return;
      if (showSpinner) setIsLoading(true);
      try {
        const db = await getDatabase();
        const budgetRepo = new BudgetRepository(db);
        const txRepo = new TransactionRepository(db);
        const catRepo = new CategoryRepository(db);

        const found = await budgetRepo.getById(id);
        setBudget(found);

        if (!found) {
          setCategoryBreakdown([]);
          setTransactions([]);
          return;
        }

        if (!found.applyToAllCats && found.categoryIds.length === 0) {
          setTransactions([]);
        } else {
          const txs = await txRepo.getAll({
            type: 'expense',
            startDate: found.startDate,
            endDate: found.endDate,
            categoryIds: found.applyToAllCats ? undefined : found.categoryIds,
            sortBy: 'date_desc',
            limit: 20,
          });
          setTransactions(txs);
        }

        if (!found.applyToAllCats && found.categoryIds.length > 0) {
          const allCats = await catRepo.getAll('expense', true);
          const catMap = new Map(allCats.map((c) => [c.id, c]));
          const items: CategoryBreakdownItem[] = [];

          for (const catId of found.categoryIds) {
            const category = catMap.get(catId);
            if (!category) continue;
            const spentMinor = await FinanceCalculator.getCategorySpending(
              catId,
              found.startDate,
              found.endDate
            );
            const percentageOfBudget =
              found.amountMinor > 0 ? (spentMinor / found.amountMinor) * 100 : 0;
            items.push({ category, spentMinor, percentageOfBudget });
          }

          items.sort((a, b) => b.spentMinor - a.spentMinor);
          setCategoryBreakdown(items);
        } else {
          setCategoryBreakdown([]);
        }
      } catch (error) {
        console.error('Failed to load budget detail:', error);
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      loadDetail(!budget);
    }, [loadDetail])
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    loadDetail(false);
  }, [loadDetail]);

  const stats = useMemo(() => {
    if (!budget) {
      return { dailyAverageMinor: 0, projectedMinor: 0, daysLabel: '', isEnded: false };
    }
    const start = startOfDay(new Date(budget.startDate));
    const end = startOfDay(new Date(budget.endDate));
    const today = startOfDay(new Date());

    const totalDays = Math.max(1, differenceInDays(end, start) + 1);
    const effectiveEnd = today < end ? today : end;
    const elapsedDays =
      today < start ? 1 : Math.max(1, differenceInDays(effectiveEnd, start) + 1);

    const dailyAverageMinor = Math.round(budget.usedMinor / elapsedDays);
    const projectedMinor = Math.round(dailyAverageMinor * totalDays);
    const daysInfo = getDaysStatusLabel(budget.endDate);

    return {
      dailyAverageMinor,
      projectedMinor,
      daysLabel: daysInfo.text,
      isEnded: daysInfo.isEnded,
    };
  }, [budget]);

  const handleEdit = () => {
    setMenuVisible(false);
    if (!budget) return;
    router.push(`/modals/add-budget?id=${budget.id}` as never);
  };

  const handleDeletePress = () => {
    setMenuVisible(false);
    if (!budget) return;

    Alert.alert(
      'Delete Budget',
      `Are you sure you want to delete "${budget.name}"? Your transactions will not be affected.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              const repo = new BudgetRepository(db);
              await repo.delete(budget.id);
              await loadBudgets();
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              router.back();
            } catch (error) {
              console.error('Failed to delete budget:', error);
              Alert.alert('Error', 'Could not delete this budget. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleSeeAllTransactions = () => {
    router.push('/(tabs)/transactions' as never);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={6}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Budget</Text>
          <View style={styles.iconButtonPlaceholder} />
        </View>
        <LoadingState message="Loading budget details..." />
      </SafeAreaView>
    );
  }

  if (!budget) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={6}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ChevronLeft size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Budget</Text>
          <View style={styles.iconButtonPlaceholder} />
        </View>
        <EmptyState
          icon={<Search size={28} color={Colors.primary} strokeWidth={2} />}
          heading="Budget not found"
          subtitle="This budget may have been deleted."
          ctaLabel="Go Back"
          onCtaPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const { status, label } = getBudgetStatus(budget.percentage);
  const ringColor = getProgressColor(budget.percentage);
  const isOver = budget.remainingMinor < 0;
  const isProjectedOver = stats.projectedMinor > budget.amountMinor;

  // Donut Ring SVG math (160x160, stroke 12px)
  const ringSize = 160;
  const strokeWidth = 12;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedPct = Math.max(0, Math.min(100, budget.percentage));
  const strokeDashoffset = circumference - (circumference * clampedPct) / 100;

  const spentFormatted = formatCurrency(
    budget.usedMinor,
    budget.currencyCode,
    numberFormat,
    decimalPlaces
  );
  const totalFormatted = formatCurrency(
    budget.amountMinor,
    budget.currencyCode,
    numberFormat,
    decimalPlaces
  );
  const remainingAbsFormatted = formatCurrency(
    Math.abs(budget.remainingMinor),
    budget.currencyCode,
    numberFormat,
    decimalPlaces
  );
  const dailyAvgFormatted = formatCurrency(
    stats.dailyAverageMinor,
    budget.currencyCode,
    numberFormat,
    decimalPlaces
  );
  const projectedFormatted = formatCurrency(
    stats.projectedMinor,
    budget.currencyCode,
    numberFormat,
    decimalPlaces
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {budget.name}
        </Text>
        <Pressable
          onPress={() => {
            Haptics.selectionAsync().catch(() => {});
            setMenuVisible(true);
          }}
          hitSlop={6}
          style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Budget options"
        >
          <MoreVertical size={20} color={Colors.textPrimary} />
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* SECTION A & B — OVERVIEW CARD + SPENDING SUMMARY */}
        <View style={styles.card}>
          <View style={styles.overviewTopRow}>
            <View style={styles.overviewTitleWrap}>
              <Text style={styles.overviewTitle}>{budget.name}</Text>
              <Text style={styles.overviewPeriod}>
                {formatDetailPeriod(budget.startDate, budget.endDate)}
              </Text>
            </View>
            <Badge status={status} label={label} />
          </View>

          {/* 160x160 Circular Progress Ring */}
          <View style={styles.ringOuterWrap}>
            <View style={[styles.ringContainer, { width: ringSize, height: ringSize }]}>
              <Svg width={ringSize} height={ringSize}>
                <G rotation="-90" origin={`${ringSize / 2}, ${ringSize / 2}`}>
                  <Circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    stroke="#EDF2EC"
                    strokeWidth={strokeWidth}
                    fill="transparent"
                  />
                  <Circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    stroke={ringColor}
                    strokeWidth={strokeWidth}
                    strokeDasharray={`${circumference} ${circumference}`}
                    strokeDashoffset={strokeDashoffset}
                    strokeLinecap="round"
                    fill="transparent"
                  />
                </G>
              </Svg>
              <View style={styles.ringCenter} pointerEvents="none">
                <Text style={[styles.ringPercent, { color: ringColor }]}>
                  {Math.round(budget.percentage)}%
                </Text>
                <Text style={styles.ringSubLabel}>
                  {budget.percentage > 100 ? 'over limit' : 'used'}
                </Text>
              </View>
            </View>
          </View>

          {/* Section B — Spending Summary */}
          <View style={styles.summaryBlock}>
            <Text style={[styles.summarySpent, { color: ringColor }]}>
              {spentFormatted} spent
            </Text>
            <Text style={styles.summaryTotal}>of {totalFormatted} total budget</Text>
            <View
              style={[
                styles.remainingPill,
                { backgroundColor: isOver ? Colors.expenseSoft : Colors.primarySoft },
              ]}
            >
              <Text
                style={[
                  styles.remainingPillText,
                  { color: isOver ? Colors.expense : Colors.primary },
                ]}
              >
                {isOver
                  ? `${remainingAbsFormatted} over budget`
                  : `${remainingAbsFormatted} remaining`}
              </Text>
            </View>
          </View>
        </View>

        {/* SECTION C — BUDGET STATS */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Budget Stats</Text>

          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <View style={[styles.statIconWrap, { backgroundColor: Colors.primarySoft }]}>
                <TrendingUp size={16} color={Colors.primary} />
              </View>
              <Text style={styles.statLabel}>Daily Average</Text>
            </View>
            <Text style={styles.statValue}>{dailyAvgFormatted} / day</Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <View
                style={[
                  styles.statIconWrap,
                  { backgroundColor: isProjectedOver ? Colors.expenseSoft : Colors.warningSoft },
                ]}
              >
                <PieChart
                  size={16}
                  color={isProjectedOver ? Colors.expense : Colors.warning}
                />
              </View>
              <View>
                <Text style={styles.statLabel}>Projected Spend</Text>
                <Text style={styles.statHint}>At current spending pace</Text>
              </View>
            </View>
            <Text
              style={[
                styles.statValue,
                isProjectedOver && { color: Colors.expense },
              ]}
            >
              {projectedFormatted}
            </Text>
          </View>
          <View style={styles.divider} />

          <View style={styles.statRow}>
            <View style={styles.statLeft}>
              <View style={[styles.statIconWrap, { backgroundColor: Colors.secondarySoft }]}>
                <Clock size={16} color={Colors.secondary} />
              </View>
              <Text style={styles.statLabel}>Days Left</Text>
            </View>
            <Text
              style={[
                styles.statValue,
                stats.isEnded && { color: Colors.textSecondary },
              ]}
            >
              {stats.daysLabel}
            </Text>
          </View>
        </View>

        {/* SECTION D — CATEGORY BREAKDOWN (if not apply_to_all_cats) */}
        {!budget.applyToAllCats && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Category Breakdown</Text>
            {categoryBreakdown.length === 0 ? (
              <Text style={styles.emptySectionText}>No categories assigned to this budget.</Text>
            ) : (
              categoryBreakdown.map((item, index) => (
                <View key={item.category.id}>
                  <View style={styles.categoryRow}>
                    <View
                      style={[
                        styles.categoryIconCircle,
                        { backgroundColor: `${item.category.color}20` },
                      ]}
                    >
                      <CategoryIcon
                        iconName={item.category.iconName}
                        size={18}
                        color={item.category.color}
                      />
                    </View>
                    <View style={styles.categoryContent}>
                      <View style={styles.categoryTopLine}>
                        <Text style={styles.categoryName} numberOfLines={1}>
                          {item.category.name}
                        </Text>
                        <Text style={styles.categoryAmount}>
                          {formatCurrency(
                            item.spentMinor,
                            budget.currencyCode,
                            numberFormat,
                            decimalPlaces
                          )}
                        </Text>
                      </View>
                      <ProgressBar
                        percentage={item.percentageOfBudget}
                        height={7}
                        colorOverride={item.category.color}
                        trackColor={Colors.border}
                      />
                    </View>
                  </View>
                  {index < categoryBreakdown.length - 1 && <View style={styles.divider} />}
                </View>
              ))
            )}
          </View>
        )}

        {/* SECTION E — TRANSACTIONS IN BUDGET */}
        <View style={styles.card}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Transactions</Text>
            <Text style={styles.sectionCount}>
              {transactions.length > 0 ? `Last ${transactions.length}` : '0'}
            </Text>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyTxWrap}>
              <Text style={styles.emptySectionText}>
                No expenses recorded for this budget period yet.
              </Text>
            </View>
          ) : (
            transactions.map((tx, index) => {
              const catColor = tx.categoryColor ?? Colors.textSecondary;
              return (
                <View key={tx.id}>
                  <View style={styles.txRow}>
                    <View
                      style={[
                        styles.txIconCircle,
                        { backgroundColor: `${catColor}20` },
                      ]}
                    >
                      <CategoryIcon
                        iconName={tx.categoryIcon}
                        size={18}
                        color={catColor}
                      />
                    </View>

                    <View style={styles.txMiddle}>
                      <Text style={styles.txTitle} numberOfLines={1}>
                        {tx.title || tx.categoryName || 'Expense'}
                      </Text>
                      <Text style={styles.txMeta} numberOfLines={1}>
                        {[
                          tx.categoryName ?? 'Uncategorized',
                          tx.walletName,
                          `${formatRelative(tx.transactionDate)} · ${formatTime(tx.transactionDate)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </View>

                    <Text style={styles.txAmount}>
                      -
                      {formatCurrency(
                        tx.amountMinor,
                        tx.currencyCode,
                        numberFormat,
                        decimalPlaces
                      )}
                    </Text>
                  </View>
                  {index < transactions.length - 1 && <View style={styles.divider} />}
                </View>
              );
            })
          )}

          <Pressable
            onPress={handleSeeAllTransactions}
            style={({ pressed }) => [styles.seeAllButton, pressed && styles.pressed]}
            accessibilityRole="button"
          >
            <Text style={styles.seeAllText}>See all transactions</Text>
            <ChevronRight size={16} color={Colors.primary} strokeWidth={2.25} />
          </Pressable>
        </View>
      </ScrollView>

      {/* 3-DOT ACTION SHEET MODAL */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setMenuVisible(false)}>
          <Pressable style={styles.actionSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>{budget.name}</Text>

            <Pressable
              onPress={handleEdit}
              style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            >
              <View style={[styles.sheetIconWrap, { backgroundColor: Colors.primarySoft }]}>
                <Pencil size={18} color={Colors.primary} />
              </View>
              <Text style={styles.sheetRowText}>Edit Budget</Text>
            </Pressable>

            <Pressable
              onPress={handleDeletePress}
              style={({ pressed }) => [styles.sheetRow, pressed && styles.sheetRowPressed]}
            >
              <View style={[styles.sheetIconWrap, { backgroundColor: Colors.expenseSoft }]}>
                <Trash2 size={18} color={Colors.expense} />
              </View>
              <Text style={[styles.sheetRowText, { color: Colors.expense }]}>
                Delete Budget
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setMenuVisible(false)}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.pressed]}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  iconButton: {
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
  iconButtonPlaceholder: {
    width: 42,
    height: 42,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    marginHorizontal: Spacing.sm,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 150,
    gap: 14,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  overviewTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  overviewTitleWrap: {
    flex: 1,
  },
  overviewTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  overviewPeriod: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  ringOuterWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  ringContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ringCenter: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPercent: {
    fontSize: 32,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  ringSubLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 2,
    textAlign: 'center',
  },
  summaryBlock: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#F0F4EF',
  },
  summarySpent: {
    fontSize: 24,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  summaryTotal: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    fontVariant: ['tabular-nums'],
  },
  remainingPill: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  remainingPillText: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.1,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: Spacing.sm,
  },
  sectionCount: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    gap: Spacing.sm,
  },
  statLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  statIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  statHint: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  statValue: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F4EF',
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  categoryIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryContent: {
    flex: 1,
    gap: Spacing.sm,
  },
  categoryTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 0.1,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  emptyTxWrap: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  emptySectionText: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  txIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txMiddle: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
    marginBottom: 2,
  },
  txMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.expense,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    marginTop: Spacing.md,
    borderRadius: 14,
    backgroundColor: '#FAFBF9',
    borderWidth: 1,
    borderColor: '#EDF2EC',
    minHeight: 46,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 32, 25, 0.45)',
    justifyContent: 'flex-end',
  },
  actionSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    ...Shadows.bottomSheet,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D8DED7',
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    letterSpacing: -0.2,
  },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 16,
    minHeight: 52,
  },
  sheetRowPressed: {
    backgroundColor: '#F8FAF8',
  },
  sheetIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetRowText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 0.1,
  },
  cancelButton: {
    marginTop: Spacing.md,
    height: 50,
    borderRadius: 16,
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
});
