/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import { Calendar, Check, ChevronLeft, ChevronRight, X } from 'lucide-react-native';
import {
  addDays,
  endOfDay,
  endOfMonth,
  format,
  isSameDay,
  startOfDay,
  startOfMonth,
  startOfWeek,
  addMonths,
  subMonths,
} from 'date-fns';
import { TransactionFilters, TransactionType } from '../../types/transaction.types';
import { Category } from '../../types/category.types';
import { Wallet } from '../../types/wallet.types';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Shapes } from '../../theme/shapes';
import { getPeriodRange, formatDisplay, toISO } from '../../utils/dateUtils';
import { useSettingsStore } from '../../store/settingsStore';

export type DateRangePreset = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

export interface FilterSheetProps {
  visible: boolean;
  filters: TransactionFilters;
  datePreset: DateRangePreset;
  categories: Category[];
  wallets: Wallet[];
  onApply: (filters: TransactionFilters, datePreset: DateRangePreset) => void;
  onReset: () => void;
  onClose: () => void;
}

const TYPE_OPTIONS: Array<{ value: TransactionType | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'expense', label: 'Expenses' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfers' },
];

const DATE_OPTIONS: Array<{ value: DateRangePreset; label: string }> = [
  { value: 'all', label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' },
];

const SORT_OPTIONS: Array<{
  value: NonNullable<TransactionFilters['sortBy']>;
  label: string;
}> = [
  { value: 'date_desc', label: 'Newest First' },
  { value: 'date_asc', label: 'Oldest First' },
  { value: 'amount_desc', label: 'Amount High–Low' },
  { value: 'amount_asc', label: 'Amount Low–High' },
];

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

interface InlineCalendarModalProps {
  visible: boolean;
  title: string;
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const InlineCalendarModal: React.FC<InlineCalendarModalProps> = ({
  visible,
  title,
  selectedDate,
  onSelect,
  onClose,
}) => {
  const [viewMonth, setViewMonth] = useState<Date>(startOfMonth(selectedDate));

  useEffect(() => {
    if (visible) {
      setViewMonth(startOfMonth(selectedDate));
    }
  }, [visible, selectedDate]);

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(viewMonth);
    const monthEnd = endOfMonth(viewMonth);
    const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
    const days: Date[] = [];
    let cursor = gridStart;
    while (days.length < 42) {
      days.push(cursor);
      cursor = addDays(cursor, 1);
      if (days.length >= 35 && cursor > monthEnd && cursor.getDay() === 1) break;
    }
    return days;
  }, [viewMonth]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.calendarCard} onPress={() => {}}>
          <View style={styles.calendarHeader}>
            <Text style={styles.calendarTitle}>{title}</Text>
            <Pressable onPress={onClose} style={styles.calendarClose}>
              <X size={18} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={styles.monthNav}>
            <Pressable
              onPress={() => setViewMonth((prev) => subMonths(prev, 1))}
              style={styles.monthNavBtn}
            >
              <ChevronLeft size={20} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.monthLabel}>{format(viewMonth, 'MMMM yyyy')}</Text>
            <Pressable
              onPress={() => setViewMonth((prev) => addMonths(prev, 1))}
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
              const isCurrentMonth = day.getMonth() === viewMonth.getMonth();
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isSameDay(day, new Date());
              return (
                <Pressable
                  key={day.toISOString()}
                  onPress={() => {
                    onSelect(day);
                    onClose();
                  }}
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
  );
};

export const FilterSheet: React.FC<FilterSheetProps> = ({
  visible,
  filters,
  datePreset,
  categories,
  wallets,
  onApply,
  onReset,
  onClose,
}) => {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['82%', '94%'], []);
  const { settings } = useSettingsStore();
  const insets = useSafeAreaInsets();
  const footerPaddingBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 16;

  const [draftType, setDraftType] = useState<TransactionType | 'all'>(filters.type || 'all');
  const [draftDatePreset, setDraftDatePreset] = useState<DateRangePreset>(datePreset);
  const [customStart, setCustomStart] = useState<Date>(
    filters.startDate ? new Date(filters.startDate) : startOfMonth(new Date())
  );
  const [customEnd, setCustomEnd] = useState<Date>(
    filters.endDate ? new Date(filters.endDate) : new Date()
  );
  const [draftSortBy, setDraftSortBy] = useState<NonNullable<TransactionFilters['sortBy']>>(
    filters.sortBy || 'date_desc'
  );
  const [draftCategoryIds, setDraftCategoryIds] = useState<string[]>(filters.categoryIds || []);
  const [draftWalletIds, setDraftWalletIds] = useState<string[]>(filters.walletIds || []);
  const [pickingDateField, setPickingDateField] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    if (visible) {
      setDraftType(filters.type || 'all');
      setDraftDatePreset(datePreset);
      setCustomStart(filters.startDate ? new Date(filters.startDate) : startOfMonth(new Date()));
      setCustomEnd(filters.endDate ? new Date(filters.endDate) : new Date());
      setDraftSortBy(filters.sortBy || 'date_desc');
      setDraftCategoryIds(filters.categoryIds || []);
      setDraftWalletIds(filters.walletIds || []);
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [visible, filters, datePreset]);

  const renderBackdrop = useCallback(
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

  const handleSheetChange = useCallback(
    (index: number) => {
      if (index === -1) {
        onClose();
      }
    },
    [onClose]
  );

  const triggerHaptic = () => {
    if (settings?.hapticEnabled !== false) {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  const toggleCategory = (id: string) => {
    triggerHaptic();
    setDraftCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleWallet = (id: string) => {
    triggerHaptic();
    setDraftWalletIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleApply = () => {
    if (settings?.hapticEnabled !== false) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }

    let startDate: string | undefined;
    let endDate: string | undefined;

    if (
      draftDatePreset === 'today' ||
      draftDatePreset === 'week' ||
      draftDatePreset === 'month' ||
      draftDatePreset === 'year'
    ) {
      const range = getPeriodRange(draftDatePreset);
      startDate = range.start;
      endDate = range.end;
    } else if (draftDatePreset === 'custom') {
      const orderedStart = customStart <= customEnd ? customStart : customEnd;
      const orderedEnd = customEnd >= customStart ? customEnd : customStart;
      startDate = toISO(startOfDay(orderedStart));
      endDate = toISO(endOfDay(orderedEnd));
    }

    const nextFilters: TransactionFilters = {
      ...filters,
      type: draftType,
      startDate,
      endDate,
      sortBy: draftSortBy,
      categoryIds: draftCategoryIds.length > 0 ? draftCategoryIds : undefined,
      walletIds: draftWalletIds.length > 0 ? draftWalletIds : undefined,
    };

    onApply(nextFilters, draftDatePreset);
    onClose();
  };

  const handleReset = () => {
    triggerHaptic();
    setDraftType('all');
    setDraftDatePreset('all');
    setDraftSortBy('date_desc');
    setDraftCategoryIds([]);
    setDraftWalletIds([]);
    onReset();
    onClose();
  };

  if (!visible) {
    return null;
  }

  return (
    <>
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose
        onChange={handleSheetChange}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.handleIndicator}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Filter & Sort</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="Close filters"
          >
            <X size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        <BottomSheetScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Type */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Type</Text>
            <View style={styles.radioGrid}>
              {TYPE_OPTIONS.map((option) => {
                const selected = draftType === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      triggerHaptic();
                      setDraftType(option.value);
                    }}
                    style={[styles.radioPill, selected && styles.radioPillSelected]}
                  >
                    <View style={[styles.radioOuter, selected && styles.radioOuterSelected]}>
                      {selected && <View style={styles.radioInner} />}
                    </View>
                    <Text style={[styles.radioLabel, selected && styles.radioLabelSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Section: Date Range */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Date Range</Text>
            <View style={styles.chipWrap}>
              {DATE_OPTIONS.map((option) => {
                const selected = draftDatePreset === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      triggerHaptic();
                      setDraftDatePreset(option.value);
                    }}
                    style={[styles.chip, selected && styles.chipSelected]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {draftDatePreset === 'custom' && (
              <View style={styles.customRangeRow}>
                <Pressable
                  onPress={() => setPickingDateField('start')}
                  style={styles.dateBox}
                >
                  <Calendar size={16} color={Colors.primary} />
                  <View>
                    <Text style={styles.dateBoxLabel}>From</Text>
                    <Text style={styles.dateBoxValue}>
                      {formatDisplay(customStart, 'dd MMM yyyy')}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  onPress={() => setPickingDateField('end')}
                  style={styles.dateBox}
                >
                  <Calendar size={16} color={Colors.primary} />
                  <View>
                    <Text style={styles.dateBoxLabel}>To</Text>
                    <Text style={styles.dateBoxValue}>
                      {formatDisplay(customEnd, 'dd MMM yyyy')}
                    </Text>
                  </View>
                </Pressable>
              </View>
            )}
          </View>

          {/* Section: Wallets */}
          {wallets.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wallets</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {wallets.map((wallet) => {
                  const selected = draftWalletIds.includes(wallet.id);
                  return (
                    <Pressable
                      key={wallet.id}
                      onPress={() => toggleWallet(wallet.id)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <View style={[styles.dot, { backgroundColor: wallet.color }]} />
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {wallet.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Section: Categories */}
          {categories.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Categories</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {categories.map((cat) => {
                  const selected = draftCategoryIds.includes(cat.id);
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => toggleCategory(cat.id)}
                      style={[styles.chip, selected && styles.chipSelected]}
                    >
                      <View style={[styles.dot, { backgroundColor: cat.color }]} />
                      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {/* Section: Sort By */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Sort By</Text>
            <View style={styles.sortList}>
              {SORT_OPTIONS.map((option) => {
                const selected = draftSortBy === option.value;
                return (
                  <Pressable
                    key={option.value}
                    onPress={() => {
                      triggerHaptic();
                      setDraftSortBy(option.value);
                    }}
                    style={[styles.sortRow, selected && styles.sortRowSelected]}
                  >
                    <Text style={[styles.sortLabel, selected && styles.sortLabelSelected]}>
                      {option.label}
                    </Text>
                    {selected ? (
                      <View style={styles.sortCheckCircle}>
                        <Check size={14} color={Colors.textInverse} strokeWidth={3} />
                      </View>
                    ) : (
                      <View style={styles.sortUncheckedCircle} />
                    )}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </BottomSheetScrollView>

        {/* Footer Buttons */}
        <View style={[styles.footer, { paddingBottom: footerPaddingBottom }]}>
          <Pressable
            onPress={handleReset}
            style={({ pressed }) => [styles.resetButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Reset filters"
          >
            <Text style={styles.resetButtonText}>Reset</Text>
          </Pressable>

          <Pressable
            onPress={handleApply}
            style={({ pressed }) => [styles.applyButton, pressed && styles.buttonPressed]}
            accessibilityRole="button"
            accessibilityLabel="Apply filters"
          >
            <Text style={styles.applyButtonText}>Apply Filters</Text>
          </Pressable>
        </View>
      </BottomSheet>

      <InlineCalendarModal
        visible={pickingDateField !== null}
        title={pickingDateField === 'start' ? 'Select Start Date' : 'Select End Date'}
        selectedDate={pickingDateField === 'start' ? customStart : customEnd}
        onSelect={(date) => {
          if (pickingDateField === 'start') {
            setCustomStart(date);
            if (date > customEnd) setCustomEnd(date);
          } else {
            setCustomEnd(date);
            if (date < customStart) setCustomStart(date);
          }
        }}
        onClose={() => setPickingDateField(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  sheetBackground: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Shapes.bottomSheetRadius,
    borderTopRightRadius: Shapes.bottomSheetRadius,
  },
  handleIndicator: {
    backgroundColor: Colors.borderStrong,
    width: 40,
    height: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 19,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  closeBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.lg,
    paddingBottom: 72,
    gap: Spacing.xl,
  },
  section: {
    gap: Spacing.md,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  radioGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  radioPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
    borderRadius: 14,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF2EC',
    minWidth: '47%',
    flexGrow: 1,
  },
  radioPillSelected: {
    backgroundColor: '#E5F4EC',
    borderColor: Colors.primary,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterSelected: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  radioLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  radioLabelSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  horizontalList: {
    gap: Spacing.sm,
    paddingRight: Spacing.md,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 100,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  chipSelected: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
  },
  chipText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  chipTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  customRangeRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.xs,
  },
  dateBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderRadius: 14,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  dateBoxLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
  dateBoxValue: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: 2,
  },
  sortList: {
    gap: Spacing.sm,
  },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: 14,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  sortRowSelected: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
  },
  sortLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  sortLabelSelected: {
    fontWeight: '600',
    color: Colors.primary,
  },
  sortCheckCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortUncheckedCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: '#EDF2EC',
  },
  footer: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
  },
  resetButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  applyButton: {
    flex: 2,
    height: 50,
    borderRadius: 16,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textInverse,
  },
  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(30, 43, 37, 0.45)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  calendarCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: Spacing.xl,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowOffset: { width: 0, height: 6 },
    shadowRadius: 16,
  },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  calendarTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  calendarClose: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
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
    paddingVertical: 4,
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
});
