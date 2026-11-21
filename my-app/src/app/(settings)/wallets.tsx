/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useState } from 'react';
import {
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
import {
  Banknote,
  Briefcase,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Coins,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  Shield,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import { Card, EmptyState, LoadingState } from '../../components/common';
import { getDatabase } from '../../database/database';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { FinanceCalculator } from '../../services/finance/FinanceCalculator';
import { useSettingsStore } from '../../store/settingsStore';
import { useWalletStore } from '../../store/walletStore';
import { Colors, Shadows, Shapes, Spacing } from '../../theme';
import { Wallet, WalletType } from '../../types/wallet.types';
import { formatCurrency } from '../../utils/currencyUtils';
import { pluralize } from '../../utils/formatUtils';

const WALLET_TYPE_LABELS: Record<WalletType, string> = {
  cash: 'Cash',
  bank: 'Bank',
  savings: 'Savings',
  credit: 'Credit',
  other: 'Other',
};

const renderWalletIcon = (iconName: string, color: string, size: number = 22) => {
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

interface WalletItemData {
  wallet: Wallet;
  balanceMinor: number;
  transactionCount: number;
}

export default function WalletsScreen() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const loadWalletStore = useWalletStore((s) => s.loadWallets);

  const [items, setItems] = useState<WalletItemData[]>([]);
  const [totalBalanceMinor, setTotalBalanceMinor] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reordering, setReordering] = useState(false);

  const numberFormat = settings?.numberFormat ?? 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  const baseCurrency = settings?.baseCurrency ?? 'INR';
  const hideBalance = settings?.hideBalance ?? false;

  const fetchWallets = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const db = await getDatabase();
      const walletRepo = new WalletRepository(db);
      const wallets = await walletRepo.getAll(false);

      const enriched: WalletItemData[] = [];
      let total = 0;

      for (const wallet of wallets) {
        const balanceMinor = await FinanceCalculator.getWalletBalance(wallet.id);
        const countRow = await db.getFirstAsync<{ count: number }>(
          `SELECT COUNT(*) AS count FROM transactions
           WHERE is_deleted = 0 AND (wallet_id = ? OR (destination_wallet_id = ? AND transfer_group_id IS NULL))`,
          [wallet.id, wallet.id]
        );
        const transactionCount = countRow?.count ?? 0;

        enriched.push({ wallet, balanceMinor, transactionCount });
        if (wallet.includeInTotal) {
          total += balanceMinor;
        }
      }

      setItems(enriched);
      setTotalBalanceMinor(total);
    } catch (error) {
      console.error('Failed to load wallets:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchWallets();
    }, [fetchWallets])
  );

  const handleMove = async (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length || reordering) return;

    setReordering(true);
    Haptics.selectionAsync().catch(() => {});
    try {
      const reordered = [...items];
      const [moved] = reordered.splice(index, 1);
      reordered.splice(targetIndex, 0, moved);

      // Optimistic UI update
      setItems(reordered);

      const db = await getDatabase();
      const walletRepo = new WalletRepository(db);
      for (let i = 0; i < reordered.length; i++) {
        await walletRepo.reorder(reordered[i].wallet.id, i);
      }
      await loadWalletStore();
    } catch (error) {
      console.error('Failed to reorder wallets:', error);
      await fetchWallets();
    } finally {
      setReordering(false);
    }
  };

  const includedCount = items.filter((item) => item.wallet.includeInTotal).length;

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
          <ChevronLeft size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Wallets</Text>
        <Pressable
          onPress={() => router.push('/modals/add-wallet' as never)}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Add wallet"
        >
          <Plus size={20} color={Colors.textInverse} />
        </Pressable>
      </View>

      {loading ? (
        <LoadingState message="Loading wallets..." />
      ) : items.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <EmptyState
            icon={<WalletIcon size={32} color={Colors.primary} />}
            heading="No wallets yet"
            subtitle="Add your cash, bank accounts, or cards to start tracking balances cleanly."
            ctaLabel="Add Wallet"
            onCtaPress={() => router.push('/modals/add-wallet' as never)}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchWallets(true)}
              tintColor={Colors.primary}
            />
          }
        >
          <View style={styles.list}>
            {items.map((item, index) => {
              const { wallet, balanceMinor, transactionCount } = item;
              const isNegative = balanceMinor < 0;
              const displayBalance = hideBalance
                ? '••••••'
                : formatCurrency(balanceMinor, wallet.currencyCode, numberFormat, decimalPlaces);

              return (
                <Card
                  key={wallet.id}
                  onPress={() => router.push(`/(settings)/wallet-detail?id=${wallet.id}` as never)}
                  style={styles.walletCard}
                >
                  <View style={styles.walletRow}>
                    {/* Colored Icon Circle */}
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: `${wallet.color}20` },
                      ]}
                    >
                      {renderWalletIcon(wallet.iconName, wallet.color, 22)}
                    </View>

                    {/* Wallet Info */}
                    <View style={styles.walletInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.walletName} numberOfLines={1}>
                          {wallet.name}
                        </Text>
                        <View style={styles.typeBadge}>
                          <Text style={styles.typeBadgeText}>
                            {WALLET_TYPE_LABELS[wallet.type] || 'Other'}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.metaRow}>
                        <Text style={styles.metaText}>
                          {transactionCount} {pluralize(transactionCount, 'transaction')}
                        </Text>
                        {!wallet.includeInTotal && (
                          <View style={styles.excludedPill}>
                            <Text style={styles.excludedText}>Excluded</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Balance */}
                    <View style={styles.rightCol}>
                      <Text
                        style={[
                          styles.balanceText,
                          isNegative && styles.negativeBalance,
                        ]}
                        numberOfLines={1}
                      >
                        {displayBalance}
                      </Text>

                      {/* Reorder Controls */}
                      {items.length > 1 && (
                        <View style={styles.reorderRow}>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              handleMove(index, 'up');
                            }}
                            disabled={index === 0 || reordering}
                            hitSlop={6}
                            style={[
                              styles.reorderBtn,
                              index === 0 && styles.reorderBtnDisabled,
                            ]}
                            accessibilityLabel={`Move ${wallet.name} up`}
                          >
                            <ChevronUp
                              size={16}
                              color={index === 0 ? Colors.textDisabled : Colors.textSecondary}
                            />
                          </Pressable>
                          <Pressable
                            onPress={(e) => {
                              e.stopPropagation();
                              handleMove(index, 'down');
                            }}
                            disabled={index === items.length - 1 || reordering}
                            hitSlop={6}
                            style={[
                              styles.reorderBtn,
                              index === items.length - 1 && styles.reorderBtnDisabled,
                            ]}
                            accessibilityLabel={`Move ${wallet.name} down`}
                          >
                            <ChevronDown
                              size={16}
                              color={
                                index === items.length - 1
                                  ? Colors.textDisabled
                                  : Colors.textSecondary
                              }
                            />
                          </Pressable>
                        </View>
                      )}
                    </View>
                  </View>
                </Card>
              );
            })}
          </View>

          {/* Bottom Total Balance Card */}
          <Card style={styles.totalCard}>
            <View style={styles.totalLeft}>
              <Text style={styles.totalLabel}>Total Balance</Text>
              <Text style={styles.totalSubtext}>
                Across {includedCount} included {pluralize(includedCount, 'wallet')}
              </Text>
            </View>
            <Text style={styles.totalAmount} numberOfLines={1}>
              {hideBalance
                ? '••••••'
                : formatCurrency(totalBalanceMinor, baseCurrency, numberFormat, decimalPlaces)}
            </Text>
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
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
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
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 100,
    gap: 14,
  },
  list: {
    gap: 12,
  },
  walletCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  walletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  walletInfo: {
    flex: 1,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  walletName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
    flexShrink: 1,
  },
  typeBadge: {
    backgroundColor: '#FAFBF9',
    borderRadius: 100,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  metaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  excludedPill: {
    backgroundColor: Colors.warningSoft,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 100,
  },
  excludedText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.warning,
  },
  rightCol: {
    alignItems: 'flex-end',
    gap: 6,
  },
  balanceText: {
    fontSize: 16,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  negativeBalance: {
    color: Colors.expense,
  },
  reorderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  reorderBtn: {
    width: 28,
    height: 26,
    borderRadius: 8,
    backgroundColor: '#FAFBF9',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  reorderBtnDisabled: {
    opacity: 0.35,
  },
  totalCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primarySoft,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#C6E8D5',
    paddingVertical: 18,
    paddingHorizontal: 20,
  },
  totalLeft: {
    gap: 2,
    flex: 1,
  },
  totalLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  totalSubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  totalAmount: {
    fontSize: 22,
    fontWeight: '800',
    color: Colors.primary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.4,
  },
});
