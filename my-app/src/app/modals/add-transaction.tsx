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
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import {
  ArrowRight,
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Delete,
  Grid2x2,
  Plus,
  X,
} from 'lucide-react-native';
import {
  addDays,
  addMonths,
  endOfMonth,
  format,
  isSameDay,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns';
import { getDatabase } from '../../database/database';
import { TransactionRepository } from '../../database/repositories/TransactionRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { FinanceCalculator } from '../../services/finance/FinanceCalculator';
import { BudgetNotifier } from '../../services/notifications/BudgetNotifier';
import { Category } from '../../types/category.types';
import { Wallet } from '../../types/wallet.types';
import { InsertTransaction, TransactionType } from '../../types/transaction.types';
import { useSettingsStore } from '../../store/settingsStore';
import { useWalletStore } from '../../store/walletStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useBudgetStore } from '../../store/budgetStore';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Shapes } from '../../theme/shapes';
import { Shadows } from '../../theme/shadows';
import { Typography } from '../../theme/typography';
import { MAX_AMOUNT, MAX_NOTE_LENGTH } from '../../constants/config';
import {
  formatCurrency,
  fromMinorUnits,
  getCurrencySymbol,
  toMinorUnits,
} from '../../utils/currencyUtils';
import { formatDisplay, formatRelative, toISO } from '../../utils/dateUtils';
import { generateId } from '../../utils/idUtils';
import { CategoryIcon } from '../../components/sheets/TransactionDetailSheet';

const TRANSACTION_TYPES: Array<{ value: TransactionType; label: string }> = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
];

const NUMPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
] as const;

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

function formatDisplayAmountInput(
  raw: string,
  numberFormat: 'indian' | 'international' = 'indian'
): string {
  if (!raw || raw === '') return '0';
  const hasDot = raw.includes('.');
  const [intRaw, decRaw = ''] = raw.split('.');
  const cleanInt = intRaw.replace(/^0+(?=\d)/, '') || '0';

  let formattedInt: string;
  if (numberFormat === 'indian') {
    if (cleanInt.length <= 3) {
      formattedInt = cleanInt;
    } else {
      let result = cleanInt.slice(-3);
      let remaining = cleanInt.slice(0, -3);
      while (remaining.length > 2) {
        result = remaining.slice(-2) + ',' + result;
        remaining = remaining.slice(0, -2);
      }
      if (remaining.length > 0) result = remaining + ',' + result;
      formattedInt = result;
    }
  } else {
    formattedInt = cleanInt.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return hasDot ? `${formattedInt}.${decRaw}` : formattedInt;
}

interface ValidationErrors {
  amount?: string;
  category?: string;
  wallet?: string;
  transfer?: string;
}

export default function AddTransactionModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id?: string;
    type?: string;
    walletId?: string;
  }>();

  const editId = typeof params.id === 'string' && params.id.length > 0 ? params.id : null;
  const isEditMode = Boolean(editId);

  const { settings } = useSettingsStore();
  const insets = useSafeAreaInsets();
  const footerBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 10) + 10;
  const { loadWallets } = useWalletStore();
  const { loadTransactions } = useTransactionStore();
  const { loadBudgets } = useBudgetStore();

  const initialType: TransactionType =
    params.type === 'income' || params.type === 'transfer' || params.type === 'expense'
      ? params.type
      : 'expense';

  const [type, setType] = useState<TransactionType>(initialType);
  const [amountStr, setAmountStr] = useState<string>('0');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(
    typeof params.walletId === 'string' ? params.walletId : null
  );
  const [destinationWalletId, setDestinationWalletId] = useState<string | null>(null);
  const [transactionDate, setTransactionDate] = useState<Date>(new Date());
  const [title, setTitle] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [editingTransferGroupId, setEditingTransferGroupId] = useState<string | null>(null);

  const [categories, setCategories] = useState<Category[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [walletBalances, setWalletBalances] = useState<Record<string, number>>({});
  const [isLoadingData, setIsLoadingData] = useState<boolean>(true);

  const [errors, setErrors] = useState<ValidationErrors>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [cooldownActive, setCooldownActive] = useState<boolean>(false);
  const [showSuccess, setShowSuccess] = useState<boolean>(false);

  const [categorySheetOpen, setCategorySheetOpen] = useState<boolean>(false);
  const [dateModalOpen, setDateModalOpen] = useState<boolean>(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(startOfMonth(new Date()));

  const categorySheetRef = useRef<BottomSheet>(null);
  const categorySnapPoints = useMemo(() => ['65%', '85%'], []);
  const successScale = useRef(new Animated.Value(0)).current;
  const successOpacity = useRef(new Animated.Value(0)).current;
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const numberFormat = settings?.numberFormat || 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  const baseCurrency = settings?.baseCurrency || 'INR';

  const activeWallet = useMemo(
    () => wallets.find((w) => w.id === selectedWalletId) || wallets[0] || null,
    [wallets, selectedWalletId]
  );

  const currencyCode = activeWallet?.currencyCode || baseCurrency;
  const currencySymbol = getCurrencySymbol(currencyCode);

  const filteredCategories = useMemo(
    () => categories.filter((cat) => cat.type === type && !cat.isArchived),
    [categories, type]
  );

  const amountNumeric = useMemo(() => {
    const parsed = parseFloat(amountStr);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountStr]);

  const amountMinor = useMemo(() => toMinorUnits(amountNumeric), [amountNumeric]);

  const formattedAmountDisplay = useMemo(
    () => formatDisplayAmountInput(amountStr, numberFormat),
    [amountStr, numberFormat]
  );

  // Load wallets, categories, and existing transaction (if edit mode)
  const loadFormData = useCallback(async () => {
    try {
      const db = await getDatabase();
      const catRepo = new CategoryRepository(db);
      const walletRepo = new WalletRepository(db);
      const txRepo = new TransactionRepository(db);

      const [allCats, allWallets] = await Promise.all([
        catRepo.getAll(undefined, false),
        walletRepo.getAll(false),
      ]);

      const balanceEntries = await Promise.all(
        allWallets.map(async (w) => [w.id, await FinanceCalculator.getWalletBalance(w.id)] as const)
      );
      const balanceMap: Record<string, number> = {};
      for (const [id, bal] of balanceEntries) {
        balanceMap[id] = bal;
      }

      setCategories(allCats);
      setWallets(allWallets);
      setWalletBalances(balanceMap);

      if (editId) {
        const existing = await txRepo.getById(editId);
        if (existing) {
          let resolvedFromWalletId = existing.walletId;
          let resolvedToWalletId = existing.destinationWalletId;

          // If opened from a transfer's credit leg, look up the sibling debit leg so
          // From Wallet & To Wallet are populated accurately.
          if (
            existing.type === 'transfer' &&
            existing.transferGroupId &&
            !existing.destinationWalletId
          ) {
            const debitLeg = await db.getFirstAsync<{
              wallet_id: string;
              destination_wallet_id: string | null;
            }>(
              `SELECT wallet_id, destination_wallet_id
               FROM transactions
               WHERE transfer_group_id = ?
                 AND destination_wallet_id IS NOT NULL
                 AND is_deleted = 0
               LIMIT 1`,
              [existing.transferGroupId]
            );
            if (debitLeg) {
              resolvedFromWalletId = debitLeg.wallet_id;
              resolvedToWalletId = debitLeg.destination_wallet_id;
            }
          }

          setType(existing.type);
          const major = fromMinorUnits(existing.amountMinor);
          setAmountStr(major % 1 === 0 ? String(major) : major.toFixed(2).replace(/0+$/, ''));
          setSelectedCategoryId(existing.categoryId);
          setSelectedWalletId(resolvedFromWalletId);
          setDestinationWalletId(resolvedToWalletId);
          setEditingTransferGroupId(existing.transferGroupId);
          setTitle(existing.title || '');
          setNote(existing.note || '');
          const parsedDate = new Date(existing.transactionDate);
          if (!Number.isNaN(parsedDate.getTime())) {
            setTransactionDate(parsedDate);
            setCalendarMonth(startOfMonth(parsedDate));
          }
        }
      } else {
        // Default wallet selections for new transaction
        setSelectedWalletId((prev) => {
          if (prev && allWallets.some((w) => w.id === prev)) return prev;
          return allWallets[0]?.id ?? null;
        });
        setDestinationWalletId((prev) => {
          if (prev && allWallets.some((w) => w.id === prev)) return prev;
          return allWallets[1]?.id ?? allWallets[0]?.id ?? null;
        });
      }
    } catch (err) {
      console.error('[AddTransaction] loadFormData failed:', err);
    } finally {
      setIsLoadingData(false);
    }
  }, [editId]);

  useEffect(() => {
    loadFormData();
  }, [loadFormData]);

  // Refresh wallets if user navigated to create a wallet and came back
  useFocusEffect(
    useCallback(() => {
      if (!isLoadingData) {
        loadFormData();
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    return () => {
      if (cooldownTimerRef.current) clearTimeout(cooldownTimerRef.current);
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (categorySheetOpen) {
      categorySheetRef.current?.snapToIndex(0);
    } else {
      categorySheetRef.current?.close();
    }
  }, [categorySheetOpen]);

  const triggerHaptic = useCallback(
    (style: 'selection' | 'light' | 'medium' | 'success' | 'error' = 'selection') => {
      if (settings?.hapticEnabled === false) return;
      if (style === 'selection') {
        Haptics.selectionAsync().catch(() => {});
      } else if (style === 'light') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      } else if (style === 'medium') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      } else if (style === 'success') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      } else if (style === 'error') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      }
    },
    [settings?.hapticEnabled]
  );

  const handleTypeChange = (nextType: TransactionType) => {
    if (nextType === type) return;
    triggerHaptic('selection');
    setType(nextType);
    setErrors({});

    if (nextType === 'transfer') {
      setSelectedCategoryId(null);
      if (wallets.length >= 2) {
        const fromId = selectedWalletId || wallets[0].id;
        setSelectedWalletId(fromId);
        if (!destinationWalletId || destinationWalletId === fromId) {
          const other = wallets.find((w) => w.id !== fromId);
          setDestinationWalletId(other?.id ?? null);
        }
      }
    } else {
      // Clear category if it doesn't belong to the new type
      const catMatches = categories.some(
        (c) => c.id === selectedCategoryId && c.type === nextType
      );
      if (!catMatches) {
        setSelectedCategoryId(null);
      }
    }
  };

  const handleNumpadPress = (key: string) => {
    triggerHaptic('selection');
    setErrors((prev) => ({ ...prev, amount: undefined }));

    setAmountStr((prev) => {
      if (key === 'backspace') {
        if (prev.length <= 1) return '0';
        const next = prev.slice(0, -1);
        return next === '' ? '0' : next;
      }

      if (key === '.') {
        if (prev.includes('.')) return prev;
        return (prev || '0') + '.';
      }

      // Numeric digit
      if (prev === '0' || prev === '') {
        return key;
      }

      const parts = prev.split('.');
      if (parts.length === 2) {
        if (parts[1].length >= 2) return prev;
      } else {
        const candidate = parseFloat(prev + key);
        if (candidate > MAX_AMOUNT) return prev;
      }

      const nextStr = prev + key;
      const numeric = parseFloat(nextStr);
      if (numeric > MAX_AMOUNT) return prev;
      return nextStr;
    });
  };

  const handleNumpadLongClear = () => {
    triggerHaptic('medium');
    setAmountStr('0');
  };

  const validateForm = (): boolean => {
    const nextErrors: ValidationErrors = {};

    if (amountMinor <= 0) {
      nextErrors.amount = 'Please enter an amount';
    } else if (amountNumeric > MAX_AMOUNT) {
      nextErrors.amount = 'Amount cannot exceed 999,999,999';
    }

    if (type !== 'transfer' && !selectedCategoryId) {
      nextErrors.category = 'Please select a category';
    }

    if (!selectedWalletId) {
      nextErrors.wallet = 'Please select a wallet';
    }

    if (type === 'transfer') {
      if (!destinationWalletId) {
        nextErrors.transfer = 'Please select a destination wallet';
      } else if (selectedWalletId && destinationWalletId === selectedWalletId) {
        nextErrors.transfer = 'Source and destination wallet must be different';
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const playSuccessAndClose = () => {
    setShowSuccess(true);
    triggerHaptic('success');
    Animated.parallel([
      Animated.spring(successScale, {
        toValue: 1,
        friction: 6,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(successOpacity, {
        toValue: 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();

    closeTimerRef.current = setTimeout(() => {
      router.back();
    }, 620);
  };

  const handleSave = async () => {
    if (isSaving || cooldownActive) return;

    // Anti-double-tap 500ms lock
    setCooldownActive(true);
    cooldownTimerRef.current = setTimeout(() => {
      setCooldownActive(false);
    }, 500);

    if (!validateForm()) {
      triggerHaptic('error');
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDatabase();
      const txRepo = new TransactionRepository(db);
      const selectedCat = categories.find((c) => c.id === selectedCategoryId);
      const fromWallet = wallets.find((w) => w.id === selectedWalletId);
      const toWallet = wallets.find((w) => w.id === destinationWalletId);

      const resolvedTitle =
        title.trim() ||
        (type === 'transfer'
          ? `Transfer to ${toWallet?.name || 'Wallet'}`
          : selectedCat?.name || (type === 'income' ? 'Income' : 'Expense'));

      const trimmedNote = note.trim().length > 0 ? note.trim() : null;
      const isoDate = toISO(transactionDate);
      const txCurrency = fromWallet?.currencyCode || baseCurrency;

      if (isEditMode && editId) {
        if (type === 'transfer' && editingTransferGroupId && selectedWalletId && destinationWalletId) {
          // Update both linked transfer records atomically
          const nowIso = toISO(new Date());
          await db.withTransactionAsync(async () => {
            // Update debit leg
            await db.runAsync(
              `UPDATE transactions
               SET amount_minor = ?, currency_code = ?, wallet_id = ?, destination_wallet_id = ?,
                   title = ?, note = ?, transaction_date = ?, updated_at = ?
               WHERE transfer_group_id = ? AND destination_wallet_id IS NOT NULL`,
              [
                amountMinor,
                txCurrency,
                selectedWalletId,
                destinationWalletId,
                resolvedTitle,
                trimmedNote,
                isoDate,
                nowIso,
                editingTransferGroupId,
              ]
            );
            // Update credit leg
            await db.runAsync(
              `UPDATE transactions
               SET amount_minor = ?, currency_code = ?, wallet_id = ?, destination_wallet_id = NULL,
                   title = ?, note = ?, transaction_date = ?, updated_at = ?
               WHERE transfer_group_id = ? AND destination_wallet_id IS NULL`,
              [
                amountMinor,
                txCurrency,
                destinationWalletId,
                resolvedTitle,
                trimmedNote,
                isoDate,
                nowIso,
                editingTransferGroupId,
              ]
            );
          });
        } else {
          if (editingTransferGroupId && type !== 'transfer') {
            await db.runAsync(
              'UPDATE transactions SET is_deleted = 1, updated_at = ? WHERE transfer_group_id = ? AND id != ?',
              [toISO(new Date()), editingTransferGroupId, editId]
            );
          }
          await txRepo.update(editId, {
            type,
            amountMinor,
            currencyCode: txCurrency,
            categoryId: type === 'transfer' ? null : selectedCategoryId,
            walletId: selectedWalletId!,
            destinationWalletId: type === 'transfer' ? destinationWalletId : null,
            transferGroupId: type === 'transfer' ? editingTransferGroupId : null,
            title: resolvedTitle,
            note: trimmedNote,
            transactionDate: isoDate,
          });
        }
      } else {
        if (type === 'transfer') {
          const groupId = generateId();
          const debitRecord: InsertTransaction = {
            type: 'transfer',
            amountMinor,
            currencyCode: txCurrency,
            categoryId: null,
            walletId: selectedWalletId!,
            destinationWalletId: destinationWalletId!,
            transferGroupId: groupId,
            title: resolvedTitle,
            note: trimmedNote,
            transactionDate: isoDate,
            recurringId: null,
          };
          const creditRecord: InsertTransaction = {
            type: 'transfer',
            amountMinor,
            currencyCode: toWallet?.currencyCode || txCurrency,
            categoryId: null,
            walletId: destinationWalletId!,
            destinationWalletId: null,
            transferGroupId: groupId,
            title: resolvedTitle,
            note: trimmedNote,
            transactionDate: isoDate,
            recurringId: null,
          };
          await txRepo.insertTransfer(debitRecord, creditRecord);
        } else {
          await txRepo.insert({
            type,
            amountMinor,
            currencyCode: txCurrency,
            categoryId: selectedCategoryId,
            walletId: selectedWalletId!,
            destinationWalletId: null,
            transferGroupId: null,
            title: resolvedTitle,
            note: trimmedNote,
            transactionDate: isoDate,
            recurringId: null,
          });
        }
      }

      // Recalculate wallet balances & refresh app stores
      await Promise.all([
        loadWallets().catch(() => {}),
        loadTransactions().catch(() => {}),
        loadBudgets().catch(() => {}),
      ]);

      // Non-blocking budget threshold notification check
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
        // Ignore notification errors
      }

      playSuccessAndClose();
    } catch (err) {
      console.error('[AddTransaction] save failed:', err);
      triggerHaptic('error');
      setErrors({ amount: 'Failed to save transaction. Please try again.' });
      setIsSaving(false);
    }
  };

  const renderCategoryBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.4}
        pressBehavior="close"
      />
    ),
    []
  );

  // Calendar grid for Date Picker modal
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(calendarMonth);
    const monthEnd = endOfMonth(calendarMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = gridStart;
    while (days.length < 42) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
      if (days.length >= 35 && cursor > monthEnd && cursor.getDay() === 1) break;
    }
    return days;
  }, [calendarMonth]);

  const isSaveDisabled =
    isSaving ||
    cooldownActive ||
    amountMinor <= 0 ||
    (type !== 'transfer' && !selectedCategoryId);

  const saveButtonLabel = isEditMode
    ? type === 'expense'
      ? 'Update Expense'
      : type === 'income'
        ? 'Update Income'
        : 'Update Transfer'
    : type === 'expense'
      ? 'Save Expense'
      : type === 'income'
        ? 'Save Income'
        : 'Save Transfer';

  const amountAccentColor =
    type === 'expense'
      ? Colors.expense
      : type === 'income'
        ? Colors.primary
        : Colors.secondary;

  // Show first 8 categories in quick horizontal bar + "More..." chip
  const quickCategories = filteredCategories.slice(0, 8);
  // Ensure currently selected category appears visible even if beyond index 7
  const displayedQuickCategories = useMemo(() => {
    if (!selectedCategoryId) return quickCategories;
    if (quickCategories.some((c) => c.id === selectedCategoryId)) return quickCategories;
    const picked = filteredCategories.find((c) => c.id === selectedCategoryId);
    return picked ? [picked, ...quickCategories.slice(0, 7)] : quickCategories;
  }, [filteredCategories, quickCategories, selectedCategoryId]);

  const handleSelectDate = (pickedDay: Date) => {
    triggerHaptic('selection');
    // Preserve current time of day so chronological ordering within the same day stays accurate
    const merged = new Date(pickedDay);
    merged.setHours(
      transactionDate.getHours(),
      transactionDate.getMinutes(),
      transactionDate.getSeconds(),
      0
    );
    setTransactionDate(merged);
    setDateModalOpen(false);
  };

  if (isLoadingData) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Modal Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isEditMode ? 'Edit Transaction' : 'Add Transaction'}
          </Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* Type Segmented Control */}
        <View style={styles.segmentedWrapper}>
          <View style={styles.segmentedControl}>
            {TRANSACTION_TYPES.map((tab) => {
              const active = type === tab.value;
              return (
                <Pressable
                  key={tab.value}
                  onPress={() => handleTypeChange(tab.value)}
                  style={[styles.segmentTab, active && styles.segmentTabActive]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                >
                  <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>
                    {tab.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <ScrollView
          style={styles.flex1}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Amount Display */}
          <View style={styles.amountCard}>
            <View style={styles.amountDisplayRow}>
              <Text style={[styles.currencySymbol, { color: amountAccentColor }]}>
                {currencySymbol}
              </Text>
              <Text
                style={[styles.amountDisplayText, { color: amountAccentColor }]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {formattedAmountDisplay}
              </Text>
            </View>
            {errors.amount ? <Text style={styles.errorTextCenter}>{errors.amount}</Text> : null}

            {/* Custom Numpad */}
            <View style={styles.numpad}>
              {NUMPAD_ROWS.map((row, rowIndex) => (
                <View key={rowIndex} style={styles.numpadRow}>
                  {row.map((key) => {
                    const isBackspace = key === 'backspace';
                    return (
                      <Pressable
                        key={key}
                        onPress={() => handleNumpadPress(key)}
                        onLongPress={isBackspace ? handleNumpadLongClear : undefined}
                        accessibilityRole="button"
                        accessibilityLabel={isBackspace ? 'Delete digit' : key}
                        style={({ pressed }) => [
                          styles.numpadKey,
                          pressed && styles.numpadKeyPressed,
                        ]}
                      >
                        {isBackspace ? (
                          <Delete size={22} color={Colors.textPrimary} strokeWidth={2} />
                        ) : (
                          <Text style={styles.numpadKeyText}>{key}</Text>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>
          </View>

          {/* Category Selector (Expense / Income only) */}
          {type !== 'transfer' && (
            <View style={styles.section}>
              <View style={styles.sectionHeaderRow}>
                <Text style={styles.sectionLabel}>Category</Text>
                {selectedCategoryId && (
                  <Text style={styles.selectedHint}>
                    {filteredCategories.find((c) => c.id === selectedCategoryId)?.name}
                  </Text>
                )}
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalChips}
              >
                {displayedQuickCategories.map((cat) => {
                  const selected = selectedCategoryId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        triggerHaptic('selection');
                        setSelectedCategoryId(cat.id);
                        setErrors((prev) => ({ ...prev, category: undefined }));
                      }}
                      style={[
                        styles.categoryChip,
                        selected && [
                          styles.categoryChipSelected,
                          { backgroundColor: cat.color, borderColor: cat.color },
                        ],
                      ]}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                    >
                      <View
                        style={[
                          styles.categoryChipIcon,
                          {
                            backgroundColor: selected
                              ? 'rgba(255,255,255,0.22)'
                              : cat.color,
                          },
                        ]}
                      >
                        <CategoryIcon
                          iconName={cat.iconName}
                          size={15}
                          color={Colors.textInverse}
                          fallbackLabel={cat.name}
                        />
                      </View>
                      <Text
                        style={[
                          styles.categoryChipText,
                          selected && styles.categoryChipTextSelected,
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}

                <Pressable
                  onPress={() => {
                    triggerHaptic('light');
                    setCategorySheetOpen(true);
                  }}
                  style={styles.moreChip}
                  accessibilityRole="button"
                  accessibilityLabel="More categories"
                >
                  <Grid2x2 size={16} color={Colors.primary} />
                  <Text style={styles.moreChipText}>More...</Text>
                </Pressable>
              </ScrollView>

              {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
            </View>
          )}

          {/* Wallet Selector(s) */}
          {type === 'transfer' ? (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>From Wallet</Text>
              {wallets.length === 0 ? (
                <Pressable
                  onPress={() => router.push('/modals/add-wallet' as never)}
                  style={styles.createWalletBtn}
                >
                  <Plus size={16} color={Colors.primary} />
                  <Text style={styles.createWalletText}>Create a Wallet first</Text>
                </Pressable>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalChips}
                >
                  {wallets.map((wallet) => {
                    const selected = selectedWalletId === wallet.id;
                    const bal = walletBalances[wallet.id] ?? wallet.openingBalanceMinor;
                    return (
                      <Pressable
                        key={wallet.id}
                        onPress={() => {
                          triggerHaptic('selection');
                          setSelectedWalletId(wallet.id);
                          setErrors((prev) => ({
                            ...prev,
                            wallet: undefined,
                            transfer:
                              destinationWalletId === wallet.id
                                ? 'Source and destination wallet must be different'
                                : undefined,
                          }));
                        }}
                        style={[styles.walletChip, selected && styles.walletChipSelected]}
                      >
                        <View style={[styles.walletDot, { backgroundColor: wallet.color }]} />
                        <View>
                          <Text
                            style={[
                              styles.walletName,
                              selected && styles.walletNameSelected,
                            ]}
                          >
                            {wallet.name}
                          </Text>
                          <Text style={styles.walletBalance}>
                            {formatCurrency(bal, wallet.currencyCode, numberFormat, decimalPlaces)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {errors.wallet ? <Text style={styles.errorText}>{errors.wallet}</Text> : null}

              <View style={styles.transferArrowRow}>
                <View style={styles.transferArrowBadge}>
                  <ArrowRight size={14} color={Colors.secondary} />
                  <Text style={styles.transferArrowText}>To Wallet</Text>
                </View>
              </View>

              {wallets.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalChips}
                >
                  {wallets.map((wallet) => {
                    const selected = destinationWalletId === wallet.id;
                    const isSameAsSource = selectedWalletId === wallet.id;
                    const bal = walletBalances[wallet.id] ?? wallet.openingBalanceMinor;
                    return (
                      <Pressable
                        key={wallet.id}
                        onPress={() => {
                          triggerHaptic('selection');
                          setDestinationWalletId(wallet.id);
                          setErrors((prev) => ({
                            ...prev,
                            transfer:
                              wallet.id === selectedWalletId
                                ? 'Source and destination wallet must be different'
                                : undefined,
                          }));
                        }}
                        style={[
                          styles.walletChip,
                          selected && styles.walletChipSelected,
                          selected && isSameAsSource && styles.walletChipError,
                        ]}
                      >
                        <View style={[styles.walletDot, { backgroundColor: wallet.color }]} />
                        <View>
                          <Text
                            style={[
                              styles.walletName,
                              selected && styles.walletNameSelected,
                            ]}
                          >
                            {wallet.name}
                          </Text>
                          <Text style={styles.walletBalance}>
                            {formatCurrency(bal, wallet.currencyCode, numberFormat, decimalPlaces)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {errors.transfer ? <Text style={styles.errorText}>{errors.transfer}</Text> : null}
            </View>
          ) : (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Wallet</Text>
              {wallets.length === 0 ? (
                <Pressable
                  onPress={() => router.push('/modals/add-wallet' as never)}
                  style={styles.createWalletBtn}
                >
                  <Plus size={16} color={Colors.primary} />
                  <Text style={styles.createWalletText}>Add a Wallet</Text>
                </Pressable>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalChips}
                >
                  {wallets.map((wallet) => {
                    const selected = selectedWalletId === wallet.id;
                    const bal = walletBalances[wallet.id] ?? wallet.openingBalanceMinor;
                    return (
                      <Pressable
                        key={wallet.id}
                        onPress={() => {
                          triggerHaptic('selection');
                          setSelectedWalletId(wallet.id);
                          setErrors((prev) => ({ ...prev, wallet: undefined }));
                        }}
                        style={[styles.walletChip, selected && styles.walletChipSelected]}
                      >
                        <View style={[styles.walletDot, { backgroundColor: wallet.color }]} />
                        <View>
                          <Text
                            style={[
                              styles.walletName,
                              selected && styles.walletNameSelected,
                            ]}
                          >
                            {wallet.name}
                          </Text>
                          <Text style={styles.walletBalance}>
                            {formatCurrency(bal, wallet.currencyCode, numberFormat, decimalPlaces)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {errors.wallet ? <Text style={styles.errorText}>{errors.wallet}</Text> : null}
            </View>
          )}

          {/* Date Selector */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Date</Text>
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                setCalendarMonth(startOfMonth(transactionDate));
                setDateModalOpen(true);
              }}
              style={({ pressed }) => [styles.dateTouchable, pressed && styles.dateTouchablePressed]}
              accessibilityRole="button"
              accessibilityLabel="Select date"
            >
              <View style={styles.dateIconBox}>
                <Calendar size={18} color={Colors.primary} />
              </View>
              <View style={styles.flex1}>
                <Text style={styles.datePrimaryText}>
                  {formatRelative(transactionDate.toISOString())}
                </Text>
                <Text style={styles.dateSecondaryText}>
                  {formatDisplay(transactionDate, 'EEEE, dd MMM yyyy')}
                </Text>
              </View>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          {/* Optional Title & Note */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Title (Optional)</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder={
                type === 'transfer'
                  ? 'e.g., Savings transfer'
                  : 'e.g., Lunch, Grocery run, Salary...'
              }
              placeholderTextColor={Colors.textDisabled}
              maxLength={80}
              style={styles.titleInput}
            />
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Note</Text>
              {note.length > 0 && (
                <Text
                  style={[
                    styles.charCounter,
                    note.length >= MAX_NOTE_LENGTH && styles.charCounterLimit,
                  ]}
                >
                  {note.length}/{MAX_NOTE_LENGTH}
                </Text>
              )}
            </View>
            <TextInput
              value={note}
              onChangeText={(text) => setNote(text.slice(0, MAX_NOTE_LENGTH))}
              placeholder="Add a note (optional)"
              placeholderTextColor={Colors.textDisabled}
              multiline
              numberOfLines={3}
              maxLength={MAX_NOTE_LENGTH}
              textAlignVertical="top"
              style={styles.noteInput}
            />
          </View>
        </ScrollView>

        {/* Sticky Save Footer */}
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          <Pressable
            onPress={handleSave}
            disabled={isSaveDisabled}
            style={({ pressed }) => [
              styles.saveButton,
              isSaveDisabled && styles.saveButtonDisabled,
              pressed && !isSaveDisabled && styles.saveButtonPressed,
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: isSaveDisabled, busy: isSaving }}
            accessibilityLabel={saveButtonLabel}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color={Colors.textInverse} />
            ) : (
              <Text style={styles.saveButtonText}>{saveButtonLabel}</Text>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* Full Category Grid Bottom Sheet (4 per row) */}
      {categorySheetOpen && (
        <BottomSheet
          ref={categorySheetRef}
          index={0}
          snapPoints={categorySnapPoints}
          enablePanDownToClose
          onChange={(index) => {
            if (index === -1) setCategorySheetOpen(false);
          }}
          backdropComponent={renderCategoryBackdrop}
          backgroundStyle={styles.sheetBackground}
          handleIndicatorStyle={styles.handleIndicator}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>
              All {type === 'income' ? 'Income' : 'Expense'} Categories
            </Text>
            <Pressable
              onPress={() => setCategorySheetOpen(false)}
              style={styles.sheetCloseBtn}
            >
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <BottomSheetScrollView
            contentContainerStyle={styles.categoryGrid}
            showsVerticalScrollIndicator={false}
          >
            {filteredCategories.map((cat) => {
              const selected = selectedCategoryId === cat.id;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => {
                    triggerHaptic('selection');
                    setSelectedCategoryId(cat.id);
                    setErrors((prev) => ({ ...prev, category: undefined }));
                    setCategorySheetOpen(false);
                  }}
                  style={styles.categoryGridCell}
                >
                  <View
                    style={[
                      styles.categoryGridCircle,
                      { backgroundColor: cat.color },
                      selected && styles.categoryGridCircleSelected,
                    ]}
                  >
                    <CategoryIcon
                      iconName={cat.iconName}
                      size={22}
                      color={Colors.textInverse}
                      fallbackLabel={cat.name}
                    />
                    {selected && (
                      <View style={styles.categoryGridCheck}>
                        <Check size={10} color={Colors.textInverse} strokeWidth={3} />
                      </View>
                    )}
                  </View>
                  <Text
                    style={[
                      styles.categoryGridLabel,
                      selected && styles.categoryGridLabelSelected,
                    ]}
                    numberOfLines={2}
                  >
                    {cat.name}
                  </Text>
                </Pressable>
              );
            })}
          </BottomSheetScrollView>
        </BottomSheet>
      )}

      {/* Calendar Date Picker Modal */}
      <Modal
        visible={dateModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDateModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setDateModalOpen(false)}>
          <Pressable style={styles.calendarCard} onPress={() => {}}>
            <View style={styles.calendarHeader}>
              <Text style={styles.calendarTitle}>Select Date</Text>
              <Pressable
                onPress={() => setDateModalOpen(false)}
                style={styles.calendarCloseBtn}
              >
                <X size={18} color={Colors.textSecondary} />
              </Pressable>
            </View>

            {/* Quick shortcuts */}
            <View style={styles.quickDateRow}>
              <Pressable
                onPress={() => handleSelectDate(new Date())}
                style={[
                  styles.quickDateChip,
                  isSameDay(transactionDate, new Date()) && styles.quickDateChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickDateText,
                    isSameDay(transactionDate, new Date()) && styles.quickDateTextActive,
                  ]}
                >
                  Today
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSelectDate(addDays(new Date(), -1))}
                style={[
                  styles.quickDateChip,
                  isSameDay(transactionDate, addDays(new Date(), -1)) &&
                    styles.quickDateChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.quickDateText,
                    isSameDay(transactionDate, addDays(new Date(), -1)) &&
                      styles.quickDateTextActive,
                  ]}
                >
                  Yesterday
                </Text>
              </Pressable>
            </View>

            {/* Month navigation */}
            <View style={styles.monthNav}>
              <Pressable
                onPress={() => setCalendarMonth((prev) => subMonths(prev, 1))}
                style={styles.monthNavBtn}
              >
                <ChevronLeft size={20} color={Colors.textPrimary} />
              </Pressable>
              <Text style={styles.monthLabel}>{format(calendarMonth, 'MMMM yyyy')}</Text>
              <Pressable
                onPress={() => setCalendarMonth((prev) => addMonths(prev, 1))}
                style={styles.monthNavBtn}
              >
                <ChevronRight size={20} color={Colors.textPrimary} />
              </Pressable>
            </View>

            <View style={styles.weekdayRow}>
              {WEEKDAYS.map((day) => (
                <Text key={day} style={styles.weekdayText}>
                  {day}
                </Text>
              ))}
            </View>

            <View style={styles.daysGrid}>
              {calendarDays.map((day) => {
                const isCurrentMonth = day.getMonth() === calendarMonth.getMonth();
                const isSelected = isSameDay(day, transactionDate);
                const isTodayDate = isSameDay(day, new Date());
                return (
                  <Pressable
                    key={day.toISOString()}
                    onPress={() => handleSelectDate(day)}
                    style={styles.dayCell}
                    accessibilityRole="button"
                    accessibilityLabel={format(day, 'dd MMMM yyyy')}
                  >
                    <View
                      style={[
                        styles.dayBadge,
                        isSelected && styles.dayBadgeSelected,
                        !isSelected && isTodayDate && styles.dayBadgeToday,
                      ]}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          !isCurrentMonth && styles.dayTextMuted,
                          isSelected && styles.dayTextSelected,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Brief Success Animation Overlay */}
      {showSuccess && (
        <Animated.View style={[styles.successOverlay, { opacity: successOpacity }]}>
          <Animated.View
            style={[styles.successCard, { transform: [{ scale: successScale }] }]}
          >
            <View style={styles.successCircle}>
              <Check size={36} color={Colors.textInverse} strokeWidth={3} />
            </View>
            <Text style={styles.successText}>
              {isEditMode ? 'Transaction Updated' : 'Transaction Saved'}
            </Text>
          </Animated.View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: Colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
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
  closeBtn: {
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
  headerTitle: {
    ...Typography.titleMd,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  segmentedWrapper: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: '#F3F6F2',
    borderRadius: 18,
    padding: 4,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  segmentTab: {
    flex: 1,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentTabActive: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  segmentLabelActive: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 40,
    gap: Spacing.xl,
  },
  amountCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    padding: 20,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
  },
  amountDisplayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 6,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  amountDisplayText: {
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
    flexShrink: 1,
  },
  numpad: {
    gap: 10,
    marginTop: 12,
  },
  numpadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  numpadKey: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  numpadKeyPressed: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
    transform: [{ scale: 0.96 }],
  },
  numpadKeyText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.2,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  selectedHint: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.1,
  },
  horizontalChips: {
    gap: 8,
    paddingVertical: 2,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingLeft: 6,
    paddingRight: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  categoryChipSelected: {
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  categoryChipIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: 0.1,
  },
  categoryChipTextSelected: {
    color: Colors.textInverse,
  },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 100,
    backgroundColor: '#E5F4EC',
    borderWidth: 1,
    borderColor: '#C6E8D5',
  },
  moreChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.1,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  walletChipSelected: {
    borderColor: Colors.primary,
    backgroundColor: '#E5F4EC',
  },
  walletChipError: {
    borderColor: Colors.expense,
    backgroundColor: Colors.expenseSoft,
  },
  walletDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  walletName: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  walletNameSelected: {
    color: Colors.textPrimary,
  },
  walletBalance: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
    letterSpacing: 0.1,
  },
  createWalletBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.md,
    borderRadius: 18,
    backgroundColor: '#F3F8F5',
    borderWidth: 1.5,
    borderColor: '#C6E8D5',
    borderStyle: 'dashed',
  },
  createWalletText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
    letterSpacing: 0.1,
  },
  transferArrowRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
  },
  transferArrowBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transferArrowText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  dateTouchablePressed: {
    backgroundColor: '#F8FAF8',
    borderColor: Colors.primary,
  },
  dateIconBox: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: '#E5F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  datePrimaryText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  dateSecondaryText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
    letterSpacing: 0.1,
  },
  titleInput: {
    height: 50,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingHorizontal: 16,
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: 0.1,
  },
  noteInput: {
    minHeight: 88,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: Colors.textPrimary,
    letterSpacing: 0.1,
  },
  charCounter: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  charCounterLimit: {
    color: Colors.expense,
    fontWeight: '700',
  },
  errorText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.expense,
    marginTop: 2,
  },
  errorTextCenter: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.expense,
    textAlign: 'center',
    marginBottom: Spacing.xs,
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.bgMain,
    borderTopWidth: 1,
    borderTopColor: '#EDF2EC',
  },
  saveButton: {
    height: 54,
    borderRadius: 18,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
  },
  saveButtonDisabled: {
    opacity: 0.45,
  },
  saveButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.98 }],
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textInverse,
    letterSpacing: 0.2,
  },
  sheetBackground: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  handleIndicator: {
    backgroundColor: Colors.borderStrong,
    width: 40,
    height: 4,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2EC',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  sheetCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: 72,
  },
  categoryGridCell: {
    width: '25%',
    alignItems: 'center',
    paddingHorizontal: Spacing.xs,
    marginBottom: Spacing.lg,
    gap: 6,
  },
  categoryGridCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGridCircleSelected: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
  categoryGridCheck: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: Colors.primary,
    borderWidth: 2,
    borderColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryGridLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 15,
  },
  categoryGridLabelSelected: {
    color: Colors.textPrimary,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 32, 25, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  calendarCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 20,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  calendarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  calendarCloseBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickDateRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
    paddingHorizontal: 4,
  },
  quickDateChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 100,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  quickDateChipActive: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
  },
  quickDateText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  quickDateTextActive: {
    color: Colors.primary,
    fontWeight: '700',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  monthNavBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  weekdayRow: {
    flexDirection: 'row',
    marginBottom: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4EF',
  },
  weekdayText: {
    width: '14.285%',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
  daysGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: 4,
  },
  dayCell: {
    width: '14.285%',
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBadgeSelected: {
    backgroundColor: Colors.primary,
    elevation: 2,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
  dayBadgeToday: {
    backgroundColor: '#E5F4EC',
    borderWidth: 1,
    borderColor: '#C6E8D5',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  dayTextMuted: {
    color: Colors.textDisabled,
    fontWeight: '400',
  },
  dayTextSelected: {
    color: Colors.textInverse,
    fontWeight: '700',
  },
  successOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(244, 246, 243, 0.86)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  successCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    paddingHorizontal: Spacing['3xl'],
    paddingVertical: Spacing['2xl'],
    alignItems: 'center',
    gap: Spacing.md,
    ...Shadows.bottomSheet,
  },
  successCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
});
