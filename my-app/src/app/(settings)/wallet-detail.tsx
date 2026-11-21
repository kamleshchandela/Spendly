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
  Dimensions,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '../../components/common/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { LineChart } from 'react-native-gifted-charts';
import { format, startOfDay, subDays } from 'date-fns';
import * as Haptics from 'expo-haptics';
import {
  Archive,
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Briefcase,
  ChevronLeft,
  Coins,
  CreditCard,
  Landmark,
  Pencil,
  PiggyBank,
  Receipt,
  Shield,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import { Card, EmptyState, LoadingState } from '../../components/common';
import { getDatabase } from '../../database/database';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { FinanceCalculator } from '../../services/finance/FinanceCalculator';
import { useSettingsStore } from '../../store/settingsStore';
import { useWalletStore } from '../../store/walletStore';
import { Colors, Shadows, Shapes, Spacing } from '../../theme';
import { TransactionWithDetails } from '../../types/transaction.types';
import { Wallet, WalletType } from '../../types/wallet.types';
import { formatCurrency, fromMinorUnits } from '../../utils/currencyUtils';
import { formatRelative, formatTime } from '../../utils/dateUtils';

const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: 'Cash',
  bank: 'Bank',
  savings: 'Savings',
  credit: 'Credit',
  other: 'Other',
};

const renderWalletIcon = (iconName: string, color: string, size: number = 24) => {
  switch (iconName) {
    case 'landmark':
      return <Landmark size={size} color={color} />;
    case 'piggy-bank':
      return <PiggyBank size={size} color={color} />;
    case 'credit-card':
      return <CreditCard size={size} color={color} />;
    case 'banknote':
      return <Banknote size={size} color={color} />;
    case 'briefcase':
      return <Briefcase size={size} color={color} />;
    case 'coins':
      return <Coins size={size} color={color} />;
    case 'shield':
      return <Shield size={size} color={color} />;
    case 'wallet':
    default:
      return <WalletIcon size={size} color={color} />;
  }
};

const getWalletDeltaMinor = (tx: TransactionWithDetails, walletId: string): number => {
  if (tx.type === 'income' && tx.walletId === walletId) {
    return tx.amountMinor;
  }
  if (tx.type === 'expense' && tx.walletId === walletId) {
    return -tx.amountMinor;
  }
  if (tx.type === 'transfer') {
    if (tx.walletId === walletId && tx.destinationWalletId !== null) {
      return -tx.amountMinor;
    }
    if (
      (tx.walletId === walletId && tx.destinationWalletId === null && tx.transferGroupId !== null) ||
      (tx.destinationWalletId === walletId && tx.transferGroupId === null)
    ) {
      return tx.amountMinor;
    }
  }
  return 0;
};

interface DailyBalancePoint {
  date: Date;
  balanceMinor: number;
}

const build30DayHistory = (
  wallet: Wallet,
  transactionsAsc: TransactionWithDetails[]
): DailyBalancePoint[] => {
  const today = startOfDay(new Date());
  const startWindow = subDays(today, 29);

  let runningBalance = wallet.openingBalanceMinor;
  let txIndex = 0;

  // Apply all transactions prior to the 30-day window
  while (txIndex < transactionsAsc.length) {
    const txDate = new Date(transactionsAsc[txIndex].transactionDate);
    if (txDate < startWindow) {
      runningBalance += getWalletDeltaMinor(transactionsAsc[txIndex], wallet.id);
      txIndex++;
    } else {
      break;
    }
  }

  const points: DailyBalancePoint[] = [];
  for (let i = 0; i < 30; i++) {
    const dayDate = subDays(today, 29 - i);
    const nextDay = new Date(dayDate.getTime() + 24 * 60 * 60 * 1000);

    while (txIndex < transactionsAsc.length) {
      const txDate = new Date(transactionsAsc[txIndex].transactionDate);
      if (txDate < nextDay) {
        runningBalance += getWalletDeltaMinor(transactionsAsc[txIndex], wallet.id);
        txIndex++;
      } else {
        break;
      }
    }

    points.push({ date: dayDate, balanceMinor: runningBalance });
  }

  return points;
};

export default function WalletDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const settings = useSettingsStore((s) => s.settings);
  const archiveWallet = useWalletStore((s) => s.archiveWallet);

  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [balanceMinor, setBalanceMinor] = useState(0);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [transactionsAsc, setTransactionsAsc] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const numberFormat = settings?.numberFormat ?? 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  const hideBalance = settings?.hideBalance ?? false;

  const loadData = useCallback(
    async (isRefresh = false) => {
      if (!id) {
        setLoading(false);
        return;
      }
      if (isRefresh) setRefreshing(true);
      try {
        const db = await getDatabase();
        const walletRepo = new WalletRepository(db);
        const txRepo = new TransactionRepository(db);

        const foundWallet = await walletRepo.getById(id);
        if (!foundWallet) {
          setWallet(null);
          return;
        }

        const [currentBalance, txDesc, txAsc] = await Promise.all([
          FinanceCalculator.getWalletBalance(foundWallet.id),
          txRepo.getAll({ walletIds: [foundWallet.id], sortBy: 'date_desc' }),
          txRepo.getAll({ walletIds: [foundWallet.id], sortBy: 'date_asc' }),
        ]);

        const visibleTxDesc = txDesc.filter(
          (tx) => tx.type !== 'transfer' || getWalletDeltaMinor(tx, foundWallet.id) !== 0
        );

        setWallet(foundWallet);
        setBalanceMinor(currentBalance);
        setTransactions(visibleTxDesc);
        setTransactionsAsc(txAsc);
      } catch (error) {
        console.error('Failed to load wallet details:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [id]
  );

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const history = useMemo(() => {
    if (!wallet) return [];
    return build30DayHistory(wallet, transactionsAsc);
  }, [wallet, transactionsAsc]);

  const chartStats = useMemo(() => {
    if (history.length === 0) {
      return {
        data: [],
        minMinor: 0,
        maxMinor: 0,
        chartMaxValue: 100,
      };
    }

    const values = history.map((h) => h.balanceMinor);
    const minMinor = Math.min(...values);
    const maxMinor = Math.max(...values);
    const span = maxMinor - minMinor;
    // Shift values into a clean non-negative visual space so negative or flat balances render smoothly
    const baseline = minMinor;
    const padding = span > 0 ? span * 0.15 : 100;

    const data = history.map((point, idx) => {
      const normalized = fromMinorUnits(point.balanceMinor - baseline + padding);
      const showLabel = idx === 0 || idx === 14 || idx === 29;
      return {
        value: Math.max(0.01, normalized),
        label: showLabel
          ? idx === 29
            ? 'Today'
            : format(point.date, 'dd MMM')
          : '',
      };
    });

    const maxPlot = Math.max(...data.map((d) => d.value), 1);

    return {
      data,
      minMinor,
      maxMinor,
      chartMaxValue: maxPlot * 1.15,
    };
  }, [history]);

  const handleArchive = () => {
    if (!wallet) return;
    Alert.alert(
      'Archive Wallet',
      `Are you sure you want to archive "${wallet.name}"? Your past transactions will be preserved.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
              await archiveWallet(wallet.id);
              router.back();
            } catch (error) {
              console.error('Failed to archive wallet:', error);
              Alert.alert('Error', 'Could not archive wallet. Please try again.');
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <LoadingState message="Loading wallet..." />
      </SafeAreaView>
    );
  }

  if (!wallet) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.iconBtn}>
            <ChevronLeft size={22} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>Wallet</Text>
          <View style={styles.headerSpacer} />
        </View>
        <EmptyState
          icon={<WalletIcon size={32} color={Colors.primary} />}
          heading="Wallet not found"
          subtitle="This wallet may have been removed or archived."
          ctaLabel="Go Back"
          onCtaPress={() => router.back()}
        />
      </SafeAreaView>
    );
  }

  const chartWidth = Math.max(220, Dimensions.get('window').width - Spacing.lg * 4 - 16);
  const accentColor = wallet.color || Colors.primary;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {wallet.name}
        </Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => router.push(`/modals/add-wallet?id=${wallet.id}` as never)}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityLabel="Edit wallet"
          >
            <Pencil size={18} color={Colors.textPrimary} />
          </Pressable>
          <Pressable
            onPress={handleArchive}
            style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
            accessibilityLabel="Archive wallet"
          >
            <Archive size={18} color={Colors.expense} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadData(true)}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Wallet Hero Balance Card */}
        <Card style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={[styles.heroIconCircle, { backgroundColor: `${accentColor}20` }]}>
              {renderWalletIcon(wallet.iconName, accentColor, 26)}
            </View>
            <View style={styles.heroBadges}>
              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>
                  {WALLET_TYPE_LABELS[wallet.type] || 'Other'}
                </Text>
              </View>
              <View style={styles.currencyBadge}>
                <Text style={styles.currencyBadgeText}>{wallet.currencyCode}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.heroCaption}>Current Balance</Text>
          <Text
            style={[
              styles.heroBalance,
              balanceMinor < 0 && { color: Colors.expense },
            ]}
            numberOfLines={1}
            adjustsFontSizeToFit
          >
            {hideBalance
              ? '••••••'
              : formatCurrency(balanceMinor, wallet.currencyCode, numberFormat, decimalPlaces)}
          </Text>

          <View style={styles.heroFooter}>
            <Text style={styles.heroMetaText}>
              Opening:{' '}
              {hideBalance
                ? '••••'
                : formatCurrency(
                    wallet.openingBalanceMinor,
                    wallet.currencyCode,
                    numberFormat,
                    decimalPlaces
                  )}
            </Text>
            <Text style={styles.heroMetaDot}>•</Text>
            <Text style={styles.heroMetaText}>
              {wallet.includeInTotal ? 'Included in total' : 'Excluded from total'}
            </Text>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActionsRow}>
          <Pressable
            onPress={() =>
              router.push(`/modals/add-transaction?type=expense&walletId=${wallet.id}` as never)
            }
            style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: Colors.expenseSoft }]}>
              <ArrowUpRight size={18} color={Colors.expense} />
            </View>
            <Text style={styles.quickBtnLabel}>Add Expense</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push(`/modals/add-transaction?type=income&walletId=${wallet.id}` as never)
            }
            style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: Colors.primarySoft }]}>
              <ArrowDownLeft size={18} color={Colors.primary} />
            </View>
            <Text style={styles.quickBtnLabel}>Add Income</Text>
          </Pressable>

          <Pressable
            onPress={() =>
              router.push(`/modals/add-transaction?type=transfer&walletId=${wallet.id}` as never)
            }
            style={({ pressed }) => [styles.quickBtn, pressed && styles.pressed]}
          >
            <View style={[styles.quickIconCircle, { backgroundColor: Colors.secondarySoft }]}>
              <ArrowLeftRight size={18} color={Colors.secondary} />
            </View>
            <Text style={styles.quickBtnLabel}>Quick Transfer</Text>
          </Pressable>
        </View>

        {/* 30-Day Balance History Chart */}
        <Card style={styles.chartCard}>
          <View style={styles.chartHeader}>
            <View>
              <Text style={styles.sectionTitle}>30-Day Balance History</Text>
              <Text style={styles.chartSubtext}>Daily balance trend</Text>
            </View>
            <View style={styles.chartRangeWrap}>
              <Text style={styles.chartRangeLabel}>
                High:{' '}
                {hideBalance
                  ? '•••'
                  : formatCurrency(
                      chartStats.maxMinor,
                      wallet.currencyCode,
                      numberFormat,
                      0
                    )}
              </Text>
              <Text style={styles.chartRangeLabel}>
                Low:{' '}
                {hideBalance
                  ? '•••'
                  : formatCurrency(
                      chartStats.minMinor,
                      wallet.currencyCode,
                      numberFormat,
                      0
                    )}
              </Text>
            </View>
          </View>

          <View style={styles.chartContainer}>
            <LineChart
              data={chartStats.data}
              width={chartWidth}
              height={130}
              maxValue={chartStats.chartMaxValue}
              curved
              areaChart
              thickness={2.5}
              color={accentColor}
              startFillColor={accentColor}
              endFillColor={Colors.bgCard}
              startOpacity={0.28}
              endOpacity={0.02}
              hideDataPoints
              hideYAxisText
              yAxisThickness={0}
              xAxisThickness={1}
              xAxisColor={Colors.border}
              rulesColor={Colors.border}
              rulesType="dashed"
              noOfSections={3}
              spacing={Math.max(6, Math.floor(chartWidth / 30))}
              initialSpacing={6}
              endSpacing={6}
              xAxisLabelTextStyle={styles.xAxisLabel}
              disableScroll
            />
          </View>
        </Card>

        {/* Wallet Transactions */}
        <View style={styles.txSectionHeader}>
          <Text style={styles.sectionTitle}>Transactions</Text>
          <Text style={styles.txCountText}>{transactions.length} total</Text>
        </View>

        {transactions.length === 0 ? (
          <Card style={styles.emptyCard}>
            <EmptyState
              icon={<Receipt size={28} color={Colors.primary} />}
              heading="No transactions yet"
              subtitle={`Record your first expense, income, or transfer in ${wallet.name}.`}
              ctaLabel="Add Expense"
              onCtaPress={() =>
                router.push(`/modals/add-transaction?type=expense&walletId=${wallet.id}` as never)
              }
            />
          </Card>
        ) : (
          <Card style={styles.txListCard}>
            {transactions.map((tx, idx) => {
              const delta = getWalletDeltaMinor(tx, wallet.id);
              const isCredit = delta > 0;
              const isTransfer = tx.type === 'transfer';
              const amountColor = isTransfer
                ? Colors.secondary
                : isCredit
                  ? Colors.primary
                  : Colors.expense;
              const prefix = isCredit ? '+' : '-';

              const subtitleParts: string[] = [];
              if (isTransfer) {
                if (tx.walletId === wallet.id && tx.destinationWalletName) {
                  subtitleParts.push(`To ${tx.destinationWalletName}`);
                } else if (tx.walletName && tx.walletId !== wallet.id) {
                  subtitleParts.push(`From ${tx.walletName}`);
                } else {
                  subtitleParts.push(isCredit ? 'Incoming transfer' : 'Outgoing transfer');
                }
              } else if (tx.categoryName) {
                subtitleParts.push(tx.categoryName);
              }
              subtitleParts.push(formatRelative(tx.transactionDate));
              const timeStr = formatTime(tx.transactionDate);
              if (timeStr) subtitleParts.push(timeStr);

              const badgeBg = isTransfer
                ? Colors.secondarySoft
                : tx.categoryColor
                  ? `${tx.categoryColor}20`
                  : isCredit
                    ? Colors.primarySoft
                    : Colors.expenseSoft;

              return (
                <Pressable
                  key={tx.id}
                  onPress={() => router.push(`/modals/add-transaction?id=${tx.id}` as never)}
                  style={({ pressed }) => [
                    styles.txRow,
                    idx > 0 && styles.txRowDivider,
                    pressed && styles.txRowPressed,
                  ]}
                >
                  <View style={[styles.txIconCircle, { backgroundColor: badgeBg }]}>
                    {isTransfer ? (
                      <ArrowLeftRight size={17} color={Colors.secondary} />
                    ) : isCredit ? (
                      <ArrowDownLeft size={17} color={tx.categoryColor || Colors.primary} />
                    ) : (
                      <ArrowUpRight size={17} color={tx.categoryColor || Colors.expense} />
                    )}
                  </View>

                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {tx.title || tx.categoryName || 'Transaction'}
                    </Text>
                    <Text style={styles.txSubtitle} numberOfLines={1}>
                      {subtitleParts.join(' • ')}
                    </Text>
                  </View>

                  <Text style={[styles.txAmount, { color: amountColor }]}>
                    {hideBalance
                      ? '••••'
                      : `${prefix}${formatCurrency(
                          Math.abs(tx.amountMinor),
                          tx.currencyCode || wallet.currencyCode,
                          numberFormat,
                          decimalPlaces
                        )}`}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
        )}
      </ScrollView>
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
    gap: Spacing.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerSpacer: {
    width: 42,
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
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 100,
    gap: 14,
  },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  heroIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBadges: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  typeBadge: {
    backgroundColor: '#FAFBF9',
    borderRadius: 100,
    paddingHorizontal: Spacing.md,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  currencyBadge: {
    backgroundColor: Colors.primarySoft,
    borderRadius: 100,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 4,
  },
  currencyBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.primary,
  },
  heroCaption: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  heroBalance: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  heroFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: '#F0F4EF',
    gap: Spacing.sm,
  },
  heroMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  heroMetaDot: {
    color: Colors.textDisabled,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  quickBtn: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    paddingVertical: 14,
    paddingHorizontal: Spacing.sm,
    alignItems: 'center',
    gap: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  quickIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickBtnLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  chartCard: {
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
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  chartSubtext: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  chartRangeWrap: {
    alignItems: 'flex-end',
    gap: 2,
  },
  chartRangeLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  chartContainer: {
    overflow: 'hidden',
    paddingTop: Spacing.xs,
  },
  xAxisLabel: {
    fontSize: 10,
    color: Colors.textDisabled,
    width: 44,
  },
  txSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: -Spacing.xs,
  },
  txCountText: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  emptyCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    padding: Spacing.md,
  },
  txListCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    padding: 0,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 14,
  },
  txRowDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F0F4EF',
  },
  txRowPressed: {
    backgroundColor: '#F8FAF8',
  },
  txIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txInfo: {
    flex: 1,
    gap: 2,
  },
  txTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  txSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
});
