/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { Alert } from '../../components/common/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { addDays, addMonths, format, isValid, parseISO, startOfMonth } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { Calendar, Trash2, Wallet as WalletIcon, X } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Shapes } from '../../theme/shapes';
import { Shadows } from '../../theme/shadows';
import { Spacing } from '../../theme/spacing';
import { Button, Card, Chip, Input, LoadingState, SoftSwitch } from '../../components/common';
import { getDatabase } from '../../database/database';
import { RecurringRepository } from '../../database/repositories/RecurringRepository';
import { RecurringService } from '../../services/recurring/RecurringService';
import { renderCategoryIcon } from '../../services/recurring/iconHelper';
import { useCategoryStore } from '../../store/categoryStore';
import { useWalletStore } from '../../store/walletStore';
import { useSettingsStore } from '../../store/settingsStore';
import {
  formatCurrency,
  fromMinorUnits,
  getCurrencySymbol,
  toMinorUnits,
} from '../../utils/currencyUtils';
import { RecurringFrequency } from '../../types/recurring.types';

const FREQUENCY_OPTIONS: Array<{ key: RecurringFrequency; label: string }> = [
  { key: 'daily', label: 'Daily' },
  { key: 'weekly', label: 'Weekly' },
  { key: 'biweekly', label: 'Bi-weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'custom', label: 'Custom' },
];

const REMINDER_DAYS_OPTIONS = [0, 1, 2, 3, 5, 7];

export default function AddRecurringModal() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(params.id);

  const settings = useSettingsStore((s) => s.settings);
  const { categories, loadCategories } = useCategoryStore();
  const { wallets, balances, loadWallets } = useWalletStore();

  const currency = settings?.baseCurrency || 'INR';
  const numberFormat = settings?.numberFormat || 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  const defaultReminderDays = settings?.recurringReminderDays ?? 2;
  const hapticEnabled = settings?.hapticEnabled ?? true;

  const [isInitializing, setIsInitializing] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Form fields
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [walletId, setWalletId] = useState('');
  const [frequency, setFrequency] = useState<RecurringFrequency>('monthly');
  const [frequencyDays, setFrequencyDays] = useState('30');
  const [startDateText, setStartDateText] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [endDateText, setEndDateText] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderDaysBefore, setReminderDaysBefore] = useState(defaultReminderDays);
  const [autoCreate, setAutoCreate] = useState(false);
  const [note, setNote] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const expenseCategories = categories.filter((c) => c.type === 'expense' && !c.isArchived);

  const initialize = useCallback(async () => {
    setIsInitializing(true);
    try {
      await Promise.all([loadCategories(), loadWallets()]);

      if (params.id) {
        const db = await getDatabase();
        const repo = new RecurringRepository(db);
        const existing = await repo.getById(params.id);
        if (existing) {
          setTitle(existing.title);
          setAmountText(String(fromMinorUnits(existing.amountMinor)));
          setCategoryId(existing.categoryId);
          setWalletId(existing.walletId);
          setFrequency(existing.frequency);
          setFrequencyDays(String(existing.frequencyDays ?? 30));
          setStartDateText(format(new Date(existing.startDate), 'yyyy-MM-dd'));
          setEndDateText(existing.endDate ? format(new Date(existing.endDate), 'yyyy-MM-dd') : '');
          setReminderEnabled(existing.reminderEnabled);
          setReminderDaysBefore(existing.reminderDaysBefore);
          setAutoCreate(existing.autoCreate);
          setNote(existing.note ?? '');
        }
      }
    } catch (error) {
      console.error('AddRecurringModal init failed:', error);
    } finally {
      setIsInitializing(false);
    }
  }, [params.id, loadCategories, loadWallets]);

  useEffect(() => {
    initialize();
  }, [initialize]);

  // Select defaults once categories & wallets are loaded (for add mode)
  useEffect(() => {
    if (!isEditing && !categoryId && expenseCategories.length > 0) {
      setCategoryId(expenseCategories[0].id);
    }
  }, [isEditing, categoryId, expenseCategories]);

  useEffect(() => {
    if (!isEditing && !walletId && wallets.length > 0) {
      setWalletId(wallets[0].id);
    }
  }, [isEditing, walletId, wallets]);

  const validate = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!title.trim()) {
      nextErrors.title = 'Please enter a title (e.g., Rent, Netflix).';
    }
    const parsedAmt = parseFloat(amountText.replace(/[^0-9.]/g, ''));
    if (isNaN(parsedAmt) || parsedAmt <= 0) {
      nextErrors.amount = 'Enter an amount greater than 0.';
    }
    if (!categoryId) {
      nextErrors.category = 'Please choose a category.';
    }
    if (!walletId) {
      nextErrors.wallet = 'Please choose a wallet.';
    }
    if (frequency === 'custom') {
      const days = parseInt(frequencyDays, 10);
      if (isNaN(days) || days < 1 || days > 365) {
        nextErrors.frequencyDays = 'Enter a number of days between 1 and 365.';
      }
    }
    const parsedStart = parseISO(startDateText.trim());
    if (!isValid(parsedStart)) {
      nextErrors.startDate = 'Use valid YYYY-MM-DD format.';
    }
    if (endDateText.trim()) {
      const parsedEnd = parseISO(endDateText.trim());
      if (!isValid(parsedEnd)) {
        nextErrors.endDate = 'Use valid YYYY-MM-DD format or leave blank.';
      } else if (isValid(parsedStart) && parsedEnd < parsedStart) {
        nextErrors.endDate = 'End date must be on or after start date.';
      }
    }
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const parsedAmt = parseFloat(amountText.replace(/[^0-9.]/g, ''));
      const amountMinor = toMinorUnits(parsedAmt);
      const startIso = parseISO(startDateText.trim()).toISOString();
      const endIso = endDateText.trim() ? parseISO(endDateText.trim()).toISOString() : null;
      const customDays = frequency === 'custom' ? parseInt(frequencyDays, 10) || 30 : null;
      const selectedWallet = wallets.find((w) => w.id === walletId);
      const itemCurrency = selectedWallet?.currencyCode || currency;

      const db = await getDatabase();
      const repo = new RecurringRepository(db);

      const payload = {
        title: title.trim(),
        amountMinor,
        currencyCode: itemCurrency,
        categoryId,
        walletId,
        frequency,
        frequencyDays: customDays,
        startDate: startIso,
        endDate: endIso,
        nextDueDate: startIso,
        reminderEnabled,
        reminderDaysBefore,
        reminderTime: '09:00',
        autoCreate,
        isActive: true,
        note: note.trim() || null,
      };

      let saved;
      if (isEditing && params.id) {
        saved = await repo.update(params.id, payload);
      } else {
        saved = await repo.insert(payload);
      }

      if (saved.reminderEnabled) {
        await RecurringService.scheduleReminder(saved);
      }

      if (hapticEnabled) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      router.back();
    } catch (error) {
      console.error('Failed to save recurring payment:', error);
      Alert.alert('Save Failed', 'Unable to save recurring payment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (!params.id) return;
    Alert.alert(
      'Delete Recurring Payment',
      'Are you sure you want to delete this recurring payment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const db = await getDatabase();
              const repo = new RecurringRepository(db);
              await repo.delete(params.id!);
              router.back();
            } catch (error) {
              console.error('Delete recurring failed:', error);
              Alert.alert('Error', 'Could not delete recurring payment.');
            }
          },
        },
      ]
    );
  };

  const setQuickStartDate = (date: Date) => {
    if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
    setStartDateText(format(date, 'yyyy-MM-dd'));
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Modal Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>
            {isEditing ? 'Edit Recurring' : 'Add Recurring Payment'}
          </Text>
          {isEditing ? (
            <Pressable
              onPress={handleDelete}
              style={({ pressed }) => [styles.deleteIconBtn, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Delete recurring payment"
            >
              <Trash2 size={18} color={Colors.expense} />
            </Pressable>
          ) : (
            <View style={styles.headerSpacer} />
          )}
        </View>

        {isInitializing ? (
          <LoadingState message="Loading form..." />
        ) : (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {/* Amount Input Card */}
            <Card style={styles.amountCard}>
              <Text style={styles.fieldCaption}>Amount</Text>
              <View style={styles.amountRow}>
                <Text style={styles.currencyPrefix}>{getCurrencySymbol(currency)}</Text>
                <TextInput
                  style={styles.amountInput}
                  value={amountText}
                  onChangeText={(txt) => {
                    setAmountText(txt.replace(/[^0-9.]/g, ''));
                    if (errors.amount) setErrors((e) => ({ ...e, amount: '' }));
                  }}
                  placeholder="0.00"
                  placeholderTextColor={Colors.textDisabled}
                  keyboardType="decimal-pad"
                  returnKeyType="done"
                />
              </View>
              {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
            </Card>

            {/* Title */}
            <Input
              label="Title"
              value={title}
              onChangeText={(txt) => {
                setTitle(txt);
                if (errors.title) setErrors((e) => ({ ...e, title: '' }));
              }}
              placeholder="e.g., House Rent, Netflix, Electricity"
              maxLength={60}
              error={errors.title}
            />

            {/* Category Picker */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionLabel}>Category</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.horizontalList}
              >
                {expenseCategories.map((cat) => {
                  const selected = categoryId === cat.id;
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => {
                        if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
                        setCategoryId(cat.id);
                      }}
                      style={[
                        styles.selectablePill,
                        selected && {
                          borderColor: cat.color,
                          backgroundColor: `${cat.color}18`,
                        },
                      ]}
                    >
                      <View style={[styles.miniIcon, { backgroundColor: `${cat.color}22` }]}>
                        {renderCategoryIcon(cat.iconName, 16, cat.color)}
                      </View>
                      <Text
                        style={[
                          styles.pillText,
                          selected && { color: cat.color, fontWeight: '600' },
                        ]}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
            </View>

            {/* Wallet Picker */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionLabel}>Wallet</Text>
              {wallets.length === 0 ? (
                <Card compact>
                  <Text style={styles.emptyWalletNote}>
                    No wallets found. Create a wallet first from Settings under Wallets.
                  </Text>
                </Card>
              ) : (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.horizontalList}
                >
                  {wallets.map((w) => {
                    const selected = walletId === w.id;
                    const bal = balances[w.id] ?? w.openingBalanceMinor;
                    return (
                      <Pressable
                        key={w.id}
                        onPress={() => {
                          if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
                          setWalletId(w.id);
                        }}
                        style={[
                          styles.walletChip,
                          selected && styles.walletChipSelected,
                        ]}
                      >
                        <View style={[styles.miniIcon, { backgroundColor: `${w.color}22` }]}>
                          <WalletIcon size={15} color={w.color} />
                        </View>
                        <View>
                          <Text
                            style={[
                              styles.walletName,
                              selected && { color: Colors.primary, fontWeight: '700' },
                            ]}
                          >
                            {w.name}
                          </Text>
                          <Text style={styles.walletBal}>
                            {formatCurrency(bal, w.currencyCode || currency, numberFormat, decimalPlaces)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
              {errors.wallet ? <Text style={styles.errorText}>{errors.wallet}</Text> : null}
            </View>

            {/* Frequency Chips */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionLabel}>Frequency</Text>
              <View style={styles.wrapRow}>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <Chip
                    key={opt.key}
                    label={opt.label}
                    active={frequency === opt.key}
                    onPress={() => {
                      if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
                      setFrequency(opt.key);
                    }}
                  />
                ))}
              </View>
              {frequency === 'custom' ? (
                <Input
                  label="Repeat every (days)"
                  value={frequencyDays}
                  onChangeText={(txt) => setFrequencyDays(txt.replace(/[^0-9]/g, ''))}
                  keyboardType="number-pad"
                  placeholder="30"
                  error={errors.frequencyDays}
                  containerStyle={{ marginTop: Spacing.sm }}
                />
              ) : null}
            </View>

            {/* Start & End Date */}
            <View style={styles.sectionGroup}>
              <Text style={styles.sectionLabel}>Schedule</Text>
              <View style={styles.quickDatesRow}>
                <Chip label="Today" onPress={() => setQuickStartDate(new Date())} />
                <Chip label="Tomorrow" onPress={() => setQuickStartDate(addDays(new Date(), 1))} />
                <Chip
                  label="1st Next Month"
                  onPress={() => setQuickStartDate(startOfMonth(addMonths(new Date(), 1)))}
                />
              </View>
              <View style={styles.dateInputsRow}>
                <Input
                  label="Start / Next Due"
                  value={startDateText}
                  onChangeText={setStartDateText}
                  placeholder="YYYY-MM-DD"
                  leftElement={<Calendar size={16} color={Colors.textSecondary} />}
                  error={errors.startDate}
                  containerStyle={styles.dateInputHalf}
                />
                <Input
                  label="End Date (Optional)"
                  value={endDateText}
                  onChangeText={setEndDateText}
                  placeholder="Ongoing"
                  leftElement={<Calendar size={16} color={Colors.textDisabled} />}
                  error={errors.endDate}
                  containerStyle={styles.dateInputHalf}
                />
              </View>
            </View>

            {/* Toggles Card: Reminder & Auto-Create */}
            <Card style={styles.togglesCard}>
              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Bill Reminder</Text>
                  <Text style={styles.toggleSubtitle}>
                    Get a local notification before payment is due
                  </Text>
                </View>
                <SoftSwitch
                  value={reminderEnabled}
                  onValueChange={setReminderEnabled}
                  accessibilityLabel="Bill Reminder"
                />
              </View>

              {reminderEnabled ? (
                <View style={styles.reminderDaysBlock}>
                  <Text style={styles.reminderDaysLabel}>Notify me:</Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.horizontalList}
                  >
                    {REMINDER_DAYS_OPTIONS.map((d) => (
                      <Chip
                        key={d}
                        label={d === 0 ? 'Same day' : `${d}d before`}
                        active={reminderDaysBefore === d}
                        onPress={() => setReminderDaysBefore(d)}
                        style={styles.smallChip}
                      />
                    ))}
                  </ScrollView>
                </View>
              ) : null}

              <View style={styles.toggleDivider} />

              <View style={styles.toggleRow}>
                <View style={styles.toggleInfo}>
                  <Text style={styles.toggleTitle}>Auto-create transaction</Text>
                  <Text style={styles.toggleSubtitle}>
                    Automatically log an expense when due date arrives
                  </Text>
                </View>
                <SoftSwitch
                  value={autoCreate}
                  onValueChange={setAutoCreate}
                  accessibilityLabel="Auto-create transaction"
                />
              </View>
            </Card>

            {/* Notes */}
            <Input
              label="Notes (optional)"
              value={note}
              onChangeText={setNote}
              placeholder="Account number, billing details, etc."
              multiline
              numberOfLines={3}
              maxLength={200}
              style={styles.notesInput}
            />

            {/* Save Button */}
            <Button
              title={isEditing ? 'Save Changes' : 'Save Recurring Payment'}
              onPress={handleSave}
              loading={isSaving}
              style={styles.saveBtn}
            />
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#EDF2EC',
    backgroundColor: Colors.bgMain,
  },
  closeBtn: {
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
  deleteIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FDF0ED',
    borderWidth: 1,
    borderColor: '#F9D8D0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 80,
    gap: 14,
  },
  amountCard: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  fieldCaption: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginBottom: Spacing.xs,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  currencyPrefix: {
    fontSize: 28,
    fontWeight: '600',
    color: Colors.primary,
  },
  amountInput: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.textPrimary,
    minWidth: 120,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    paddingVertical: 4,
  },
  sectionGroup: {
    gap: Spacing.sm,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  horizontalList: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  selectablePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 14,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  miniIcon: {
    width: 28,
    height: 28,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textPrimary,
  },
  walletChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 14,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  walletChipSelected: {
    borderColor: '#C6E8D5',
    backgroundColor: '#E5F4EC',
  },
  walletName: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  walletBal: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  emptyWalletNote: {
    fontSize: 13,
    color: Colors.expense,
  },
  wrapRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  quickDatesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  dateInputsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  dateInputHalf: {
    flex: 1,
  },
  togglesCard: {
    gap: Spacing.md,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  toggleInfo: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  toggleSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  toggleDivider: {
    height: 1,
    backgroundColor: '#F0F4EF',
  },
  reminderDaysBlock: {
    gap: Spacing.xs,
  },
  reminderDaysLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  smallChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    minHeight: 32,
  },
  notesInput: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  saveBtn: {
    marginTop: Spacing.sm,
  },
  errorText: {
    fontSize: 12,
    color: Colors.expense,
    marginTop: 2,
  },
  pressed: {
    opacity: 0.72,
  },
});
