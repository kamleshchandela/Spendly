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
  BackHandler,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../../components/common/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import Swipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeftRight,
  ArrowRight,
  Pencil,
  Receipt,
  RotateCcw,
  Search,
  SearchX,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react-native';
import { format } from 'date-fns';
import { getDatabase } from '../../../database/database';
import { TransactionRepository } from '../../../database/repositories/TransactionRepository';
import { TransactionFilters, TransactionWithDetails } from '../../../types/transaction.types';
import { useSettingsStore } from '../../../store/settingsStore';
import { useWalletStore } from '../../../store/walletStore';
import { useCategoryStore } from '../../../store/categoryStore';
import { useBudgetStore } from '../../../store/budgetStore';
import { BudgetNotifier } from '../../../services/notifications/BudgetNotifier';
import { Colors } from '../../../theme/colors';
import { Spacing } from '../../../theme/spacing';
import { Shapes } from '../../../theme/shapes';
import { Shadows } from '../../../theme/shadows';
import { Typography } from '../../../theme/typography';
import { TRANSACTION_PAGE_SIZE, UNDO_TIMEOUT_MS } from '../../../constants/config';
import { formatCurrency } from '../../../utils/currencyUtils';
import { formatDisplay, formatRelative, formatTime } from '../../../utils/dateUtils';
import { EmptyState } from '../../../components/common/EmptyState';
import {
  CategoryIcon,
  TransactionDetailSheet,
} from '../../../components/sheets/TransactionDetailSheet';
import { DateRangePreset, FilterSheet } from '../../../components/sheets/FilterSheet';
import { useTabBarStore } from '../../../store/tabBarStore';

export interface GroupedTransactionSection {
  date: string;
  transactions: TransactionWithDetails[];
  dayNet: number;
}

export function groupTransactionsByDate(
  transactions: TransactionWithDetails[]
): GroupedTransactionSection[] {
  const map = new Map<string, GroupedTransactionSection>();

  for (const tx of transactions) {
    let dayKey: string;
    try {
      dayKey = format(new Date(tx.transactionDate), 'yyyy-MM-dd');
    } catch {
      dayKey = tx.transactionDate.slice(0, 10);
    }

    let group = map.get(dayKey);
    if (!group) {
      group = {
        date: tx.transactionDate,
        transactions: [],
        dayNet: 0,
      };
      map.set(dayKey, group);
    }

    group.transactions.push(tx);
    if (tx.type === 'income') {
      group.dayNet += tx.amountMinor;
    } else if (tx.type === 'expense') {
      group.dayNet -= tx.amountMinor;
    }
  }

  return Array.from(map.values());
}

function deduplicateTransfers(
  rows: TransactionWithDetails[],
  hasWalletFilter: boolean
): TransactionWithDetails[] {
  if (!hasWalletFilter) {
    // Keep only the primary (debit) transfer record which carries destinationWalletId
    return rows.filter(
      (t) => !(t.type === 'transfer' && t.transferGroupId && !t.destinationWalletId)
    );
  }
  // When wallet filter is active, always prefer the debit leg (destinationWalletId !== null)
  // per transferGroupId so Source to Destination always displays accurately.
  const preferredByGroup = new Map<string, TransactionWithDetails>();
  for (const tx of rows) {
    if (tx.type === 'transfer' && tx.transferGroupId) {
      const existing = preferredByGroup.get(tx.transferGroupId);
      if (!existing || (!existing.destinationWalletId && tx.destinationWalletId !== null)) {
        preferredByGroup.set(tx.transferGroupId, tx);
      }
    }
  }

  const emittedGroups = new Set<string>();
  const result: TransactionWithDetails[] = [];
  for (const tx of rows) {
    if (tx.type === 'transfer' && tx.transferGroupId) {
      if (emittedGroups.has(tx.transferGroupId)) continue;
      emittedGroups.add(tx.transferGroupId);
      const preferred = preferredByGroup.get(tx.transferGroupId);
      result.push(preferred ?? tx);
    } else {
      result.push(tx);
    }
  }
  return result;
}

type FlatRowItem =
  | {
      kind: 'header';
      key: string;
      date: string;
      dayNet: number;
    }
  | {
      kind: 'item';
      key: string;
      transaction: TransactionWithDetails;
      isFirstInGroup: boolean;
      isLastInGroup: boolean;
    };

const DATE_PRESET_LABELS: Record<DateRangePreset, string> = {
  all: 'All Time',
  today: 'Today',
  week: 'This Week',
  month: 'This Month',
  year: 'This Year',
  custom: 'Custom Range',
};

const SORT_LABELS: Record<NonNullable<TransactionFilters['sortBy']>, string> = {
  date_desc: 'Newest First',
  date_asc: 'Oldest First',
  amount_desc: 'Amount High–Low',
  amount_asc: 'Amount Low–High',
};

interface TransactionRowProps {
  transaction: TransactionWithDetails;
  isFirstInGroup: boolean;
  isLastInGroup: boolean;
  currencyCode: string;
  numberFormat: 'indian' | 'international';
  decimalPlaces: number;
  onPress: (tx: TransactionWithDetails) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSwipeOpen: (ref: SwipeableMethods) => void;
}

const TransactionRow: React.FC<TransactionRowProps> = React.memo(
  ({
    transaction,
    isFirstInGroup,
    isLastInGroup,
    currencyCode,
    numberFormat,
    decimalPlaces,
    onPress,
    onEdit,
    onDelete,
    onSwipeOpen,
  }) => {
    const swipeRef = useRef<SwipeableMethods>(null);

    const isExpense = transaction.type === 'expense';
    const isIncome = transaction.type === 'income';
    const isTransfer = transaction.type === 'transfer';

    const prefix = isExpense ? '−' : isIncome ? '+' : '';
    const amountColor = isExpense
      ? Colors.expense
      : isIncome
        ? Colors.primary
        : Colors.secondary;
    const iconBg = isTransfer
      ? Colors.secondary
      : transaction.categoryColor || Colors.primary;

    const title =
      transaction.title?.trim() ||
      (isTransfer ? 'Transfer' : transaction.categoryName || 'Transaction');

    const subtitle = `${transaction.categoryName || 'Uncategorized'} · ${
      transaction.walletName || 'Wallet'
    }`;

    const timeStr = formatTime(transaction.transactionDate);
    const formattedAmount = formatCurrency(
      transaction.amountMinor,
      transaction.currencyCode || currencyCode,
      numberFormat,
      decimalPlaces
    );

    const renderRightActions = () => (
      <View style={styles.swipeActionsRow}>
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onEdit(transaction.id);
          }}
          style={[styles.swipeActionBtn, styles.swipeEditBtn]}
          accessibilityRole="button"
          accessibilityLabel="Edit transaction"
        >
          <Pencil size={18} color={Colors.textInverse} />
          <Text style={styles.swipeActionText}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            swipeRef.current?.close();
            onDelete(transaction.id);
          }}
          style={[
            styles.swipeActionBtn,
            styles.swipeDeleteBtn,
            isFirstInGroup && { borderTopRightRadius: 20 },
            isLastInGroup && { borderBottomRightRadius: 20 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Delete transaction"
        >
          <Trash2 size={18} color={Colors.textInverse} />
          <Text style={styles.swipeActionText}>Delete</Text>
        </Pressable>
      </View>
    );

    return (
      <View
        style={[
          styles.rowCardContainer,
          isFirstInGroup && styles.rowCardFirst,
          isLastInGroup && styles.rowCardLast,
        ]}
      >
        <Swipeable
          ref={swipeRef}
          friction={1}
          dragOffsetFromRight={-35}
          dragOffsetFromLeft={1000}
          rightThreshold={72}
          overshootRight={false}
          renderRightActions={renderRightActions}
          onSwipeableWillOpen={() => {
            if (swipeRef.current) {
              onSwipeOpen(swipeRef.current);
            }
          }}
        >
          <Pressable
            onPress={() => onPress(transaction)}
            style={({ pressed }) => [
              styles.rowInner,
              pressed && styles.rowPressed,
              !isLastInGroup && styles.rowDivider,
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${title}, ${prefix}${formattedAmount}`}
          >
            <View style={[styles.iconCircle, { backgroundColor: iconBg }]}>
              <CategoryIcon
                iconName={transaction.categoryIcon}
                size={20}
                color={Colors.textInverse}
                isTransfer={isTransfer}
                fallbackLabel={transaction.categoryName || title}
              />
            </View>

            <View style={styles.rowCenter}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {title}
              </Text>
              {isTransfer ? (
                <View style={styles.transferSubtitleRow}>
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {transaction.walletName || 'Wallet'}
                  </Text>
                  <ArrowRight size={13} color={Colors.textSecondary} strokeWidth={2} />
                  <Text style={styles.rowSubtitle} numberOfLines={1}>
                    {transaction.destinationWalletName || 'Wallet'}
                  </Text>
                </View>
              ) : (
                <Text style={styles.rowSubtitle} numberOfLines={1}>
                  {subtitle}
                </Text>
              )}
              {timeStr ? <Text style={styles.rowTime}>{timeStr}</Text> : null}
            </View>

            <View style={styles.rowRight}>
              <View style={styles.amountValueRow}>
                {isTransfer && (
                  <ArrowLeftRight size={14} color={Colors.secondary} strokeWidth={2.2} />
                )}
                <Text style={[styles.rowAmount, { color: amountColor }]} numberOfLines={1}>
                  {prefix}
                  {formattedAmount}
                </Text>
              </View>
            </View>
          </Pressable>
        </Swipeable>
      </View>
    );
  }
);

export default function TransactionListScreen() {
  const router = useRouter();
  const { settings } = useSettingsStore();
  const { wallets, loadWallets } = useWalletStore();
  const { categories, loadCategories } = useCategoryStore();
  const { loadBudgets } = useBudgetStore();

  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const [filters, setFilters] = useState<TransactionFilters>({
    type: 'all',
    sortBy: 'date_desc',
  });
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all');

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchAnim = useRef(new Animated.Value(0)).current;
  const searchInputRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const [filterSheetVisible, setFilterSheetVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionWithDetails | null>(
    null
  );
  const setTabBarVisible = useTabBarStore((s) => s.setTabBarVisible);

  // Automatically hide floating bottom tab bar when any bottom sheet is open
  useEffect(() => {
    const isSheetOpen = filterSheetVisible || selectedTransaction !== null;
    setTabBarVisible(!isSheetOpen);
    return () => {
      setTabBarVisible(true);
    };
  }, [filterSheetVisible, selectedTransaction, setTabBarVisible]);

  // Undo toast state
  const [deletedTxId, setDeletedTxId] = useState<string | null>(null);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastAnim = useRef(new Animated.Value(0)).current;

  // Keep track of open swipeable so only one stays open at a time
  const openSwipeRef = useRef<SwipeableMethods | null>(null);

  const currencyCode = settings?.baseCurrency || 'INR';
  const numberFormat = settings?.numberFormat || 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;

  // Debounce search text
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchText.trim());
    }, 200);
    return () => clearTimeout(timer);
  }, [searchText]);

  // Animate search bar expand/collapse
  useEffect(() => {
    Animated.timing(searchAnim, {
      toValue: searchOpen ? 1 : 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      if (searchOpen) {
        searchInputRef.current?.focus();
      }
    });
  }, [searchOpen, searchAnim]);

  // Animate undo toast
  useEffect(() => {
    Animated.timing(toastAnim, {
      toValue: deletedTxId ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [deletedTxId, toastAnim]);

  useEffect(() => {
    return () => {
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    };
  }, []);

  const buildQueryFilters = useCallback(
    (offset: number): TransactionFilters => ({
      ...filters,
      searchQuery: debouncedSearch || undefined,
      limit: TRANSACTION_PAGE_SIZE,
      offset,
    }),
    [filters, debouncedSearch]
  );

  const fetchTransactions = useCallback(
    async (mode: 'initial' | 'refresh' | 'more' = 'initial') => {
      try {
        const currentOffset = mode === 'more' ? transactions.length : 0;
        if (mode === 'initial') setIsInitialLoading(true);
        if (mode === 'refresh') setIsRefreshing(true);
        if (mode === 'more') setIsLoadingMore(true);

        const db = await getDatabase();
        const repo = new TransactionRepository(db);
        const rawRows = await repo.getAll(buildQueryFilters(currentOffset));
        const hasWalletFilter = Boolean(filters.walletIds && filters.walletIds.length > 0);
        const cleaned = deduplicateTransfers(rawRows, hasWalletFilter);

        if (mode === 'more') {
          setTransactions((prev) => {
            const existingIds = new Set(prev.map((item) => item.id));
            const uniqueNext = cleaned.filter((item) => !existingIds.has(item.id));
            return [...prev, ...uniqueNext];
          });
        } else {
          setTransactions(cleaned);
        }

        setHasMore(rawRows.length >= TRANSACTION_PAGE_SIZE);
      } catch (err) {
        console.error('[TransactionList] load failed:', err);
      } finally {
        setIsInitialLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [buildQueryFilters, filters.walletIds, transactions.length]
  );

  // Reload whenever filters or search change
  useEffect(() => {
    fetchTransactions('initial');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, debouncedSearch]);

  // Reload metadata and transactions whenever screen gains focus
  useFocusEffect(
    useCallback(() => {
      loadWallets().catch(() => {});
      loadCategories().catch(() => {});
      fetchTransactions('refresh');

      return () => {
        // Guarantee that tab bar is ALWAYS restored when switching away
        setTabBarVisible(true);
      };
    }, [loadWallets, loadCategories, fetchTransactions, setTabBarVisible])
  );

  // Hardware back button: If filter or detail sheet is open, dismiss it first without leaving Transactions
  useEffect(() => {
    if (!filterSheetVisible && !selectedTransaction) return;

    const onBackPress = () => {
      if (filterSheetVisible) {
        setFilterSheetVisible(false);
        return true;
      }
      if (selectedTransaction !== null) {
        setSelectedTransaction(null);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
    return () => {
      subscription.remove();
    };
  }, [filterSheetVisible, selectedTransaction]);

  const handleLoadMore = useCallback(() => {
    if (isInitialLoading || isRefreshing || isLoadingMore || !hasMore) return;
    fetchTransactions('more');
  }, [fetchTransactions, hasMore, isInitialLoading, isLoadingMore, isRefreshing]);

  const handleSwipeOpen = useCallback((ref: SwipeableMethods) => {
    if (openSwipeRef.current && openSwipeRef.current !== ref) {
      openSwipeRef.current.close();
    }
    openSwipeRef.current = ref;
  }, []);

  const handleEdit = useCallback(
    (id: string) => {
      setSelectedTransaction(null);
      router.push(`/modals/add-transaction?id=${id}` as never);
    },
    [router]
  );

  const showUndoToast = useCallback((txId: string) => {
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setDeletedTxId(txId);
    undoTimerRef.current = setTimeout(() => {
      setDeletedTxId(null);
    }, UNDO_TIMEOUT_MS);
  }, []);

  const checkBudgetNotifications = useCallback(() => {
    try {
      const activeBudgets = useBudgetStore.getState().budgets.filter((b) => b.isActive);
      void Promise.all(
        activeBudgets.map((b) => {
          const thresholdPct =
            b.warningThreshold > 0 && b.warningThreshold <= 1
              ? Math.round(b.warningThreshold * 100)
              : b.warningThreshold > 1
                ? Math.round(b.warningThreshold)
                : undefined;
          return BudgetNotifier.checkAndNotify(b.id, b.percentage, b.name, thresholdPct);
        })
      ).catch(() => {});
    } catch {
      // Non-blocking
    }
  }, []);

  const executeSoftDelete = useCallback(
    async (id: string) => {
      try {
        const db = await getDatabase();
        const repo = new TransactionRepository(db);
        await repo.softDelete(id);
        setTransactions((prev) => prev.filter((item) => item.id !== id));
        await Promise.all([
          loadWallets().catch(() => {}),
          loadBudgets().catch(() => {}),
        ]);
        checkBudgetNotifications();
        if (settings?.hapticEnabled !== false) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
        showUndoToast(id);
      } catch (err) {
        console.error('[TransactionList] delete failed:', err);
        Alert.alert('Error', 'Could not delete this transaction. Please try again.');
      }
    },
    [checkBudgetNotifications, loadBudgets, loadWallets, settings?.hapticEnabled, showUndoToast]
  );

  const handleDeleteRequest = useCallback(
    (id: string) => {
      setSelectedTransaction(null);
      Alert.alert(
        'Delete this transaction?',
        'This will update your wallet balance and reports.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: () => {
              executeSoftDelete(id);
            },
          },
        ]
      );
    },
    [executeSoftDelete]
  );

  const handleUndoDelete = useCallback(async () => {
    if (!deletedTxId) return;
    const txId = deletedTxId;
    if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
    setDeletedTxId(null);

    try {
      const db = await getDatabase();
      const repo = new TransactionRepository(db);
      await repo.restore(txId);
      await Promise.all([
        loadWallets().catch(() => {}),
        loadBudgets().catch(() => {}),
        fetchTransactions('refresh'),
      ]);
      checkBudgetNotifications();
      if (settings?.hapticEnabled !== false) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    } catch (err) {
      console.error('[TransactionList] undo failed:', err);
    }
  }, [
    checkBudgetNotifications,
    deletedTxId,
    fetchTransactions,
    loadBudgets,
    loadWallets,
    settings?.hapticEnabled,
  ]);

  const handleResetFilters = useCallback(() => {
    setFilters({ type: 'all', sortBy: 'date_desc' });
    setDatePreset('all');
    setSearchText('');
    setDebouncedSearch('');
  }, []);

  // Active filter chips computation
  const activeFilterChips = useMemo(() => {
    const chips: Array<{ id: string; label: string; onDismiss: () => void }> = [];

    if (filters.type && filters.type !== 'all') {
      const typeLabel =
        filters.type === 'expense'
          ? 'Expenses'
          : filters.type === 'income'
            ? 'Income'
            : 'Transfers';
      chips.push({
        id: 'type',
        label: typeLabel,
        onDismiss: () => setFilters((prev) => ({ ...prev, type: 'all' })),
      });
    }

    if (datePreset !== 'all') {
      const label =
        datePreset === 'custom' && filters.startDate && filters.endDate
          ? `${formatDisplay(filters.startDate, 'dd MMM')} – ${formatDisplay(
              filters.endDate,
              'dd MMM'
            )}`
          : DATE_PRESET_LABELS[datePreset];
      chips.push({
        id: 'date',
        label,
        onDismiss: () => {
          setDatePreset('all');
          setFilters((prev) => ({ ...prev, startDate: undefined, endDate: undefined }));
        },
      });
    }

    if (filters.categoryIds && filters.categoryIds.length > 0) {
      for (const catId of filters.categoryIds) {
        const cat = categories.find((c) => c.id === catId);
        chips.push({
          id: `cat-${catId}`,
          label: cat?.name || 'Category',
          onDismiss: () =>
            setFilters((prev) => {
              const remaining = (prev.categoryIds || []).filter((id) => id !== catId);
              return {
                ...prev,
                categoryIds: remaining.length > 0 ? remaining : undefined,
              };
            }),
        });
      }
    }

    if (filters.walletIds && filters.walletIds.length > 0) {
      for (const walletId of filters.walletIds) {
        const wallet = wallets.find((w) => w.id === walletId);
        chips.push({
          id: `wallet-${walletId}`,
          label: wallet?.name || 'Wallet',
          onDismiss: () =>
            setFilters((prev) => {
              const remaining = (prev.walletIds || []).filter((id) => id !== walletId);
              return {
                ...prev,
                walletIds: remaining.length > 0 ? remaining : undefined,
              };
            }),
        });
      }
    }

    if (filters.sortBy && filters.sortBy !== 'date_desc') {
      chips.push({
        id: 'sort',
        label: SORT_LABELS[filters.sortBy],
        onDismiss: () => setFilters((prev) => ({ ...prev, sortBy: 'date_desc' })),
      });
    }

    return chips;
  }, [categories, datePreset, filters, wallets]);

  const activeFilterCount = activeFilterChips.length;
  const hasAnyActiveFilterOrSearch = activeFilterCount > 0 || debouncedSearch.length > 0;

  // Group transactions by date and flatten for list
  const flatRows = useMemo(() => {
    const groups = groupTransactionsByDate(transactions);
    const rows: FlatRowItem[] = [];

    for (const group of groups) {
      rows.push({
        kind: 'header',
        key: `header-${group.date.slice(0, 10)}`,
        date: group.date,
        dayNet: group.dayNet,
      });

      group.transactions.forEach((tx, idx) => {
        rows.push({
          kind: 'item',
          key: tx.id,
          transaction: tx,
          isFirstInGroup: idx === 0,
          isLastInGroup: idx === group.transactions.length - 1,
        });
      });
    }

    return rows;
  }, [transactions]);

  const searchBarHeight = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 52],
  });

  const searchBarMarginBottom = searchAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Spacing.sm],
  });

  const renderFlatRow = useCallback(
    ({ item }: { item: FlatRowItem }) => {
      if (item.kind === 'header') {
        const netPositive = item.dayNet > 0;
        const netNegative = item.dayNet < 0;
        const netColor = netPositive
          ? Colors.primary
          : netNegative
            ? Colors.expense
            : Colors.textSecondary;
        const netPrefix = netPositive ? '+' : netNegative ? '−' : '';
        const netFormatted = formatCurrency(
          Math.abs(item.dayNet),
          currencyCode,
          numberFormat,
          decimalPlaces
        );

        return (
          <View style={styles.dateHeader}>
            <Text style={styles.dateHeaderLabel}>{formatRelative(item.date)}</Text>
            <Text style={[styles.dateHeaderNet, { color: netColor }]}>
              {netPrefix}
              {netFormatted}
            </Text>
          </View>
        );
      }

      return (
        <TransactionRow
          transaction={item.transaction}
          isFirstInGroup={item.isFirstInGroup}
          isLastInGroup={item.isLastInGroup}
          currencyCode={currencyCode}
          numberFormat={numberFormat}
          decimalPlaces={decimalPlaces}
          onPress={setSelectedTransaction}
          onEdit={handleEdit}
          onDelete={handleDeleteRequest}
          onSwipeOpen={handleSwipeOpen}
        />
      );
    },
    [
      currencyCode,
      decimalPlaces,
      handleDeleteRequest,
      handleEdit,
      handleSwipeOpen,
      numberFormat,
    ]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Transactions</Text>
        <View style={styles.headerActions}>
          <Pressable
            onPress={() => {
              if (settings?.hapticEnabled !== false) {
                Haptics.selectionAsync().catch(() => {});
              }
              if (searchOpen) {
                setSearchText('');
                setDebouncedSearch('');
              }
              setSearchOpen((prev) => !prev);
            }}
            style={({ pressed }) => [
              styles.iconButton,
              searchOpen && styles.iconButtonActive,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Search transactions"
          >
            <Search
              size={20}
              color={searchOpen ? Colors.primary : Colors.textPrimary}
              strokeWidth={2}
            />
          </Pressable>

          <Pressable
            onPress={() => {
              if (settings?.hapticEnabled !== false) {
                Haptics.selectionAsync().catch(() => {});
              }
              setFilterSheetVisible(true);
            }}
            style={({ pressed }) => [
              styles.iconButton,
              activeFilterCount > 0 && styles.iconButtonActive,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Filter transactions"
          >
            <SlidersHorizontal
              size={20}
              color={activeFilterCount > 0 ? Colors.primary : Colors.textPrimary}
              strokeWidth={2}
            />
            {activeFilterCount > 0 && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>
                  {activeFilterCount > 9 ? '9+' : activeFilterCount}
                </Text>
              </View>
            )}
          </Pressable>
        </View>
      </View>

      {/* Expandable Search Bar */}
      <Animated.View
        style={[
          styles.searchContainer,
          {
            height: searchBarHeight,
            opacity: searchAnim,
            marginBottom: searchBarMarginBottom,
          },
        ]}
        pointerEvents={searchOpen ? 'auto' : 'none'}
      >
        <View style={styles.searchInputBox}>
          <Search size={18} color={Colors.textSecondary} />
          <TextInput
            ref={searchInputRef}
            value={searchText}
            onChangeText={setSearchText}
            placeholder="Search transactions..."
            placeholderTextColor={Colors.textDisabled}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
          {searchText.length > 0 && (
            <Pressable
              onPress={() => setSearchText('')}
              style={styles.searchClearBtn}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <X size={16} color={Colors.textSecondary} />
            </Pressable>
          )}
        </View>
      </Animated.View>

      {/* Active Filter Chips Row */}
      {activeFilterChips.length > 0 && (
        <View style={styles.chipsRowWrapper}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipsRowContent}
          >
            {activeFilterChips.map((chip) => (
              <Pressable
                key={chip.id}
                onPress={chip.onDismiss}
                style={styles.activeChip}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${chip.label} filter`}
              >
                <Text style={styles.activeChipText}>{chip.label}</Text>
                <X size={14} color={Colors.primary} strokeWidth={2.2} />
              </Pressable>
            ))}

            <Pressable
              onPress={handleResetFilters}
              style={styles.clearAllChip}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <Text style={styles.clearAllText}>Clear All</Text>
            </Pressable>
          </ScrollView>
        </View>
      )}

      {/* Transaction List */}
      {isInitialLoading && transactions.length === 0 ? (
        <View style={styles.loadingWrapper}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : flatRows.length === 0 ? (
        <View style={styles.emptyWrapper}>
          <EmptyState
            icon={
              hasAnyActiveFilterOrSearch ? (
                <SearchX size={28} color={Colors.primary} strokeWidth={1.8} />
              ) : (
                <Receipt size={28} color={Colors.primary} strokeWidth={1.8} />
              )
            }
            heading="No transactions found"
            subtitle={
              hasAnyActiveFilterOrSearch
                ? 'Try adjusting your search or filters to see more results'
                : 'Your expenses and income will appear here'
            }
            ctaLabel={
              hasAnyActiveFilterOrSearch ? 'Clear filters' : 'Add First Transaction'
            }
            onCtaPress={() => {
              if (hasAnyActiveFilterOrSearch) {
                handleResetFilters();
              } else {
                router.push('/modals/add-transaction' as never);
              }
            }}
          />
        </View>
      ) : (
        <FlatList
          data={flatRows}
          keyExtractor={(item) => item.key}
          renderItem={renderFlatRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            if (openSwipeRef.current) {
              openSwipeRef.current.close();
              openSwipeRef.current = null;
            }
          }}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchTransactions('refresh')}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.primary} />
              </View>
            ) : (
              <View style={styles.footerSpacer} />
            )
          }
        />
      )}

      {/* Undo Snackbar / Toast */}
      {deletedTxId && (
        <Animated.View
          style={[
            styles.snackbar,
            {
              opacity: toastAnim,
              transform: [
                {
                  translateY: toastAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [24, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <Text style={styles.snackbarText}>Transaction deleted</Text>
          <Pressable
            onPress={handleUndoDelete}
            style={styles.undoButton}
            accessibilityRole="button"
            accessibilityLabel="Undo delete"
          >
            <RotateCcw size={15} color={Colors.primary} strokeWidth={2.4} />
            <Text style={styles.undoButtonText}>Undo</Text>
          </Pressable>
        </Animated.View>
      )}

      {/* Transaction Detail Bottom Sheet */}
      <TransactionDetailSheet
        transaction={selectedTransaction}
        onClose={() => setSelectedTransaction(null)}
        onEdit={handleEdit}
        onDelete={handleDeleteRequest}
      />

      {/* Filter Bottom Sheet */}
      <FilterSheet
        visible={filterSheetVisible}
        filters={filters}
        datePreset={datePreset}
        categories={categories}
        wallets={wallets}
        onApply={(nextFilters, nextPreset) => {
          setFilters(nextFilters);
          setDatePreset(nextPreset);
        }}
        onReset={handleResetFilters}
        onClose={() => setFilterSheetVisible(false)}
      />
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
  headerTitle: {
    ...Typography.titleLg,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  iconButtonActive: {
    backgroundColor: '#E5F4EC',
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  buttonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  filterBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: Colors.bgMain,
  },
  filterBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.textInverse,
  },
  searchContainer: {
    paddingHorizontal: Spacing.xl,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  searchInputBox: {
    height: 48,
    borderRadius: 16,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: Colors.textPrimary,
    fontWeight: '500',
    letterSpacing: 0.1,
    paddingVertical: Platform.OS === 'ios' ? 10 : 6,
  },
  searchClearBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F6F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipsRowWrapper: {
    marginBottom: Spacing.sm,
  },
  chipsRowContent: {
    paddingHorizontal: Spacing.xl,
    gap: 8,
    alignItems: 'center',
  },
  activeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#E5F4EC',
    borderWidth: 1,
    borderColor: '#C6E8D5',
  },
  activeChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.1,
  },
  clearAllChip: {
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  clearAllText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyWrapper: {
    flex: 1,
    justifyContent: 'center',
  },
  listContent: {
    paddingBottom: 160,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: 18,
    paddingBottom: 8,
    backgroundColor: Colors.bgMain,
  },
  dateHeaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  dateHeaderNet: {
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  rowCardContainer: {
    marginHorizontal: Spacing.xl,
    backgroundColor: Colors.bgCard,
    overflow: 'hidden',
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: '#EDF2EC',
  },
  rowCardFirst: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
  },
  rowCardLast: {
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: Colors.bgCard,
    gap: 14,
  },
  rowPressed: {
    backgroundColor: '#F8FAF8',
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4EF',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  rowCenter: {
    flex: 1,
    gap: 3,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  rowSubtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  transferSubtitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  rowTime: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textDisabled,
    letterSpacing: 0.2,
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    flexShrink: 0,
    marginLeft: Spacing.xs,
  },
  amountValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
  swipeActionsRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  swipeActionBtn: {
    width: 72,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  swipeEditBtn: {
    backgroundColor: Colors.secondary,
  },
  swipeDeleteBtn: {
    backgroundColor: Colors.expense,
  },
  swipeActionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textInverse,
    letterSpacing: 0.2,
  },
  footerLoader: {
    paddingVertical: Spacing.xl,
    alignItems: 'center',
  },
  footerSpacer: {
    height: Spacing['2xl'],
  },
  snackbar: {
    position: 'absolute',
    left: Spacing.xl,
    right: Spacing.xl,
    bottom: 24,
    backgroundColor: '#1E2B23',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
  },
  snackbarText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
    letterSpacing: 0.1,
  },
  undoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(91, 175, 133, 0.22)',
  },
  undoButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#6FD19C',
    letterSpacing: 0.2,
  },
});
