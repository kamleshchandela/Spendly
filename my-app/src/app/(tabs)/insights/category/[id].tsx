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
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { Calendar, ChevronLeft, Receipt } from 'lucide-react-native';
import { Colors } from '../../../../theme/colors';
import { Shadows } from '../../../../theme/shadows';
import { Spacing } from '../../../../theme/spacing';
import { Card, EmptyState, LoadingState } from '../../../../components/common';
import { getDatabase } from '../../../../database/database';
import { CategoryRepository } from '../../../../database/repositories/CategoryRepository';
import { TransactionRepository } from '../../../../database/repositories/TransactionRepository';
import { useSettingsStore } from '../../../../store/settingsStore';
import { formatCurrency } from '../../../../utils/currencyUtils';
import { formatRelative } from '../../../../utils/dateUtils';
import { pluralize } from '../../../../utils/formatUtils';
import { renderCategoryIcon } from '../../../../services/recurring/iconHelper';
import { Category } from '../../../../types/category.types';
import { TransactionWithDetails } from '../../../../types/transaction.types';

export default function CategoryInsightScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    start?: string;
    end?: string;
    label?: string;
  }>();

  const settings = useSettingsStore((s) => s.settings);
  const currency = settings?.baseCurrency || 'INR';
  const numberFormat = settings?.numberFormat || 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;

  const [category, setCategory] = useState<Category | null>(null);
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [totalPeriodExpense, setTotalPeriodExpense] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const startDate = useMemo(
    () => params.start || startOfMonth(new Date()).toISOString(),
    [params.start]
  );
  const endDate = useMemo(
    () => params.end || endOfMonth(new Date()).toISOString(),
    [params.end]
  );
  const periodLabel = params.label || format(new Date(startDate), 'MMMM yyyy');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const db = await getDatabase();
      const catRepo = new CategoryRepository(db);
      const txRepo = new TransactionRepository(db);

      const isUncategorized = !params.id || params.id === 'uncategorized';
      const [cat, summary, allTxs] = await Promise.all([
        isUncategorized ? Promise.resolve(null) : catRepo.getById(params.id),
        txRepo.getSummary(startDate, endDate),
        txRepo.getAll({
          type: 'expense',
          categoryIds: isUncategorized ? undefined : [params.id],
          startDate,
          endDate,
          sortBy: 'date_desc',
        }),
      ]);

      const filtered = isUncategorized
        ? allTxs.filter((t) => !t.categoryId)
        : allTxs;

      setCategory(cat);
      setTotalPeriodExpense(summary.expenseMinor);
      setTransactions(filtered);
    } catch (error) {
      console.error('CategoryInsightScreen load error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [params.id, startDate, endDate]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData])
  );

  const totalMinor = useMemo(
    () => transactions.reduce((sum, t) => sum + t.amountMinor, 0),
    [transactions]
  );
  const averageMinor = useMemo(
    () => (transactions.length > 0 ? Math.round(totalMinor / transactions.length) : 0),
    [totalMinor, transactions.length]
  );
  const sharePercent = useMemo(
    () => (totalPeriodExpense > 0 ? Math.round((totalMinor / totalPeriodExpense) * 100) : 0),
    [totalMinor, totalPeriodExpense]
  );

  const formatAmt = (minor: number) =>
    formatCurrency(minor, currency, numberFormat, decimalPlaces);

  const catColor = category?.color || '#A0A0A0';
  const catName = category?.name || 'Uncategorized';
  const catIcon = category?.iconName || 'package';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={20} color={Colors.textPrimary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {catName}
          </Text>
          <View style={styles.periodTag}>
            <Calendar size={12} color={Colors.textSecondary} />
            <Text style={styles.headerSubtitle}>{periodLabel}</Text>
          </View>
        </View>
        <View style={styles.headerSpacer} />
      </View>

      {isLoading ? (
        <LoadingState message="Loading category insights..." />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Summary Card */}
          <Card style={styles.heroCard}>
            <View style={[styles.heroIcon, { backgroundColor: `${catColor}20` }]}>
              {renderCategoryIcon(catIcon, 28, catColor)}
            </View>
            <Text style={styles.heroLabel}>Total Spent</Text>
            <Text style={styles.heroAmount}>{formatAmt(totalMinor)}</Text>
            <View style={[styles.sharePill, { backgroundColor: `${catColor}18` }]}>
              <Text style={[styles.sharePillText, { color: catColor }]}>
                {sharePercent}% of total spending
              </Text>
            </View>

            <View style={styles.statsDivider} />

            <View style={styles.statsRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{transactions.length}</Text>
                <Text style={styles.statLabel}>
                  {pluralize(transactions.length, 'Transaction')}
                </Text>
              </View>
              <View style={styles.statVerticalDivider} />
              <View style={styles.statBox}>
                <Text style={styles.statValue}>{formatAmt(averageMinor)}</Text>
                <Text style={styles.statLabel}>Avg per tx</Text>
              </View>
            </View>
          </Card>

          {/* Transactions List */}
          <Card style={styles.listCard}>
            <Text style={styles.sectionTitle}>Transactions</Text>
            {transactions.length === 0 ? (
              <EmptyState
                icon={<Receipt size={28} color={Colors.primary} />}
                heading="No transactions"
                subtitle={`No expenses recorded in ${catName} for ${periodLabel}.`}
              />
            ) : (
              transactions.map((tx, idx) => (
                <Pressable
                  key={tx.id}
                  onPress={() =>
                    router.push({
                      pathname: '/modals/add-transaction',
                      params: { id: tx.id },
                    } as never)
                  }
                  style={({ pressed }) => [
                    styles.txRow,
                    idx < transactions.length - 1 && styles.rowDivider,
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={styles.txInfo}>
                    <Text style={styles.txTitle} numberOfLines={1}>
                      {tx.title}
                    </Text>
                    <Text style={styles.txMeta}>
                      {formatRelative(tx.transactionDate)}
                      {tx.walletName ? ` · ${tx.walletName}` : ''}
                    </Text>
                  </View>
                  <Text style={styles.txAmount}>-{formatAmt(tx.amountMinor)}</Text>
                </Pressable>
              ))
            )}
          </Card>
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
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    gap: Spacing.sm,
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
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  periodTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  headerSpacer: {
    width: 42,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 150,
    gap: 14,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  heroLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  heroAmount: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  sharePill: {
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 100,
  },
  sharePillText: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  statsDivider: {
    width: '100%',
    height: 1,
    backgroundColor: '#F0F4EF',
    marginVertical: 18,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    alignItems: 'center',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statVerticalDivider: {
    width: 1,
    height: 32,
    backgroundColor: '#F0F4EF',
  },
  statValue: {
    fontSize: 17,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  listCard: {
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
    gap: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    marginBottom: 4,
  },
  txRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4EF',
  },
  txInfo: {
    flex: 1,
  },
  txTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  txMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    marginTop: 2,
  },
  txAmount: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.expense,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
  },
});
