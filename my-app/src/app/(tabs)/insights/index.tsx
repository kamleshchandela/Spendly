/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  differenceInDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
  subMonths,
  subWeeks,
  subYears,
} from 'date-fns';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import * as Haptics from 'expo-haptics';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Flame,
  Settings,
  TrendingDown,
  TrendingUp,
  Wallet,
  X,
} from 'lucide-react-native';
import { Colors } from '../../../theme/colors';
import { Shapes } from '../../../theme/shapes';
import { Shadows } from '../../../theme/shadows';
import { Spacing } from '../../../theme/spacing';
import { Card, Chip, EmptyState, Input, LoadingState, ProgressBar, Button } from '../../../components/common';
import { getDatabase } from '../../../database/database';
import { TransactionRepository } from '../../../database/repositories/TransactionRepository';
import { WalletRepository } from '../../../database/repositories/WalletRepository';
import { FinanceCalculator } from '../../../services/finance/FinanceCalculator';
import { useSettingsStore } from '../../../store/settingsStore';
import { useTabBarStore } from '../../../store/tabBarStore';
import { formatCurrency, fromMinorUnits } from '../../../utils/currencyUtils';
import { pluralize } from '../../../utils/formatUtils';
import { renderCategoryIcon } from '../../../services/recurring/iconHelper';
import { TransactionWithDetails } from '../../../types/transaction.types';
import { Wallet as WalletModel } from '../../../types/wallet.types';

type InsightPeriod = 'day' | 'week' | 'month' | 'year' | 'custom';

interface PeriodBounds {
  start: Date;
  end: Date;
  prevStart: Date;
  prevEnd: Date;
  label: string;
}

interface MonthlyBarBucket {
  monthLabel: string;
  fullLabel: string;
  incomeMinor: number;
  expenseMinor: number;
}

interface CategoryBreakdownRow {
  categoryId: string;
  categoryName: string;
  categoryColor: string;
  categoryIcon: string;
  amountMinor: number;
  percentage: number;
  transactionCount: number;
}

interface TopExpenseDay {
  dateKey: string;
  displayDate: string;
  dayName: string;
  totalMinor: number;
  count: number;
}

interface SelectedBarTooltip {
  label: string;
  type: 'Income' | 'Expense';
  amountMinor: number;
}

interface WalletComparisonRow {
  wallet: WalletModel;
  balanceMinor: number;
}

const SCREEN_WIDTH = Dimensions.get('window').width;
const CHART_WIDTH = Math.max(240, SCREEN_WIDTH - Spacing.lg * 4 - 44);

const PERIOD_OPTIONS: Array<{ key: InsightPeriod; label: string }> = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'custom', label: 'Custom' },
];

function computePeriodBounds(
  period: InsightPeriod,
  anchorDate: Date,
  customStart: Date,
  customEnd: Date,
  firstDayOfWeek: number
): PeriodBounds {
  const weekStartsOn = (firstDayOfWeek === 0 ? 0 : 1) as 0 | 1;

  switch (period) {
    case 'day': {
      const start = startOfDay(anchorDate);
      const end = endOfDay(anchorDate);
      const prevAnchor = subDays(anchorDate, 1);
      return {
        start,
        end,
        prevStart: startOfDay(prevAnchor),
        prevEnd: endOfDay(prevAnchor),
        label: format(anchorDate, 'EEE, dd MMM yyyy'),
      };
    }
    case 'week': {
      const start = startOfWeek(anchorDate, { weekStartsOn });
      const end = endOfWeek(anchorDate, { weekStartsOn });
      const prevAnchor = subWeeks(anchorDate, 1);
      return {
        start,
        end,
        prevStart: startOfWeek(prevAnchor, { weekStartsOn }),
        prevEnd: endOfWeek(prevAnchor, { weekStartsOn }),
        label: `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`,
      };
    }
    case 'month': {
      const start = startOfMonth(anchorDate);
      const end = endOfMonth(anchorDate);
      const prevAnchor = subMonths(anchorDate, 1);
      return {
        start,
        end,
        prevStart: startOfMonth(prevAnchor),
        prevEnd: endOfMonth(prevAnchor),
        label: format(anchorDate, 'MMMM yyyy'),
      };
    }
    case 'year': {
      const start = startOfYear(anchorDate);
      const end = endOfYear(anchorDate);
      const prevAnchor = subYears(anchorDate, 1);
      return {
        start,
        end,
        prevStart: startOfYear(prevAnchor),
        prevEnd: endOfYear(prevAnchor),
        label: format(anchorDate, 'yyyy'),
      };
    }
    case 'custom': {
      const start = startOfDay(customStart);
      const end = endOfDay(customEnd);
      const spanDays = Math.max(1, differenceInDays(end, start) + 1);
      const prevEnd = endOfDay(subDays(start, 1));
      const prevStart = startOfDay(subDays(prevEnd, spanDays - 1));
      return {
        start,
        end,
        prevStart,
        prevEnd,
        label: `${format(start, 'dd MMM')} – ${format(end, 'dd MMM yyyy')}`,
      };
    }
  }
}

function calcDeltaPercent(current: number, previous: number): number | null {
  if (previous === 0) {
    return current === 0 ? 0 : null;
  }
  return Math.round(((current - previous) / Math.abs(previous)) * 100);
}

function buildCumulativeTrendPoints(
  transactions: TransactionWithDetails[],
  start: Date,
  end: Date
): Array<{ value: number; label?: string }> {
  const expenses = transactions.filter((t) => t.type === 'expense');
  const totalDays = Math.max(1, differenceInDays(end, start) + 1);

  if (totalDays <= 1) {
    // Hourly buckets (4-hour slots) for a single day
    const slots = [0, 4, 8, 12, 16, 20, 23];
    let running = 0;
    return slots.map((hour, idx) => {
      const prevHour = idx === 0 ? -1 : slots[idx - 1];
      const bucketSum = expenses.reduce((sum, tx) => {
        const d = new Date(tx.transactionDate);
        const h = d.getHours();
        if (h > prevHour && h <= hour) return sum + tx.amountMinor;
        return sum;
      }, 0);
      running += bucketSum;
      return {
        value: Number(fromMinorUnits(running).toFixed(2)),
        label: `${hour}h`,
      };
    });
  }

  // Group into up to 8 evenly distributed points across the period
  const bucketCount = Math.min(totalDays, 8);
  const dailyMap = new Map<string, number>();
  for (const tx of expenses) {
    const key = format(new Date(tx.transactionDate), 'yyyy-MM-dd');
    dailyMap.set(key, (dailyMap.get(key) ?? 0) + tx.amountMinor);
  }

  const points: Array<{ value: number; label?: string }> = [];
  let runningMinor = 0;
  const step = totalDays / bucketCount;

  for (let i = 0; i < bucketCount; i++) {
    const rangeStartIdx = Math.floor(i * step);
    const rangeEndIdx = i === bucketCount - 1 ? totalDays - 1 : Math.floor((i + 1) * step) - 1;
    let bucketDate = addDays(start, rangeEndIdx);

    for (let dIdx = rangeStartIdx; dIdx <= rangeEndIdx; dIdx++) {
      const day = addDays(start, dIdx);
      const key = format(day, 'yyyy-MM-dd');
      runningMinor += dailyMap.get(key) ?? 0;
      bucketDate = day;
    }

    const showLabel = i === 0 || i === bucketCount - 1 || i % 2 === 0;
    points.push({
      value: Number(fromMinorUnits(runningMinor).toFixed(2)),
      label: showLabel
        ? totalDays > 90
          ? format(bucketDate, 'MMM')
          : format(bucketDate, 'd MMM')
        : '',
    });
  }

  return points;
}

export default function InsightsScreen() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const currency = settings?.baseCurrency || 'INR';
  const numberFormat = settings?.numberFormat || 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  const firstDayOfWeek = settings?.firstDayOfWeek ?? 1;
  const hapticEnabled = settings?.hapticEnabled ?? true;

  const [period, setPeriod] = useState<InsightPeriod>('month');
  const [anchorDate, setAnchorDate] = useState<Date>(() => new Date());
  const [customStart, setCustomStart] = useState<Date>(() => subDays(new Date(), 29));
  const [customEnd, setCustomEnd] = useState<Date>(() => new Date());
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const setTabBarVisible = useTabBarStore((s) => s.setTabBarVisible);

  useEffect(() => {
    setTabBarVisible(!customModalVisible);
    return () => {
      setTabBarVisible(true);
    };
  }, [customModalVisible, setTabBarVisible]);
  const [startInput, setStartInput] = useState(() => format(subDays(new Date(), 29), 'yyyy-MM-dd'));
  const [endInput, setEndInput] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [customError, setCustomError] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [summary, setSummary] = useState({ incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
  const [prevSummary, setPrevSummary] = useState({ incomeMinor: 0, expenseMinor: 0, netMinor: 0 });
  const [periodTransactions, setPeriodTransactions] = useState<TransactionWithDetails[]>([]);
  const [prevTransactions, setPrevTransactions] = useState<TransactionWithDetails[]>([]);
  const [monthlyBuckets, setMonthlyBuckets] = useState<MonthlyBarBucket[]>([]);
  const [walletComparison, setWalletComparison] = useState<WalletComparisonRow[]>([]);
  const [selectedBar, setSelectedBar] = useState<SelectedBarTooltip | null>(null);

  const bounds = useMemo(
    () => computePeriodBounds(period, anchorDate, customStart, customEnd, firstDayOfWeek),
    [period, anchorDate, customStart, customEnd, firstDayOfWeek]
  );

  const loadAnalytics = useCallback(
    async (silent = false) => {
      if (!silent) setIsLoading(true);
      try {
        const db = await getDatabase();
        const txRepo = new TransactionRepository(db);
        const walletRepo = new WalletRepository(db);

        const startISO = bounds.start.toISOString();
        const endISO = bounds.end.toISOString();
        const prevStartISO = bounds.prevStart.toISOString();
        const prevEndISO = bounds.prevEnd.toISOString();

        const [curSummary, lastSummary, curTxs, lastTxs, activeWallets] = await Promise.all([
          txRepo.getSummary(startISO, endISO),
          txRepo.getSummary(prevStartISO, prevEndISO),
          txRepo.getAll({ startDate: startISO, endDate: endISO, sortBy: 'date_desc' }),
          txRepo.getAll({ startDate: prevStartISO, endDate: prevEndISO, sortBy: 'date_desc' }),
          walletRepo.getAll(false),
        ]);

        const walletRows = await Promise.all(
          activeWallets.map(async (wallet) => ({
            wallet,
            balanceMinor: await FinanceCalculator.getWalletBalance(wallet.id),
          }))
        );
        walletRows.sort((a, b) => b.balanceMinor - a.balanceMinor);

        // 6-month overview ending at anchorDate's month
        const sixMonths: MonthlyBarBucket[] = [];
        for (let i = 5; i >= 0; i--) {
          const mDate = subMonths(anchorDate, i);
          const mStart = startOfMonth(mDate).toISOString();
          const mEnd = endOfMonth(mDate).toISOString();
          const mSum = await txRepo.getSummary(mStart, mEnd);
          sixMonths.push({
            monthLabel: format(mDate, 'MMM'),
            fullLabel: format(mDate, 'MMMM yyyy'),
            incomeMinor: mSum.incomeMinor,
            expenseMinor: mSum.expenseMinor,
          });
        }

        setSummary(curSummary);
        setPrevSummary(lastSummary);
        setPeriodTransactions(curTxs);
        setPrevTransactions(lastTxs);
        setMonthlyBuckets(sixMonths);
        setWalletComparison(walletRows);
        setSelectedBar(null);
      } catch (error) {
        console.error('Insights loadAnalytics error:', error);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [bounds, anchorDate]
  );

  useFocusEffect(
    useCallback(() => {
      loadAnalytics(periodTransactions.length > 0);
      return () => {
        // Guarantee that tab bar is ALWAYS restored when switching away from Insights
        setTabBarVisible(true);
        setCustomModalVisible(false);
      };
    }, [loadAnalytics, periodTransactions.length, setTabBarVisible])
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadAnalytics(true);
  }, [loadAnalytics]);

  const navigatePeriod = (direction: -1 | 1) => {
    if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
    if (period === 'custom') {
      const span = Math.max(1, differenceInDays(customEnd, customStart) + 1);
      setCustomStart((d) => addDays(d, direction * span));
      setCustomEnd((d) => addDays(d, direction * span));
      return;
    }
    setAnchorDate((prev) => {
      switch (period) {
        case 'day':
          return direction === 1 ? addDays(prev, 1) : subDays(prev, 1);
        case 'week':
          return direction === 1 ? addWeeks(prev, 1) : subWeeks(prev, 1);
        case 'month':
          return direction === 1 ? addMonths(prev, 1) : subMonths(prev, 1);
        case 'year':
          return direction === 1 ? addYears(prev, 1) : subYears(prev, 1);
        default:
          return prev;
      }
    });
  };

  const handleSelectPeriod = (nextPeriod: InsightPeriod) => {
    if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
    if (nextPeriod === 'custom') {
      setStartInput(format(customStart, 'yyyy-MM-dd'));
      setEndInput(format(customEnd, 'yyyy-MM-dd'));
      setCustomError(null);
      setCustomModalVisible(true);
    }
    setPeriod(nextPeriod);
  };

  const applyCustomPreset = (days: number) => {
    const end = new Date();
    const start = subDays(end, days - 1);
    setCustomStart(start);
    setCustomEnd(end);
    setStartInput(format(start, 'yyyy-MM-dd'));
    setEndInput(format(end, 'yyyy-MM-dd'));
    setCustomError(null);
    setCustomModalVisible(false);
  };

  const applyCustomRange = () => {
    const parsedStart = parseISO(startInput.trim());
    const parsedEnd = parseISO(endInput.trim());
    if (!isValid(parsedStart) || !isValid(parsedEnd)) {
      setCustomError('Enter valid dates in YYYY-MM-DD format.');
      return;
    }
    if (parsedStart > parsedEnd) {
      setCustomError('Start date must be before or equal to end date.');
      return;
    }
    setCustomStart(parsedStart);
    setCustomEnd(parsedEnd);
    setCustomError(null);
    setCustomModalVisible(false);
  };

  // Derived analytics
  const categoryBreakdown = useMemo<CategoryBreakdownRow[]>(() => {
    const expenses = periodTransactions.filter((t) => t.type === 'expense');
    const totalExpense = expenses.reduce((sum, t) => sum + t.amountMinor, 0);
    const map = new Map<string, CategoryBreakdownRow>();

    for (const tx of expenses) {
      const catId = tx.categoryId ?? 'uncategorized';
      const existing = map.get(catId);
      if (existing) {
        existing.amountMinor += tx.amountMinor;
        existing.transactionCount += 1;
      } else {
        map.set(catId, {
          categoryId: catId,
          categoryName: tx.categoryName || 'Uncategorized',
          categoryColor: tx.categoryColor || '#A0A0A0',
          categoryIcon: tx.categoryIcon || 'package',
          amountMinor: tx.amountMinor,
          percentage: 0,
          transactionCount: 1,
        });
      }
    }

    const rows = Array.from(map.values()).sort((a, b) => b.amountMinor - a.amountMinor);
    return rows.map((row) => ({
      ...row,
      percentage: totalExpense > 0 ? Math.round((row.amountMinor / totalExpense) * 100) : 0,
    }));
  }, [periodTransactions]);

  const maxCategoryAmount = useMemo(
    () => (categoryBreakdown.length > 0 ? categoryBreakdown[0].amountMinor : 1),
    [categoryBreakdown]
  );

  const topExpenseDays = useMemo<TopExpenseDay[]>(() => {
    const expenses = periodTransactions.filter((t) => t.type === 'expense');
    const dayMap = new Map<string, { date: Date; totalMinor: number; count: number }>();

    for (const tx of expenses) {
      const d = new Date(tx.transactionDate);
      const key = format(d, 'yyyy-MM-dd');
      const existing = dayMap.get(key);
      if (existing) {
        existing.totalMinor += tx.amountMinor;
        existing.count += 1;
      } else {
        dayMap.set(key, { date: d, totalMinor: tx.amountMinor, count: 1 });
      }
    }

    return Array.from(dayMap.entries())
      .map(([dateKey, info]) => ({
        dateKey,
        displayDate: format(info.date, 'dd MMM'),
        dayName: format(info.date, 'EEEE'),
        totalMinor: info.totalMinor,
        count: info.count,
      }))
      .sort((a, b) => b.totalMinor - a.totalMinor)
      .slice(0, 3);
  }, [periodTransactions]);

  // Grouped BarChart data (2 bars per month: Income green, Expense red)
  const barChartData = useMemo(() => {
    const items: Array<{
      value: number;
      label?: string;
      spacing?: number;
      labelWidth?: number;
      labelTextStyle?: { color: string; fontSize: number };
      frontColor: string;
      onPress: () => void;
    }> = [];

    for (const bucket of monthlyBuckets) {
      items.push({
        value: Number(fromMinorUnits(bucket.incomeMinor).toFixed(2)),
        label: bucket.monthLabel,
        spacing: 4,
        labelWidth: 34,
        labelTextStyle: { color: Colors.textSecondary, fontSize: 11 },
        frontColor: Colors.primary,
        onPress: () =>
          setSelectedBar({
            label: bucket.fullLabel,
            type: 'Income',
            amountMinor: bucket.incomeMinor,
          }),
      });
      items.push({
        value: Number(fromMinorUnits(bucket.expenseMinor).toFixed(2)),
        spacing: 16,
        frontColor: Colors.expense,
        onPress: () =>
          setSelectedBar({
            label: bucket.fullLabel,
            type: 'Expense',
            amountMinor: bucket.expenseMinor,
          }),
      });
    }
    return items;
  }, [monthlyBuckets]);

  const hasMonthlyChartData = useMemo(
    () => monthlyBuckets.some((b) => b.incomeMinor > 0 || b.expenseMinor > 0),
    [monthlyBuckets]
  );

  const currentTrendPoints = useMemo(
    () => buildCumulativeTrendPoints(periodTransactions, bounds.start, bounds.end),
    [periodTransactions, bounds]
  );

  const previousTrendPoints = useMemo(
    () => buildCumulativeTrendPoints(prevTransactions, bounds.prevStart, bounds.prevEnd),
    [prevTransactions, bounds]
  );

  const hasPreviousTrend = useMemo(
    () => previousTrendPoints.some((p) => p.value > 0),
    [previousTrendPoints]
  );

  const incomeDelta = calcDeltaPercent(summary.incomeMinor, prevSummary.incomeMinor);
  const expenseDelta = calcDeltaPercent(summary.expenseMinor, prevSummary.expenseMinor);
  const netDelta = calcDeltaPercent(summary.netMinor, prevSummary.netMinor);

  const formatAmt = (minor: number) =>
    formatCurrency(minor, currency, numberFormat, decimalPlaces);

  const formatCompactAxis = (label: string) => {
    const num = Number(label);
    if (isNaN(num)) return label;
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}k`;
    return `${Math.round(num)}`;
  };

  const renderDeltaBadge = (delta: number | null, invertGood = false) => {
    if (delta === null) {
      return <Text style={styles.deltaMuted}>New</Text>;
    }
    const isPositive = delta >= 0;
    const isGood = invertGood ? !isPositive : isPositive;
    const color = delta === 0 ? Colors.textSecondary : isGood ? Colors.primary : Colors.expense;
    return (
      <View style={styles.deltaRow}>
        {isPositive ? (
          <TrendingUp size={12} color={color} />
        ) : (
          <TrendingDown size={12} color={color} />
        )}
        <Text style={[styles.deltaText, { color }]}>
          {isPositive ? '+' : ''}
          {delta}%
        </Text>
      </View>
    );
  };

  const hasPeriodActivity = periodTransactions.length > 0;

  const maxWalletAbsBalance = useMemo(() => {
    const maxVal = walletComparison.reduce(
      (max, row) => Math.max(max, Math.abs(row.balanceMinor)),
      0
    );
    return maxVal > 0 ? maxVal : 1;
  }, [walletComparison]);

  const totalPositiveWalletBalance = useMemo(
    () =>
      walletComparison.reduce(
        (sum, row) => sum + (row.balanceMinor > 0 ? row.balanceMinor : 0),
        0
      ),
    [walletComparison]
  );

  const renderWalletComparisonCard = () => {
    if (walletComparison.length === 0) return null;

    return (
      <Card style={styles.sectionCard}>
        <View style={styles.sectionHeaderRow}>
          <View style={styles.titleWithIcon}>
            <Wallet size={18} color={Colors.primary} />
            <Text style={styles.sectionTitle}>Wallet Comparison</Text>
          </View>
          <Text style={styles.sectionMeta}>
            {walletComparison.length} {pluralize(walletComparison.length, 'wallet')}
          </Text>
        </View>

        <View style={styles.walletCompList}>
          {walletComparison.map((row, idx) => {
            const barPct = Math.round((Math.abs(row.balanceMinor) / maxWalletAbsBalance) * 100);
            const sharePct =
              row.balanceMinor > 0 && totalPositiveWalletBalance > 0
                ? Math.round((row.balanceMinor / totalPositiveWalletBalance) * 100)
                : 0;
            const barColor = row.balanceMinor < 0 ? Colors.expense : row.wallet.color || Colors.primary;

            return (
              <Pressable
                key={row.wallet.id}
                onPress={() => {
                  if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
                  router.push({
                    pathname: '/(settings)/wallet-detail',
                    params: { id: row.wallet.id },
                  } as never);
                }}
                style={({ pressed }) => [
                  styles.walletCompRow,
                  idx < walletComparison.length - 1 && styles.rowDivider,
                  pressed && styles.rowPressed,
                ]}
              >
                <View style={styles.walletCompTopLine}>
                  <View style={styles.walletCompNameWrap}>
                    <View
                      style={[
                        styles.walletColorDot,
                        { backgroundColor: row.wallet.color || Colors.primary },
                      ]}
                    />
                    <Text style={styles.categoryName} numberOfLines={1}>
                      {row.wallet.name}
                    </Text>
                    <View style={styles.walletTypePill}>
                      <Text style={styles.walletTypeText}>
                        {row.wallet.type.charAt(0).toUpperCase() + row.wallet.type.slice(1)}
                      </Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      styles.categoryAmount,
                      row.balanceMinor < 0 && { color: Colors.expense },
                    ]}
                  >
                    {formatCurrency(
                      row.balanceMinor,
                      row.wallet.currencyCode || currency,
                      numberFormat,
                      decimalPlaces
                    )}
                  </Text>
                </View>

                <ProgressBar
                  percentage={barPct}
                  height={7}
                  colorOverride={barColor}
                  style={styles.categoryBar}
                />

                <View style={styles.categoryBottomLine}>
                  <Text style={styles.categoryCount}>
                    {row.wallet.includeInTotal ? 'Included in total' : 'Excluded from total'}
                  </Text>
                  <Text style={styles.categoryPct}>
                    {row.balanceMinor < 0 ? 'Negative' : `${sharePct}% share`}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Top Header */}
      <View style={styles.topHeader}>
        <View>
          <Text style={styles.screenTitle}>Insights</Text>
          <Text style={styles.periodSubtitle}>{bounds.label}</Text>
        </View>
        <Pressable
          onPress={() => router.push('/(settings)' as never)}
          style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Open Settings"
          hitSlop={8}
        >
          <Settings size={20} color={Colors.textPrimary} />
        </Pressable>
      </View>

      {/* Sticky Period Selector */}
      <View style={styles.stickyBar}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.periodChipsContainer}
        >
          {PERIOD_OPTIONS.map((opt) => (
            <Chip
              key={opt.key}
              label={opt.label}
              active={period === opt.key}
              onPress={() => handleSelectPeriod(opt.key)}
              style={styles.periodChip}
            />
          ))}
        </ScrollView>
      </View>

      {isLoading ? (
        <LoadingState message="Calculating insights..." />
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
          {!hasPeriodActivity ? (
            <>
              <Card style={styles.emptyCard}>
                <EmptyState
                  icon={<BarChart3 size={32} color={Colors.primary} />}
                  heading="No data for this period"
                  subtitle={`No transactions recorded for ${bounds.label}. Add a transaction or switch periods to explore your analytics.`}
                  ctaLabel="Add Transaction"
                  onCtaPress={() => router.push('/modals/add-transaction' as never)}
                />
              </Card>
              {renderWalletComparisonCard()}
            </>
          ) : (
            <>
              {/* Section 1 — Summary Row */}
              <View style={styles.summaryRow}>
                <Card compact style={styles.summaryCard}>
                  <View style={[styles.summaryIconBadge, { backgroundColor: Colors.primarySoft }]}>
                    <ArrowUpRight size={15} color={Colors.primary} />
                  </View>
                  <Text style={styles.summaryLabel}>Income</Text>
                  <Text
                    style={[styles.summaryAmount, { color: Colors.primary }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatAmt(summary.incomeMinor)}
                  </Text>
                  {renderDeltaBadge(incomeDelta, false)}
                </Card>

                <Card compact style={styles.summaryCard}>
                  <View style={[styles.summaryIconBadge, { backgroundColor: Colors.expenseSoft }]}>
                    <ArrowDownLeft size={15} color={Colors.expense} />
                  </View>
                  <Text style={styles.summaryLabel}>Expenses</Text>
                  <Text
                    style={[styles.summaryAmount, { color: Colors.expense }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatAmt(summary.expenseMinor)}
                  </Text>
                  {renderDeltaBadge(expenseDelta, true)}
                </Card>

                <Card compact style={styles.summaryCard}>
                  <View
                    style={[
                      styles.summaryIconBadge,
                      {
                        backgroundColor:
                          summary.netMinor >= 0 ? Colors.primarySoft : Colors.expenseSoft,
                      },
                    ]}
                  >
                    <Wallet
                      size={15}
                      color={summary.netMinor >= 0 ? Colors.primary : Colors.expense}
                    />
                  </View>
                  <Text style={styles.summaryLabel}>Net Saved</Text>
                  <Text
                    style={[
                      styles.summaryAmount,
                      {
                        color: summary.netMinor >= 0 ? Colors.primary : Colors.expense,
                      },
                    ]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                  >
                    {formatAmt(summary.netMinor)}
                  </Text>
                  {renderDeltaBadge(netDelta, false)}
                </Card>
              </View>

              {/* Section 2 — Income vs Expense Chart */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Monthly Overview</Text>
                    <Text style={styles.sectionCaption}>Last 6 months · tap any bar for exact value</Text>
                  </View>
                  <View style={styles.legendRow}>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                      <Text style={styles.legendText}>In</Text>
                    </View>
                    <View style={styles.legendItem}>
                      <View style={[styles.legendDot, { backgroundColor: Colors.expense }]} />
                      <Text style={styles.legendText}>Out</Text>
                    </View>
                  </View>
                </View>

                {selectedBar ? (
                  <View style={styles.tooltipBanner}>
                    <View
                      style={[
                        styles.legendDot,
                        {
                          backgroundColor:
                            selectedBar.type === 'Income' ? Colors.primary : Colors.expense,
                        },
                      ]}
                    />
                    <Text style={styles.tooltipText}>
                      {selectedBar.label} · {selectedBar.type}:{' '}
                      <Text style={styles.tooltipValue}>
                        {formatAmt(selectedBar.amountMinor)}
                      </Text>
                    </Text>
                    <Pressable onPress={() => setSelectedBar(null)} hitSlop={8}>
                      <X size={14} color={Colors.textSecondary} />
                    </Pressable>
                  </View>
                ) : null}

                {hasMonthlyChartData ? (
                  <View style={styles.chartWrapper}>
                    <BarChart
                      data={barChartData}
                      width={CHART_WIDTH}
                      height={175}
                      barWidth={13}
                      roundedTop
                      roundedBottom={false}
                      hideRules={false}
                      rulesColor="#F0F4EF"
                      rulesType="dashed"
                      xAxisColor="#EDF1EC"
                      yAxisThickness={0}
                      yAxisTextStyle={styles.axisText}
                      formatYLabel={formatCompactAxis}
                      noOfSections={4}
                      isAnimated
                      animationDuration={500}
                      initialSpacing={10}
                    />
                  </View>
                ) : (
                  <Text style={styles.chartEmptyText}>
                    Not enough monthly history yet to display the comparison chart.
                  </Text>
                )}
              </Card>

              {/* Section 3 — Spending Trend Line */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Spending Trend</Text>
                    <Text style={styles.sectionCaption}>Cumulative spending over period</Text>
                  </View>
                  {hasPreviousTrend ? (
                    <View style={styles.legendRow}>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                        <Text style={styles.legendText}>Current</Text>
                      </View>
                      <View style={styles.legendItem}>
                        <View style={[styles.legendDot, { backgroundColor: Colors.textDisabled }]} />
                        <Text style={styles.legendText}>Prev</Text>
                      </View>
                    </View>
                  ) : null}
                </View>

                {summary.expenseMinor > 0 ? (
                  <View style={styles.chartWrapper}>
                    <LineChart
                      data={currentTrendPoints}
                      data2={hasPreviousTrend ? previousTrendPoints : undefined}
                      width={CHART_WIDTH}
                      height={165}
                      curved
                      areaChart
                      areaChart1
                      color1={Colors.primary}
                      color2={Colors.textDisabled}
                      strokeDashArray2={[5, 4]}
                      thickness1={2.5}
                      thickness2={1.8}
                      startFillColor1={Colors.primary}
                      endFillColor1={Colors.bgCard}
                      startOpacity1={0.22}
                      endOpacity1={0.02}
                      startOpacity2={0}
                      endOpacity2={0}
                      dataPointsColor1={Colors.primary}
                      dataPointsRadius1={3.5}
                      hideDataPoints2
                      xAxisColor="#EDF1EC"
                      xAxisLabelTextStyle={styles.axisText}
                      yAxisThickness={0}
                      yAxisTextStyle={styles.axisText}
                      formatYLabel={formatCompactAxis}
                      rulesColor="#F0F4EF"
                      rulesType="dashed"
                      noOfSections={4}
                      isAnimated
                      animationDuration={600}
                      initialSpacing={12}
                      spacing={Math.max(
                        28,
                        Math.floor((CHART_WIDTH - 28) / Math.max(1, currentTrendPoints.length - 1))
                      )}
                    />
                  </View>
                ) : (
                  <Text style={styles.chartEmptyText}>
                    No expenses recorded in this period.
                  </Text>
                )}
              </Card>

              {/* Section 4 — Category Breakdown */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>By Category</Text>
                  <Text style={styles.sectionMeta}>
                    {categoryBreakdown.length}{' '}
                    {pluralize(categoryBreakdown.length, 'category', 'categories')}
                  </Text>
                </View>

                {categoryBreakdown.length === 0 ? (
                  <Text style={styles.chartEmptyText}>
                    No expense categories in this period.
                  </Text>
                ) : (
                  <View style={styles.categoryList}>
                    {categoryBreakdown.map((item, idx) => {
                      const barPct =
                        maxCategoryAmount > 0
                          ? Math.round((item.amountMinor / maxCategoryAmount) * 100)
                          : 0;
                      return (
                        <Pressable
                          key={item.categoryId}
                          onPress={() => {
                            if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
                            router.push({
                              pathname: '/(tabs)/insights/category/[id]',
                              params: {
                                id: item.categoryId,
                                start: bounds.start.toISOString(),
                                end: bounds.end.toISOString(),
                                label: bounds.label,
                              },
                            } as never);
                          }}
                          style={({ pressed }) => [
                            styles.categoryRow,
                            idx < categoryBreakdown.length - 1 && styles.rowDivider,
                            pressed && styles.rowPressed,
                          ]}
                        >
                          <View
                            style={[
                              styles.categoryIconCircle,
                              { backgroundColor: `${item.categoryColor}20` },
                            ]}
                          >
                            {renderCategoryIcon(item.categoryIcon, 20, item.categoryColor)}
                          </View>

                          <View style={styles.categoryMiddle}>
                            <View style={styles.categoryTopLine}>
                              <Text style={styles.categoryName} numberOfLines={1}>
                                {item.categoryName}
                              </Text>
                              <Text style={styles.categoryAmount}>
                                {formatAmt(item.amountMinor)}
                              </Text>
                            </View>

                            <ProgressBar
                              percentage={barPct}
                              height={6}
                              colorOverride={item.categoryColor}
                              style={styles.categoryBar}
                            />

                            <View style={styles.categoryBottomLine}>
                              <Text style={styles.categoryCount}>
                                {item.transactionCount}{' '}
                                {pluralize(item.transactionCount, 'transaction')}
                              </Text>
                              <Text style={styles.categoryPct}>{item.percentage}%</Text>
                            </View>
                          </View>

                          <ChevronRight size={16} color={Colors.textDisabled} />
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </Card>

              {/* Section 5 — Top Expense Days */}
              <Card style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View style={styles.titleWithIcon}>
                    <Flame size={18} color={Colors.expense} />
                    <Text style={styles.sectionTitle}>Biggest Spending Days</Text>
                  </View>
                  <Text style={styles.sectionMeta}>Top 3</Text>
                </View>

                {topExpenseDays.length === 0 ? (
                  <Text style={styles.chartEmptyText}>
                    No spending days to highlight for this period.
                  </Text>
                ) : (
                  <View style={styles.topDaysList}>
                    {topExpenseDays.map((day, idx) => (
                      <View
                        key={day.dateKey}
                        style={[
                          styles.topDayRow,
                          idx < topExpenseDays.length - 1 && styles.rowDivider,
                        ]}
                      >
                        <View
                          style={[
                            styles.rankBadge,
                            idx === 0 && { backgroundColor: Colors.expenseSoft },
                          ]}
                        >
                          <Text
                            style={[
                              styles.rankText,
                              idx === 0 && { color: Colors.expense },
                            ]}
                          >
                            #{idx + 1}
                          </Text>
                        </View>
                        <View style={styles.topDayInfo}>
                          <Text style={styles.topDayDate}>
                            {day.displayDate} · {day.dayName}
                          </Text>
                          <Text style={styles.topDayCount}>
                            {day.count} {pluralize(day.count, 'expense')}
                          </Text>
                        </View>
                        <Text style={styles.topDayAmount}>{formatAmt(day.totalMinor)}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </Card>

              {/* Section 6 — Wallet Comparison */}
              {renderWalletComparisonCard()}
            </>
          )}
        </ScrollView>
      )}

      {/* Custom Date Range Modal */}
      <Modal
        visible={customModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.titleWithIcon}>
                <Calendar size={18} color={Colors.primary} />
                <Text style={styles.modalTitle}>Custom Period</Text>
              </View>
              <Pressable onPress={() => setCustomModalVisible(false)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <View style={styles.presetRow}>
              <Chip label="Last 14d" onPress={() => applyCustomPreset(14)} />
              <Chip label="Last 30d" onPress={() => applyCustomPreset(30)} />
              <Chip label="Last 90d" onPress={() => applyCustomPreset(90)} />
            </View>

            <Input
              label="Start Date (YYYY-MM-DD)"
              value={startInput}
              onChangeText={setStartInput}
              placeholder="2026-10-01"
              autoCapitalize="none"
              containerStyle={styles.modalInput}
            />
            <Input
              label="End Date (YYYY-MM-DD)"
              value={endInput}
              onChangeText={setEndInput}
              placeholder="2026-11-18"
              autoCapitalize="none"
              error={customError}
              containerStyle={styles.modalInput}
            />

            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setCustomModalVisible(false)}
                fullWidth={false}
                style={styles.modalBtn}
              />
              <Button
                title="Apply"
                variant="primary"
                onPress={applyCustomRange}
                fullWidth={false}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  screenTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  periodSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  settingsButton: {
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
  stickyBar: {
    paddingVertical: 10,
    backgroundColor: Colors.bgMain,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2EC',
  },
  periodChipsContainer: {
    paddingHorizontal: Spacing.xl,
    gap: 8,
  },
  periodChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    minHeight: 36,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.md,
    paddingBottom: 160,
    gap: 14,
  },
  emptyCard: {
    marginTop: Spacing.sm,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    gap: 4,
  },
  summaryIconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  summaryLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  deltaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    marginTop: 4,
  },
  deltaText: {
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  deltaMuted: {
    fontSize: 11,
    color: Colors.textDisabled,
    marginTop: 4,
  },
  sectionCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    gap: 14,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  titleWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  sectionCaption: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  sectionMeta: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tooltipBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    gap: Spacing.sm,
  },
  tooltipText: {
    flex: 1,
    fontSize: 13,
    color: Colors.textSecondary,
  },
  tooltipValue: {
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  chartWrapper: {
    alignItems: 'center',
    paddingTop: Spacing.xs,
    overflow: 'hidden',
  },
  axisText: {
    color: Colors.textDisabled,
    fontSize: 10,
    fontWeight: '500',
  },
  chartEmptyText: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  categoryList: {
    marginTop: Spacing.xs,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4EF',
  },
  rowPressed: {
    opacity: 0.72,
  },
  categoryIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryMiddle: {
    flex: 1,
    gap: 5,
  },
  categoryTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  categoryName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  categoryAmount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  categoryBar: {
    marginVertical: 1,
  },
  categoryBottomLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryCount: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  categoryPct: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  topDaysList: {
    marginTop: Spacing.xs,
  },
  topDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rankBadge: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: '#FAFBF9',
    borderWidth: 1,
    borderColor: '#EDF2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  topDayInfo: {
    flex: 1,
  },
  topDayDate: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  topDayCount: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  topDayAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.expense,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  walletCompList: {
    marginTop: Spacing.xs,
  },
  walletCompRow: {
    paddingVertical: 12,
    gap: 6,
  },
  walletCompTopLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  walletCompNameWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  walletColorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  walletTypePill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: '#FAFBF9',
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  walletTypeText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 32, 25, 0.45)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 20,
    gap: 14,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  presetRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  modalInput: {
    marginTop: 2,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalBtn: {
    minWidth: 100,
    height: 44,
  },
});
