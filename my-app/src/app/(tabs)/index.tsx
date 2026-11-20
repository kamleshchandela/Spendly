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
  Animated,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Circle, G } from 'react-native-svg';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  ChevronRight,
  Eye,
  EyeOff,
  MinusCircle,
  PieChart,
  PlusCircle,
  Receipt,
  Settings,
  Target,
} from 'lucide-react-native';

import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Typography } from '../../theme/typography';
import { Shapes } from '../../theme/shapes';
import { Shadows } from '../../theme/shadows';
import { useSettingsStore } from '../../store/settingsStore';
import { getDatabase } from '../../database/database';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { BudgetRepository } from '../../database/repositories/BudgetRepository';
import { FinanceCalculator } from '../../services/finance/FinanceCalculator';
import { formatCurrency } from '../../utils/currencyUtils';
import {
  differenceInDays,
  formatDisplay,
  getGreeting,
  getPeriodRange,
} from '../../utils/dateUtils';
import {
  Badge,
  BadgeStatus,
  Button,
  Card,
  Chip,
  EmptyState,
  LoadingState,
  ProgressBar,
} from '../../components/common';
import { AddWalletCard, WalletCard } from '../../components/cards/WalletCard';
import { TransactionCard } from '../../components/cards/TransactionCard';
import { Wallet } from '../../types/wallet.types';
import { TransactionWithDetails } from '../../types/transaction.types';
import { BudgetWithProgress } from '../../types/budget.types';
import { CategorySpending, PeriodType } from '../../types';

const PERIOD_OPTIONS: Array<{ key: PeriodType; label: string }> = [
  { key: 'today', label: 'Today' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
  { key: 'year', label: 'Year' },
  { key: 'all', label: 'All' },
];

const ALL_TIME_START = '1970-01-01T00:00:00.000Z';
const ALL_TIME_END = '9999-12-31T23:59:59.999Z';

interface DonutChartProps {
  data: CategorySpending[];
  totalMinor: number;
  currencyCode: string;
  numberFormat: 'indian' | 'international';
  decimalPlaces: number;
  hideBalance: boolean;
}

const SpendingDonutChart: React.FC<DonutChartProps> = ({
  data,
  totalMinor,
  currencyCode,
  numberFormat,
  decimalPlaces,
  hideBalance,
}) => {
  const size = 160;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const validSegments = data.filter((item) => item.amountMinor > 0);
  const sum = validSegments.reduce((acc, item) => acc + item.amountMinor, 0);
  const gap = validSegments.length > 1 ? 3 : 0;

  let cumulativeFraction = 0;

  return (
    <View style={styles.donutContainer}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${center}, ${center}`}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={Colors.border}
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          {sum > 0 &&
            validSegments.map((item) => {
              const fraction = item.amountMinor / sum;
              const rawLength = fraction * circumference;
              const segmentLength = Math.max(0, rawLength - gap);
              const dashOffset = -(cumulativeFraction * circumference);
              cumulativeFraction += fraction;

              return (
                <Circle
                  key={item.categoryId}
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke={item.categoryColor || Colors.primary}
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${segmentLength} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  strokeLinecap="butt"
                  fill="transparent"
                />
              );
            })}
        </G>
      </Svg>

      <View style={styles.donutCenter} pointerEvents="none">
        <Text style={styles.donutCenterLabel}>Total Spent</Text>
        <Text
          style={styles.donutCenterAmount}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {hideBalance
            ? '•••••'
            : formatCurrency(totalMinor, currencyCode, numberFormat, decimalPlaces)}
        </Text>
      </View>
    </View>
  );
};

function getDynamicGreetings(name?: string | null): string[] {
  const hour = new Date().getHours();
  const cleanName =
    name && name.trim() && name.trim().toLowerCase() !== 'there'
      ? `, ${name.trim()}`
      : '';

  if (hour >= 5 && hour < 12) {
    return [
      `Good morning${cleanName}`,
      `Rise and shine`,
      `Ready to track today?`,
      `Fresh start, smart day`,
      `Mindful choices today`,
    ];
  } else if (hour >= 12 && hour < 17) {
    return [
      `Good afternoon${cleanName}`,
      `Hope your day goes well`,
      `Stay mindful, stay ahead`,
      `Keeping budget on track`,
      `Every saving counts`,
    ];
  } else if (hour >= 17 && hour < 22) {
    return [
      `Good evening${cleanName}`,
      `Review today's spending`,
      `Finances looking good`,
      `Relax and unwind tonight`,
      `Every saving is a win`,
    ];
  } else {
    return [
      `Peaceful night${cleanName}`,
      `Late night check-in`,
      `All balanced for tomorrow`,
      `Rest easy, budget is safe`,
    ];
  }
}

function DynamicGreeting({ userName }: { userName?: string | null }) {
  const greetings = useMemo(() => getDynamicGreetings(userName), [userName]);
  const [greetingIndex, setGreetingIndex] = useState(0);
  const [displayedText, setDisplayedText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const cursorOpacity = useRef(new Animated.Value(1)).current;

  // Continuous loop: types forward, holds, then backspaces char-by-char from end, and loops!
  useEffect(() => {
    const fullText = greetings[greetingIndex % greetings.length];
    let timer: ReturnType<typeof setTimeout>;

    if (!isDeleting) {
      // Forward typing letter by letter
      if (displayedText.length < fullText.length) {
        timer = setTimeout(() => {
          setDisplayedText(fullText.slice(0, displayedText.length + 1));
        }, 55);
      } else {
        // Finished typing full phrase! Hold for 6.5s so user can read comfortably
        timer = setTimeout(() => {
          setIsDeleting(true);
        }, 6500);
      }
    } else {
      // Deleting one-by-one from the end (like backspace)
      if (displayedText.length > 0) {
        timer = setTimeout(() => {
          setDisplayedText(fullText.slice(0, displayedText.length - 1));
        }, 28);
      } else {
        // Fully erased, pause briefly then start next phrase
        timer = setTimeout(() => {
          setIsDeleting(false);
          setGreetingIndex((prev) => (prev + 1) % greetings.length);
        }, 450);
      }
    }

    return () => clearTimeout(timer);
  }, [displayedText, isDeleting, greetingIndex, greetings]);

  // Soft pulsing cursor animation
  useEffect(() => {
    const blink = Animated.loop(
      Animated.sequence([
        Animated.timing(cursorOpacity, {
          toValue: 0.2,
          duration: 380,
          useNativeDriver: true,
        }),
        Animated.timing(cursorOpacity, {
          toValue: 1,
          duration: 380,
          useNativeDriver: true,
        }),
      ])
    );
    blink.start();
    return () => blink.stop();
  }, [cursorOpacity]);

  const handleNextGreeting = () => {
    Haptics.selectionAsync().catch(() => {});
    if (!isDeleting && displayedText.length > 0) {
      setIsDeleting(true);
    } else {
      setIsDeleting(false);
      setGreetingIndex((prev) => (prev + 1) % greetings.length);
    }
  };

  return (
    <Pressable
      onPress={handleNextGreeting}
      accessibilityRole="button"
      accessibilityLabel={`Greeting: ${displayedText}. Tap to change.`}
      hitSlop={8}
      style={styles.greetingTouchable}
    >
      <Text
        style={styles.greeting}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.80}
      >
        {displayedText}
        <Animated.Text style={[styles.typingCursor, { opacity: cursorOpacity }]}>
          |
        </Animated.Text>
      </Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const { settings, loadSettings, updateSetting } = useSettingsStore();

  const [period, setPeriod] = useState<PeriodType>('month');
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  const [walletTxCounts, setWalletTxCounts] = useState<Record<string, number>>({});
  const [totalBalance, setTotalBalance] = useState<number>(0);
  const [incomeTotal, setIncomeTotal] = useState<number>(0);
  const [expenseTotal, setExpenseTotal] = useState<number>(0);
  const [recentTransactions, setRecentTransactions] = useState<TransactionWithDetails[]>([]);
  const [categorySpending, setCategorySpending] = useState<CategorySpending[]>([]);
  const [activeBudget, setActiveBudget] = useState<BudgetWithProgress | null>(null);

  const [localHideBalance, setLocalHideBalance] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const hasMountedRef = useRef<boolean>(false);

  const hideBalance = settings ? settings.hideBalance : localHideBalance;
  const currencyCode = settings?.baseCurrency || 'INR';
  const numberFormat = settings?.numberFormat || 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  const userName = settings?.userName?.trim() || 'there';

  const loadDashboard = useCallback(
    async (isPullRefresh: boolean = false) => {
      if (isPullRefresh) {
        setRefreshing(true);
      }
      setError(null);

      try {
        await loadSettings().catch(() => {});
        const db = await getDatabase();
        const walletRepo = new WalletRepository(db);
        const txnRepo = new TransactionRepository(db);
        const budgetRepo = new BudgetRepository(db);

        const range =
          period === 'all'
            ? { start: ALL_TIME_START, end: ALL_TIME_END }
            : getPeriodRange(period);

        const [
          loadedWallets,
          computedTotalBalance,
          summary,
          spendingRows,
          recent,
          allBudgets,
          txCountRows,
        ] = await Promise.all([
          walletRepo.getAll(false),
          FinanceCalculator.getTotalBalance(),
          txnRepo.getSummary(range.start, range.end),
          txnRepo.getCategorySpending(range.start, range.end),
          txnRepo.getAll({ limit: 15 }),
          budgetRepo.getAll(false),
          db.getAllAsync<{ wallet_id: string; tx_count: number }>(
            `SELECT wallet_id, COUNT(*) AS tx_count
             FROM transactions
             WHERE is_deleted = 0
             GROUP BY wallet_id`
          ),
        ]);

        const balanceEntries = await Promise.all(
          loadedWallets.map(async (wallet) => {
            const bal = await FinanceCalculator.getWalletBalance(wallet.id);
            return [wallet.id, bal] as const;
          })
        );

        const nextBalances: Record<string, number> = {};
        for (const [id, bal] of balanceEntries) {
          nextBalances[id] = bal;
        }

        const nextCounts: Record<string, number> = {};
        for (const row of txCountRows) {
          nextCounts[row.wallet_id] = row.tx_count ?? 0;
        }

        let criticalBudget: BudgetWithProgress | null = null;
        if (allBudgets.length > 0) {
          criticalBudget = allBudgets.reduce((highest, current) =>
            current.percentage > highest.percentage ? current : highest
          );
        }

        const deduplicatedRecent = recent
          .filter((t) => !(t.type === 'transfer' && t.transferGroupId && !t.destinationWalletId))
          .slice(0, 5);

        setWallets(loadedWallets);
        setWalletBalances(nextBalances);
        setWalletTxCounts(nextCounts);
        setTotalBalance(computedTotalBalance);
        setIncomeTotal(summary.incomeMinor);
        setExpenseTotal(summary.expenseMinor);
        setCategorySpending(spendingRows);
        setRecentTransactions(deduplicatedRecent);
        setActiveBudget(criticalBudget);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Unable to load dashboard data.';
        setError(message);
      } finally {
        setIsLoading(false);
        setRefreshing(false);
      }
    },
    [period, loadSettings]
  );

  useEffect(() => {
    loadDashboard(false);
  }, [loadDashboard]);

  useFocusEffect(
    useCallback(() => {
      if (!hasMountedRef.current) {
        hasMountedRef.current = true;
        return;
      }
      loadDashboard(false);
    }, [loadDashboard])
  );

  const handleToggleBalance = async () => {
    Haptics.selectionAsync().catch(() => {});
    const nextValue = !hideBalance;
    setLocalHideBalance(nextValue);
    try {
      await updateSetting('hideBalance', nextValue);
    } catch {
      // Keep local toggle responsive even if persistence fails
    }
  };

  const handleSelectPeriod = (nextPeriod: PeriodType) => {
    if (nextPeriod === period) return;
    Haptics.selectionAsync().catch(() => {});
    setPeriod(nextPeriod);
  };

  const handleRefresh = () => {
    loadDashboard(true);
  };

  const formatAmount = (minor: number) =>
    hideBalance
      ? '•••••'
      : formatCurrency(minor, currencyCode, numberFormat, decimalPlaces);

  const getBudgetStatus = (percentage: number): BadgeStatus => {
    if (percentage >= 90) return 'over-budget';
    if (percentage >= 70) return 'warning';
    return 'on-track';
  };

  const getBudgetDaysText = (endDate: string): { text: string; isOver: boolean } => {
    try {
      const end = new Date(endDate);
      const now = new Date();
      const diff = differenceInDays(end, now);
      if (diff > 0) {
        return {
          text: `${diff} ${diff === 1 ? 'day' : 'days'} remaining`,
          isOver: false,
        };
      }
      if (diff === 0) {
        return { text: 'Ends today', isOver: false };
      }
      const over = Math.abs(diff);
      return {
        text: `${over} ${over === 1 ? 'day' : 'days'} over`,
        isOver: true,
      };
    } catch {
      return { text: '', isOver: false };
    }
  };

  const todayFormatted = formatDisplay(new Date(), 'EEEE, dd MMM yyyy');
  const topCategories = categorySpending.slice(0, 6);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <DynamicGreeting userName={settings?.userName} />
          <View style={styles.dateRow}>
            <View style={styles.livePulseDot} />
            <Text style={styles.dateText}>{todayFormatted}</Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/(settings)/recurring' as any);
            }}
            accessibilityRole="button"
            accessibilityLabel="Notifications and recurring reminders"
            hitSlop={8}
            style={({ pressed }) => [
              styles.headerIconBtn,
              pressed && styles.iconBtnPressed,
            ]}
          >
            <Bell size={20} color={Colors.textSecondary} strokeWidth={1.9} />
          </Pressable>

          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              router.push('/(settings)' as any);
            }}
            accessibilityRole="button"
            accessibilityLabel="Settings"
            hitSlop={8}
            style={({ pressed }) => [
              styles.headerIconBtn,
              pressed && styles.iconBtnPressed,
            ]}
          >
            <Settings size={20} color={Colors.textSecondary} strokeWidth={1.9} />
          </Pressable>
        </View>
      </View>

      {isLoading && wallets.length === 0 && recentTransactions.length === 0 ? (
        <LoadingState message="Loading your finances..." />
      ) : (
        <ScrollView
          style={styles.scrollView}
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
          {error ? (
            <Card style={styles.errorCard}>
              <Text style={styles.errorText}>{error}</Text>
              <Pressable onPress={() => loadDashboard(false)} style={styles.retryBtn}>
                <Text style={styles.retryText}>Tap to retry</Text>
              </Pressable>
            </Card>
          ) : null}

          {/* Section A — Total Balance Card */}
          <Card style={styles.balanceCard}>
            <View style={styles.balanceTopRow}>
              <Text style={styles.balanceLabel}>Total Balance</Text>
              <Pressable
                onPress={handleToggleBalance}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={hideBalance ? 'Show balance' : 'Hide balance'}
                style={({ pressed }) => [
                  styles.eyeBtn,
                  pressed && styles.iconBtnPressed,
                ]}
              >
                {hideBalance ? (
                  <EyeOff size={18} color={Colors.textSecondary} strokeWidth={1.9} />
                ) : (
                  <Eye size={18} color={Colors.textSecondary} strokeWidth={1.9} />
                )}
              </Pressable>
            </View>

            <Text
              style={styles.balanceAmount}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {formatAmount(totalBalance)}
            </Text>

            <View style={styles.balanceDivider} />

            <View style={styles.balanceSummaryRow}>
              <View style={styles.balanceSummaryItem}>
                <View style={[styles.miniArrow, { backgroundColor: Colors.primarySoft }]}>
                  <ArrowUpRight size={15} color={Colors.primary} strokeWidth={2.3} />
                </View>
                <View style={styles.balanceSummaryText}>
                  <Text style={styles.balanceSummaryLabel}>Income</Text>
                  <Text
                    style={[styles.balanceSummaryValue, { color: Colors.primary }]}
                    numberOfLines={1}
                  >
                    {formatAmount(incomeTotal)}
                  </Text>
                </View>
              </View>

              <View style={styles.balanceVerticalSep} />

              <View style={styles.balanceSummaryItem}>
                <View style={[styles.miniArrow, { backgroundColor: Colors.expenseSoft }]}>
                  <ArrowDownLeft size={15} color={Colors.expense} strokeWidth={2.3} />
                </View>
                <View style={styles.balanceSummaryText}>
                  <Text style={styles.balanceSummaryLabel}>Expenses</Text>
                  <Text
                    style={[styles.balanceSummaryValue, { color: Colors.expense }]}
                    numberOfLines={1}
                  >
                    {formatAmount(expenseTotal)}
                  </Text>
                </View>
              </View>
            </View>
          </Card>

          {/* Period Selector Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.periodChipsContainer}
            style={styles.periodChipsScroll}
          >
            {PERIOD_OPTIONS.map((opt) => (
              <Chip
                key={opt.key}
                label={opt.label}
                active={period === opt.key}
                onPress={() => handleSelectPeriod(opt.key)}
              />
            ))}
          </ScrollView>

          {/* Section B — Wallet Scroll */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>My Wallets</Text>
              <Pressable
                onPress={() => router.push('/(settings)/wallets' as any)}
                hitSlop={8}
                style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.seeAllLink}>See all</Text>
                <ChevronRight size={16} color={Colors.primary} strokeWidth={2.2} />
              </Pressable>
            </View>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.walletScrollContent}
              style={styles.walletScroll}
            >
              {wallets.map((wallet) => (
                <WalletCard
                  key={wallet.id}
                  wallet={wallet}
                  balanceMinor={walletBalances[wallet.id] ?? wallet.openingBalanceMinor}
                  transactionCount={walletTxCounts[wallet.id] ?? 0}
                  hideBalance={hideBalance}
                  numberFormat={numberFormat}
                  decimalPlaces={decimalPlaces}
                  onPress={() =>
                    router.push({
                      pathname: '/(settings)/wallet-detail' as any,
                      params: { id: wallet.id },
                    })
                  }
                />
              ))}
              <AddWalletCard
                onPress={() => router.push('/modals/add-wallet' as any)}
              />
            </ScrollView>
          </View>

          {/* Section C — Monthly Overview Cards */}
          <View style={styles.overviewRow}>
            <Card
              style={styles.overviewCard}
              onPress={() => router.push('/(tabs)/transactions' as any)}
            >
              <View style={[styles.overviewIconCircle, { backgroundColor: Colors.primarySoft }]}>
                <ArrowUpRight size={20} color={Colors.primary} strokeWidth={2.3} />
              </View>
              <Text style={styles.overviewLabel}>Income</Text>
              <Text
                style={[styles.overviewAmount, { color: Colors.primary }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatAmount(incomeTotal)}
              </Text>
            </Card>

            <Card
              style={styles.overviewCard}
              onPress={() => router.push('/(tabs)/transactions' as any)}
            >
              <View style={[styles.overviewIconCircle, { backgroundColor: Colors.expenseSoft }]}>
                <ArrowDownLeft size={20} color={Colors.expense} strokeWidth={2.3} />
              </View>
              <Text style={styles.overviewLabel}>Expenses</Text>
              <Text
                style={[styles.overviewAmount, { color: Colors.expense }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formatAmount(expenseTotal)}
              </Text>
            </Card>
          </View>

          {/* Section D — Spending Breakdown */}
          <Card style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>Spending Breakdown</Text>
              {categorySpending.length > 0 ? (
                <Pressable
                  onPress={() => router.push('/(tabs)/insights' as any)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.seeAllLink}>Details</Text>
                  <ChevronRight size={16} color={Colors.primary} strokeWidth={2.2} />
                </Pressable>
              ) : null}
            </View>

            {categorySpending.length === 0 ? (
              <EmptyState
                icon={<PieChart size={28} color={Colors.primary} strokeWidth={1.8} />}
                heading="No spending data"
                subtitle="Add transactions to see breakdown"
                style={styles.compactEmpty}
              />
            ) : (
              <View style={styles.breakdownContent}>
                <SpendingDonutChart
                  data={categorySpending}
                  totalMinor={expenseTotal}
                  currencyCode={currencyCode}
                  numberFormat={numberFormat}
                  decimalPlaces={decimalPlaces}
                  hideBalance={hideBalance}
                />

                <View style={styles.categoryList}>
                  {topCategories.map((item) => (
                    <Pressable
                      key={item.categoryId}
                      onPress={() => {
                        if (item.categoryId !== 'uncategorized') {
                          router.push(`/(tabs)/insights/category/${item.categoryId}` as any);
                        }
                      }}
                      style={({ pressed }) => [
                        styles.categoryRow,
                        pressed && styles.categoryRowPressed,
                      ]}
                    >
                      <View
                        style={[
                          styles.categoryDot,
                          { backgroundColor: item.categoryColor || Colors.primary },
                        ]}
                      />
                      <Text style={styles.categoryName} numberOfLines={1}>
                        {item.categoryName}
                      </Text>
                      <Text style={styles.categoryAmount} numberOfLines={1}>
                        {formatAmount(item.amountMinor)}
                      </Text>
                      <View style={styles.categoryPctBadge}>
                        <Text style={styles.categoryPctText}>{`${item.percentage}%`}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              </View>
            )}
          </Card>

          {/* Section E — Budget Progress */}
          <Card style={styles.sectionCard}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>Budget Progress</Text>
              {activeBudget ? (
                <Pressable
                  onPress={() => router.push('/(tabs)/budgets' as any)}
                  hitSlop={8}
                  style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
                >
                  <Text style={styles.seeAllLink}>See all</Text>
                  <ChevronRight size={16} color={Colors.primary} strokeWidth={2.2} />
                </Pressable>
              ) : null}
            </View>

            {!activeBudget ? (
              <View style={styles.budgetEmptyWrap}>
                <View style={styles.budgetEmptyIcon}>
                  <Target size={26} color={Colors.primary} strokeWidth={1.9} />
                </View>
                <Text style={styles.budgetEmptyTitle}>Stay on top of your spending</Text>
                <Text style={styles.budgetEmptySubtitle}>
                  Set monthly or category budgets to get early alerts before overspending.
                </Text>
                <Button
                  title="Create a Budget"
                  onPress={() => router.push('/modals/add-budget' as any)}
                  style={styles.budgetCtaBtn}
                />
              </View>
            ) : (
              <Pressable
                onPress={() => router.push(`/(tabs)/budgets/${activeBudget.id}` as any)}
                style={({ pressed }) => [pressed && { opacity: 0.85 }]}
              >
                <View style={styles.budgetTopRow}>
                  <Text style={styles.budgetName} numberOfLines={1}>
                    {activeBudget.name}
                  </Text>
                  <Badge status={getBudgetStatus(activeBudget.percentage)} />
                </View>

                <ProgressBar
                  percentage={activeBudget.percentage}
                  height={10}
                  style={styles.budgetProgressBar}
                />

                <View style={styles.budgetMetaRow}>
                  <Text style={styles.budgetSpentText}>
                    {`${formatAmount(activeBudget.usedMinor)} spent of ${formatAmount(
                      activeBudget.amountMinor
                    )}`}
                  </Text>
                  <Text style={styles.budgetPercentText}>
                    {`${Math.round(activeBudget.percentage)}%`}
                  </Text>
                </View>

                {(() => {
                  const daysInfo = getBudgetDaysText(activeBudget.endDate);
                  return daysInfo.text ? (
                    <Text
                      style={[
                        styles.budgetDaysText,
                        daysInfo.isOver && { color: Colors.expense, fontWeight: '600' },
                      ]}
                    >
                      {daysInfo.text}
                    </Text>
                  ) : null;
                })()}
              </Pressable>
            )}
          </Card>

          {/* Section F — Recent Transactions */}
          <View style={styles.sectionBlock}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Transactions</Text>
              <Pressable
                onPress={() => router.push('/(tabs)/transactions' as any)}
                hitSlop={8}
                style={({ pressed }) => [styles.seeAllBtn, pressed && { opacity: 0.7 }]}
              >
                <Text style={styles.seeAllLink}>See all</Text>
                <ChevronRight size={16} color={Colors.primary} strokeWidth={2.2} />
              </Pressable>
            </View>

            <Card style={styles.transactionsCard}>
              {recentTransactions.length === 0 ? (
                <EmptyState
                  icon={<Receipt size={28} color={Colors.primary} strokeWidth={1.8} />}
                  heading="No transactions yet"
                  subtitle="Your latest expenses, income, and transfers will appear here"
                  ctaLabel="Add Transaction"
                  onCtaPress={() =>
                    router.push({
                      pathname: '/modals/add-transaction' as any,
                      params: { type: 'expense' },
                    })
                  }
                  style={styles.compactEmpty}
                />
              ) : (
                recentTransactions.map((tx, idx) => (
                  <TransactionCard
                    key={tx.id}
                    transaction={tx}
                    currencyCode={currencyCode}
                    numberFormat={numberFormat}
                    decimalPlaces={decimalPlaces}
                    hideBalance={hideBalance}
                    showDivider={idx < recentTransactions.length - 1}
                    onPress={() => router.push('/(tabs)/transactions' as any)}
                  />
                ))
              )}
            </Card>
          </View>

          {/* Section G — Quick Actions Grid */}
          <View style={styles.sectionBlock}>
            <Text style={[styles.sectionTitle, styles.quickActionsTitle]}>
              Quick Actions
            </Text>

            <View style={styles.quickGrid}>
              <View style={styles.quickGridRow}>
                <Card
                  style={styles.quickActionCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push({
                      pathname: '/modals/add-transaction' as any,
                      params: { type: 'expense' },
                    });
                  }}
                >
                  <View style={[styles.quickIconBox, { backgroundColor: Colors.expenseSoft }]}>
                    <MinusCircle size={22} color={Colors.expense} strokeWidth={2} />
                  </View>
                  <Text style={styles.quickActionLabel}>Add Expense</Text>
                </Card>

                <Card
                  style={styles.quickActionCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push({
                      pathname: '/modals/add-transaction' as any,
                      params: { type: 'income' },
                    });
                  }}
                >
                  <View style={[styles.quickIconBox, { backgroundColor: Colors.primarySoft }]}>
                    <PlusCircle size={22} color={Colors.primary} strokeWidth={2} />
                  </View>
                  <Text style={styles.quickActionLabel}>Add Income</Text>
                </Card>
              </View>

              <View style={styles.quickGridRow}>
                <Card
                  style={styles.quickActionCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push({
                      pathname: '/modals/add-transaction' as any,
                      params: { type: 'transfer' },
                    });
                  }}
                >
                  <View style={[styles.quickIconBox, { backgroundColor: Colors.secondarySoft }]}>
                    <ArrowLeftRight size={22} color={Colors.secondary} strokeWidth={2} />
                  </View>
                  <Text style={styles.quickActionLabel}>Transfer</Text>
                </Card>

                <Card
                  style={styles.quickActionCard}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    router.push('/(tabs)/insights' as any);
                  }}
                >
                  <View
                    style={[
                      styles.quickIconBox,
                      { backgroundColor: Colors.accentLavenderSoft },
                    ]}
                  >
                    <BarChart3 size={22} color={Colors.accentLavender} strokeWidth={2} />
                  </View>
                  <Text style={styles.quickActionLabel}>Reports</Text>
                </Card>
              </View>
            </View>
          </View>
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
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.bgMain,
  },
  headerLeft: {
    flex: 1,
    marginRight: Spacing.sm,
  },
  greetingTouchable: {
    justifyContent: 'center',
    minHeight: 28,
  },
  greeting: {
    fontSize: 18.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    lineHeight: 25,
  },
  typingCursor: {
    fontSize: 22,
    fontWeight: '900',
    color: Colors.primary,
    marginLeft: 2,
    lineHeight: 25,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  livePulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  dateText: {
    fontSize: 12.5,
    color: Colors.textSecondary,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  headerIconBtn: {
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
  iconBtnPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 160,
    gap: Spacing.xl,
  },
  errorCard: {
    backgroundColor: Colors.expenseSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.expense,
    fontWeight: '500',
  },
  retryBtn: {
    marginLeft: Spacing.md,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.expense,
  },

  // Section A — Total Balance Card
  balanceCard: {
    padding: Spacing.xl,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EBF1EB',
    backgroundColor: Colors.bgCard,
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 16,
  },
  balanceTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  balanceLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F6F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
    marginTop: 6,
    marginBottom: 2,
  },
  balanceDivider: {
    height: 1,
    backgroundColor: '#F0F4EF',
    marginVertical: Spacing.md + 2,
  },
  balanceSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  balanceSummaryItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FAFBF9',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  miniArrow: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  balanceSummaryText: {
    flex: 1,
  },
  balanceSummaryLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  balanceSummaryValue: {
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
    marginTop: 2,
  },
  balanceVerticalSep: {
    display: 'none',
  },

  // Period Selector
  periodChipsScroll: {
    marginHorizontal: -Spacing.xl,
    marginTop: -Spacing.sm,
  },
  periodChipsContainer: {
    paddingHorizontal: Spacing.xl,
    gap: 8,
  },

  // Section headers
  sectionBlock: {
    gap: Spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  seeAllBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: Shapes.chipRadius,
    backgroundColor: Colors.primarySoft,
  },
  seeAllLink: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.1,
  },

  // Section B — Wallet Scroll
  walletScroll: {
    marginHorizontal: -Spacing.xl,
  },
  walletScrollContent: {
    paddingHorizontal: Spacing.xl,
    gap: 12,
  },

  // Section C — Monthly Overview Cards
  overviewRow: {
    flexDirection: 'row',
    gap: 12,
  },
  overviewCard: {
    flex: 1,
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
    gap: 2,
  },
  overviewIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  overviewLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  overviewAmount: {
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
    marginTop: 2,
  },

  // Section D — Spending Breakdown
  sectionCard: {
    padding: Spacing.lg + 2,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  compactEmpty: {
    paddingVertical: Spacing.xl,
  },
  breakdownContent: {
    gap: Spacing.lg,
  },
  donutContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xs,
  },
  donutCenter: {
    position: 'absolute',
    width: 104,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutCenterLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  donutCenterAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
    marginTop: 2,
  },
  categoryList: {
    gap: 8,
  },
  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 12,
    backgroundColor: '#FAFCFA',
  },
  categoryRowPressed: {
    opacity: 0.7,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categoryName: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 0.1,
  },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  categoryPctBadge: {
    backgroundColor: '#EDF4EE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    minWidth: 42,
    alignItems: 'center',
  },
  categoryPctText: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
  },

  // Section E — Budget Progress
  budgetEmptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
  },
  budgetEmptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  budgetEmptyTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.xs,
    letterSpacing: -0.2,
  },
  budgetEmptySubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: Spacing.lg,
    maxWidth: 260,
    letterSpacing: 0.1,
  },
  budgetCtaBtn: {
    height: 48,
  },
  budgetTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  budgetName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  budgetProgressBar: {
    marginTop: Spacing.md,
    marginBottom: Spacing.sm + 2,
  },
  budgetMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  budgetSpentText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  budgetPercentText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  budgetDaysText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 6,
    letterSpacing: 0.2,
  },

  // Section F — Recent Transactions
  transactionsCard: {
    paddingVertical: 2,
    paddingHorizontal: 16,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },

  // Section G — Quick Actions Grid
  quickActionsTitle: {
    marginBottom: 0,
  },
  quickGrid: {
    gap: 12,
  },
  quickGridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickActionCard: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    gap: 10,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  quickIconBox: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickActionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 0.1,
    textAlign: 'center',
  },
});
