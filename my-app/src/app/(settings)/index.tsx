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
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '../../components/common/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import * as LocalAuthentication from 'expo-local-authentication';
import {
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Coins,
  Database,
  Download,
  FileText,
  FolderKanban,
  Globe,
  Hash,
  Heart,
  Info,
  Lock,
  Palette,
  Repeat,
  Shield,
  Sliders,
  Sparkles,
  Trash2,
  Upload,
  User,
  Vibrate,
  Wallet,
  X,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Shapes } from '../../theme/shapes';
import { Shadows } from '../../theme/shadows';
import { Spacing } from '../../theme/spacing';
import { APP_VERSION } from '../../constants/config';
import { getDatabase } from '../../database/database';
import { SettingsRepository } from '../../database/repositories/SettingsRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { useSettingsStore } from '../../store/settingsStore';
import { useWalletStore } from '../../store/walletStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useBudgetStore } from '../../store/budgetStore';
import { useCategoryStore } from '../../store/categoryStore';
import { NotificationService } from '../../services/notifications/NotificationService';
import { Button, Chip, Input, SoftSwitch } from '../../components/common';

interface PickerOption<T> {
  label: string;
  subtitle?: string;
  value: T;
}

interface ActivePicker {
  title: string;
  options: PickerOption<any>[];
  selectedValue: any;
  onSelect: (value: any) => void;
}

interface DbStats {
  wallets: number;
  categories: number;
  transactions: number;
  budgets: number;
  recurring: number;
  backups: number;
}

const DATE_FORMAT_OPTIONS: PickerOption<string>[] = [
  { label: 'DD/MM/YYYY', subtitle: '18/11/2026', value: 'DD/MM/YYYY' },
  { label: 'MM/DD/YYYY', subtitle: '11/18/2026', value: 'MM/DD/YYYY' },
  { label: 'YYYY-MM-DD', subtitle: '2026-11-18', value: 'YYYY-MM-DD' },
  { label: 'dd MMM yyyy', subtitle: '18 Nov 2026', value: 'dd MMM yyyy' },
];

const NUMBER_FORMAT_OPTIONS: PickerOption<'indian' | 'international'>[] = [
  { label: 'Indian (1,00,000)', subtitle: 'Lakhs & Crores', value: 'indian' },
  { label: 'International (1,000,000)', subtitle: 'Thousands & Millions', value: 'international' },
];

const DECIMAL_OPTIONS: PickerOption<number>[] = [
  { label: '0 decimal places', subtitle: '₹1,250', value: 0 },
  { label: '1 decimal place', subtitle: '₹1,250.5', value: 1 },
  { label: '2 decimal places', subtitle: '₹1,250.50', value: 2 },
];

const FIRST_DAY_OPTIONS: PickerOption<number>[] = [
  { label: 'Sunday', value: 0 },
  { label: 'Monday', value: 1 },
];

const ADVANCE_NOTICE_OPTIONS: PickerOption<number>[] = [
  { label: 'Same day', value: 0 },
  { label: '1 day before', value: 1 },
  { label: '2 days before', value: 2 },
  { label: '3 days before', value: 3 },
  { label: '5 days before', value: 5 },
  { label: '7 days before', value: 7 },
];

const THRESHOLD_STEPS = [50, 60, 70, 75, 80, 85, 90, 95, 100];

const OPEN_SOURCE_LICENSES = [
  { name: 'React & React Native', license: 'MIT License' },
  { name: 'Expo & Expo Router', license: 'MIT License' },
  { name: 'Lucide React Native', license: 'ISC License' },
  { name: 'Zustand', license: 'MIT License' },
  { name: 'date-fns', license: 'MIT License' },
  { name: 'react-native-gifted-charts', license: 'MIT License' },
  { name: '@gorhom/bottom-sheet', license: 'MIT License' },
  { name: 'react-native-svg', license: 'MIT License' },
];

interface SettingsRowProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  destructive?: boolean;
  isLast?: boolean;
}

function SettingsRow({
  icon,
  iconBg,
  label,
  value,
  onPress,
  rightElement,
  showChevron = false,
  destructive = false,
  isLast = false,
}: SettingsRowProps) {
  const content = (
    <View style={[styles.row, !isLast && styles.rowDivider]}>
      <View style={[styles.rowIconBox, { backgroundColor: iconBg }]}>{icon}</View>
      <Text
        style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}
        numberOfLines={1}
      >
        {label}
      </Text>
      <View style={styles.rowRight}>
        {value ? (
          <Text style={styles.rowValue} numberOfLines={1}>
            {value}
          </Text>
        ) : null}
        {rightElement}
        {showChevron ? <ChevronRight size={17} color={Colors.textDisabled} /> : null}
      </View>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      {content}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { settings, loadSettings, updateSetting } = useSettingsStore();
  const loadWallets = useWalletStore((s) => s.loadWallets);
  const loadTransactions = useTransactionStore((s) => s.loadTransactions);
  const loadBudgets = useBudgetStore((s) => s.loadBudgets);
  const loadCategories = useCategoryStore((s) => s.loadCategories);

  const [budgetWarningsEnabled, setBudgetWarningsEnabled] = useState(true);
  const [recurringRemindersEnabled, setRecurringRemindersEnabled] = useState(true);
  const [thresholdExpanded, setThresholdExpanded] = useState(false);

  // Modals
  const [nameModalVisible, setNameModalVisible] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [activePicker, setActivePicker] = useState<ActivePicker | null>(null);
  const [dbStatsModalVisible, setDbStatsModalVisible] = useState(false);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [licensesModalVisible, setLicensesModalVisible] = useState(false);

  const hapticEnabled = settings?.hapticEnabled ?? true;

  const triggerHaptic = () => {
    if (hapticEnabled) Haptics.selectionAsync().catch(() => {});
  };

  const loadNotificationFlags = useCallback(async () => {
    try {
      const db = await getDatabase();
      const repo = new SettingsRepository(db);
      const bw = await repo.getSetting('budget_warnings_enabled');
      const rr = await repo.getSetting('recurring_reminders_enabled');
      setBudgetWarningsEnabled(bw !== 'false');
      setRecurringRemindersEnabled(rr !== 'false');
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSettings();
      loadNotificationFlags();
    }, [loadSettings, loadNotificationFlags])
  );

  useEffect(() => {
    if (settings?.userName !== undefined) {
      setNameDraft(settings.userName);
    }
  }, [settings?.userName]);

  const handleSaveName = async () => {
    triggerHaptic();
    await updateSetting('userName', nameDraft.trim());
    setNameModalVisible(false);
  };

  const handleToggleBudgetWarnings = async (val: boolean) => {
    triggerHaptic();
    if (val) {
      await NotificationService.requestPermissions();
    }
    setBudgetWarningsEnabled(val);
    const db = await getDatabase();
    const repo = new SettingsRepository(db);
    await repo.setSetting('budget_warnings_enabled', String(val));
  };

  const handleToggleRecurringReminders = async (val: boolean) => {
    triggerHaptic();
    if (val) {
      await NotificationService.requestPermissions();
    }
    setRecurringRemindersEnabled(val);
    const db = await getDatabase();
    const repo = new SettingsRepository(db);
    await repo.setSetting('recurring_reminders_enabled', String(val));
  };

  const handleToggleAppLock = async (val: boolean) => {
    triggerHaptic();
    if (!val) {
      await updateSetting('appLocked', false);
      return;
    }

    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert(
          'Biometric / PIN Unavailable',
          'Please set up Face ID, fingerprint, or a device passcode in your system settings before enabling Spendly App Lock.'
        );
        return;
      }

      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirm identity to enable App Lock',
        cancelLabel: 'Cancel',
        fallbackLabel: 'Use Passcode',
      });

      if (result.success) {
        await updateSetting('appLocked', true);
      }
    } catch (error) {
      console.warn('App lock authentication check failed:', error);
      Alert.alert(
        'Authentication Error',
        'Unable to verify device authentication right now. Please try again.'
      );
    }
  };

  const handleOpenDbInfo = async () => {
    triggerHaptic();
    try {
      const db = await getDatabase();
      const countOf = async (table: string, extraWhere = '') => {
        const row = await db.getFirstAsync<{ cnt: number }>(
          `SELECT COUNT(*) AS cnt FROM ${table} ${extraWhere}`
        );
        return row?.cnt ?? 0;
      };
      const [wallets, categories, transactions, budgets, recurring, backups] = await Promise.all([
        countOf('wallets'),
        countOf('categories'),
        countOf('transactions', 'WHERE is_deleted = 0'),
        countOf('budgets'),
        countOf('recurring_payments'),
        countOf('backup_history'),
      ]);
      setDbStats({ wallets, categories, transactions, budgets, recurring, backups });
      setDbStatsModalVisible(true);
    } catch (error) {
      console.error('Failed to query DB info:', error);
      Alert.alert('Error', 'Unable to read database information.');
    }
  };

  const handleClearAllData = async () => {
    if (deleteConfirmText.trim().toUpperCase() !== 'DELETE') {
      Alert.alert('Confirmation Required', 'Please type DELETE to confirm clearing all data.');
      return;
    }

    setIsDeleting(true);
    try {
      const db = await getDatabase();
      await db.withTransactionAsync(async () => {
        await db.runAsync('DELETE FROM budget_categories');
        await db.runAsync('DELETE FROM transactions');
        await db.runAsync('DELETE FROM recurring_payments');
        await db.runAsync('DELETE FROM budgets');
        await db.runAsync('DELETE FROM categories');
        await db.runAsync('DELETE FROM wallets');
        await db.runAsync('DELETE FROM backup_history');
        await db.runAsync('DELETE FROM app_settings');
      });

      const settingsRepo = new SettingsRepository(db);
      await settingsRepo.initializeDefaultSettings();
      // Keep onboarding completed so user stays inside the app (or can add fresh wallets)
      await settingsRepo.setSetting('onboarding_completed', 'true');

      const categoryRepo = new CategoryRepository(db);
      await categoryRepo.seedDefaults();

      await NotificationService.cancelAllNotifications();

      await Promise.all([
        loadSettings(),
        loadWallets(),
        loadTransactions({}),
        loadBudgets(),
        loadCategories(),
      ]);

      setDeleteConfirmText('');
      setDeleteModalVisible(false);
      Alert.alert('Data Cleared', 'All financial records have been deleted and defaults restored.');
    } catch (error) {
      console.error('Clear all data failed:', error);
      Alert.alert('Error', 'Failed to clear data. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  };

  const appLocked = settings?.appLocked ?? false;
  const baseCurrency = settings?.baseCurrency || 'INR';
  const userName = settings?.userName || '';
  const numberFormatLabel =
    settings?.numberFormat === 'international' ? 'International' : 'Indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;
  const dateFormat = settings?.dateFormat || 'DD/MM/YYYY';
  const firstDayLabel = settings?.firstDayOfWeek === 0 ? 'Sunday' : 'Monday';
  const warningThreshold = settings?.budgetWarningThreshold ?? 80;
  const reminderDays = settings?.recurringReminderDays ?? 2;
  const reminderDaysLabel =
    reminderDays === 0 ? 'Same day' : `${reminderDays} ${reminderDays === 1 ? 'day' : 'days'}`;

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
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Section: Manage */}
        <Text style={styles.sectionHeader}>MANAGE</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Wallet size={18} color={Colors.primary} />}
            iconBg={Colors.primarySoft}
            label="Wallets"
            onPress={() => {
              triggerHaptic();
              router.push('/(settings)/wallets' as never);
            }}
            showChevron
          />
          <SettingsRow
            icon={<FolderKanban size={18} color={Colors.secondary} />}
            iconBg={Colors.secondarySoft}
            label="Categories"
            onPress={() => {
              triggerHaptic();
              router.push('/(settings)/categories' as never);
            }}
            showChevron
          />
          <SettingsRow
            icon={<Repeat size={18} color={Colors.accentLavender} />}
            iconBg={Colors.accentLavenderSoft}
            label="Recurring Payments"
            onPress={() => {
              triggerHaptic();
              router.push('/(settings)/recurring' as never);
            }}
            showChevron
            isLast
          />
        </View>

        {/* Section: Profile & Preferences */}
        <Text style={styles.sectionHeader}>PROFILE & PREFERENCES</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<User size={18} color={Colors.primary} />}
            iconBg={Colors.primarySoft}
            label="Your name"
            value={userName || 'Add name'}
            onPress={() => {
              triggerHaptic();
              setNameDraft(userName);
              setNameModalVisible(true);
            }}
            showChevron
          />
          <SettingsRow
            icon={<Globe size={18} color={Colors.secondary} />}
            iconBg={Colors.secondarySoft}
            label="App language"
            value="English"
          />
          <SettingsRow
            icon={<Palette size={18} color={Colors.accentLavender} />}
            iconBg={Colors.accentLavenderSoft}
            label="Theme"
            value="Light"
          />
          <SettingsRow
            icon={<Vibrate size={18} color={Colors.warning} />}
            iconBg={Colors.warningSoft}
            label="Haptic feedback"
            rightElement={
              <SoftSwitch
                value={hapticEnabled}
                onValueChange={(val) => {
                  updateSetting('hapticEnabled', val);
                }}
                accessibilityLabel="Haptic feedback"
              />
            }
            isLast
          />
        </View>

        {/* Section: Finance Preferences */}
        <Text style={styles.sectionHeader}>FINANCE PREFERENCES</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Coins size={18} color={Colors.primary} />}
            iconBg={Colors.primarySoft}
            label="Base currency"
            value={baseCurrency}
            onPress={() => {
              triggerHaptic();
              router.push('/(settings)/currency-settings' as never);
            }}
            showChevron
          />
          <SettingsRow
            icon={<Hash size={18} color={Colors.secondary} />}
            iconBg={Colors.secondarySoft}
            label="Number format"
            value={numberFormatLabel}
            onPress={() => {
              triggerHaptic();
              setActivePicker({
                title: 'Number Format',
                options: NUMBER_FORMAT_OPTIONS,
                selectedValue: settings?.numberFormat || 'indian',
                onSelect: (val) => updateSetting('numberFormat', val),
              });
            }}
            showChevron
          />
          <SettingsRow
            icon={<Sliders size={18} color={Colors.accentLavender} />}
            iconBg={Colors.accentLavenderSoft}
            label="Decimal places"
            value={String(decimalPlaces)}
            onPress={() => {
              triggerHaptic();
              setActivePicker({
                title: 'Decimal Places',
                options: DECIMAL_OPTIONS,
                selectedValue: decimalPlaces,
                onSelect: (val) => updateSetting('decimalPlaces', val),
              });
            }}
            showChevron
          />
          <SettingsRow
            icon={<Calendar size={18} color={Colors.warning} />}
            iconBg={Colors.warningSoft}
            label="Date format"
            value={dateFormat}
            onPress={() => {
              triggerHaptic();
              setActivePicker({
                title: 'Date Format',
                options: DATE_FORMAT_OPTIONS,
                selectedValue: dateFormat,
                onSelect: (val) => updateSetting('dateFormat', val),
              });
            }}
            showChevron
          />
          <SettingsRow
            icon={<Clock size={18} color={Colors.primary} />}
            iconBg={Colors.primarySoft}
            label="First day of week"
            value={firstDayLabel}
            onPress={() => {
              triggerHaptic();
              setActivePicker({
                title: 'First Day of Week',
                options: FIRST_DAY_OPTIONS,
                selectedValue: settings?.firstDayOfWeek ?? 1,
                onSelect: (val) => updateSetting('firstDayOfWeek', val),
              });
            }}
            showChevron
            isLast
          />
        </View>

        {/* Section: Notifications */}
        <Text style={styles.sectionHeader}>NOTIFICATIONS</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Bell size={18} color={Colors.warning} />}
            iconBg={Colors.warningSoft}
            label="Budget warnings"
            rightElement={
              <SoftSwitch
                value={budgetWarningsEnabled}
                onValueChange={handleToggleBudgetWarnings}
                accessibilityLabel="Budget warnings"
              />
            }
          />
          <SettingsRow
            icon={<Sliders size={18} color={Colors.expense} />}
            iconBg={Colors.expenseSoft}
            label="Warning threshold"
            value={`${warningThreshold}%`}
            onPress={() => {
              triggerHaptic();
              setThresholdExpanded((prev) => !prev);
            }}
            showChevron
          />
          {thresholdExpanded ? (
            <View style={styles.expandableSubRow}>
              <View style={styles.thresholdHeader}>
                <Text style={styles.thresholdCaption}>
                  Notify me when budget usage reaches
                </Text>
                <Text style={styles.thresholdBadge}>{warningThreshold}%</Text>
              </View>
              <View style={styles.thresholdTrack}>
                <View
                  style={[
                    styles.thresholdFill,
                    { width: `${Math.min(100, Math.max(0, warningThreshold))}%` },
                  ]}
                />
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.thresholdChips}
              >
                {THRESHOLD_STEPS.map((pct) => (
                  <Chip
                    key={pct}
                    label={`${pct}%`}
                    active={warningThreshold === pct}
                    onPress={() => {
                      triggerHaptic();
                      updateSetting('budgetWarningThreshold', pct);
                    }}
                    style={styles.thresholdChip}
                  />
                ))}
              </ScrollView>
            </View>
          ) : null}

          <SettingsRow
            icon={<Repeat size={18} color={Colors.primary} />}
            iconBg={Colors.primarySoft}
            label="Recurring reminders"
            rightElement={
              <SoftSwitch
                value={recurringRemindersEnabled}
                onValueChange={handleToggleRecurringReminders}
                accessibilityLabel="Recurring reminders"
              />
            }
          />
          <SettingsRow
            icon={<Clock size={18} color={Colors.secondary} />}
            iconBg={Colors.secondarySoft}
            label="Advance notice"
            value={reminderDaysLabel}
            onPress={() => {
              triggerHaptic();
              setActivePicker({
                title: 'Reminder Advance Notice',
                options: ADVANCE_NOTICE_OPTIONS,
                selectedValue: reminderDays,
                onSelect: (val) => updateSetting('recurringReminderDays', val),
              });
            }}
            showChevron
            isLast
          />
        </View>

        {/* Section: Data & Privacy */}
        <Text style={styles.sectionHeader}>DATA & PRIVACY</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Upload size={18} color={Colors.primary} />}
            iconBg={Colors.primarySoft}
            label="Export Data"
            value="Backup"
            onPress={() => {
              triggerHaptic();
              router.push('/(settings)/backup' as never);
            }}
            showChevron
          />
          <SettingsRow
            icon={<Download size={18} color={Colors.secondary} />}
            iconBg={Colors.secondarySoft}
            label="Import / Restore"
            value=".spendly"
            onPress={() => {
              triggerHaptic();
              router.push('/(settings)/backup' as never);
            }}
            showChevron
          />
          <SettingsRow
            icon={<Database size={18} color={Colors.accentLavender} />}
            iconBg={Colors.accentLavenderSoft}
            label="Database Info"
            onPress={handleOpenDbInfo}
            showChevron
          />
          <SettingsRow
            icon={<Trash2 size={18} color={Colors.expense} />}
            iconBg={Colors.expenseSoft}
            label="Clear All Data"
            destructive
            onPress={() => {
              triggerHaptic();
              setDeleteConfirmText('');
              setDeleteModalVisible(true);
            }}
            showChevron
            isLast
          />
        </View>

        {/* Section: Security */}
        <Text style={styles.sectionHeader}>SECURITY</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Lock size={18} color={Colors.primary} />}
            iconBg={Colors.primarySoft}
            label="App Lock (Biometric / PIN)"
            rightElement={
              <SoftSwitch
                value={appLocked}
                onValueChange={handleToggleAppLock}
                accessibilityLabel="App Lock"
              />
            }
            isLast
          />
        </View>

        {/* Section: About */}
        <Text style={styles.sectionHeader}>ABOUT</Text>
        <View style={styles.sectionCard}>
          <SettingsRow
            icon={<Sparkles size={18} color={Colors.primary} />}
            iconBg={Colors.primarySoft}
            label="First-Time UI (Intro Tour)"
            value="View Tour"
            onPress={() => {
              triggerHaptic();
              router.push('/(onboarding)/welcome' as never);
            }}
            showChevron
          />
          <SettingsRow
            icon={<Info size={18} color={Colors.textSecondary} />}
            iconBg={Colors.bgMain}
            label="App Version"
            value={APP_VERSION}
          />
          <SettingsRow
            icon={<Shield size={18} color={Colors.primary} />}
            iconBg={Colors.primarySoft}
            label="Privacy Policy"
            onPress={() => {
              triggerHaptic();
              router.push('/(settings)/privacy' as never);
            }}
            showChevron
          />
          <SettingsRow
            icon={<FileText size={18} color={Colors.secondary} />}
            iconBg={Colors.secondarySoft}
            label="Open Source Licenses"
            onPress={() => {
              triggerHaptic();
              setLicensesModalVisible(true);
            }}
            showChevron
          />
          <SettingsRow
            icon={<Heart size={18} color={Colors.expense} />}
            iconBg={Colors.expenseSoft}
            label="Rate the App"
            onPress={() => {
              triggerHaptic();
              Alert.alert('Thank you!', 'We appreciate you using Spendly.');
            }}
            showChevron
            isLast
          />
        </View>
      </ScrollView>

      {/* Edit Name Modal */}
      <Modal
        visible={nameModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setNameModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Your Name</Text>
              <Pressable onPress={() => setNameModalVisible(false)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Input
              label="Display name"
              value={nameDraft}
              onChangeText={setNameDraft}
              placeholder="Enter your name"
              autoFocus
              maxLength={40}
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setNameModalVisible(false)}
                fullWidth={false}
                style={styles.modalBtn}
              />
              <Button
                title="Save"
                variant="primary"
                onPress={handleSaveName}
                fullWidth={false}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Generic Option Picker Modal */}
      <Modal
        visible={!!activePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setActivePicker(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{activePicker?.title}</Text>
              <Pressable onPress={() => setActivePicker(null)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.pickerList}>
              {activePicker?.options.map((opt) => {
                const isSelected = opt.value === activePicker.selectedValue;
                return (
                  <Pressable
                    key={String(opt.value)}
                    onPress={() => {
                      triggerHaptic();
                      activePicker.onSelect(opt.value);
                      setActivePicker(null);
                    }}
                    style={({ pressed }) => [
                      styles.pickerOption,
                      isSelected && styles.pickerOptionSelected,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View style={styles.pickerOptionTextWrap}>
                      <Text
                        style={[
                          styles.pickerOptionLabel,
                          isSelected && styles.pickerOptionLabelSelected,
                        ]}
                      >
                        {opt.label}
                      </Text>
                      {opt.subtitle ? (
                        <Text style={styles.pickerOptionSubtitle}>{opt.subtitle}</Text>
                      ) : null}
                    </View>
                    {isSelected ? <View style={styles.pickerDot} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Database Info Modal */}
      <Modal
        visible={dbStatsModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDbStatsModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Database Info</Text>
              <Pressable onPress={() => setDbStatsModalVisible(false)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalDescription}>
              All Spendly records are stored locally on your device in SQLite (WAL mode).
            </Text>
            {dbStats ? (
              <View style={styles.statsGrid}>
                {[
                  { label: 'Transactions', value: dbStats.transactions },
                  { label: 'Wallets', value: dbStats.wallets },
                  { label: 'Categories', value: dbStats.categories },
                  { label: 'Budgets', value: dbStats.budgets },
                  { label: 'Recurring', value: dbStats.recurring },
                  { label: 'Backups Logged', value: dbStats.backups },
                ].map((row) => (
                  <View key={row.label} style={styles.dbStatRow}>
                    <Text style={styles.dbStatLabel}>{row.label}</Text>
                    <Text style={styles.dbStatValue}>{row.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
            <Button
              title="Close"
              variant="primary"
              onPress={() => setDbStatsModalVisible(false)}
              style={{ marginTop: Spacing.sm }}
            />
          </View>
        </View>
      </Modal>

      {/* Clear All Data Confirmation Modal */}
      <Modal
        visible={deleteModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setDeleteModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: Colors.expense }]}>
                Clear All Data
              </Text>
              <Pressable onPress={() => setDeleteModalVisible(false)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalDescription}>
              This will permanently erase all wallets, transactions, budgets, recurring payments,
              and settings. Consider creating a backup first. Type{' '}
              <Text style={{ fontWeight: '700', color: Colors.expense }}>DELETE</Text> below to
              confirm.
            </Text>
            <Input
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE"
              autoCapitalize="characters"
            />
            <View style={styles.modalActions}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setDeleteModalVisible(false)}
                fullWidth={false}
                style={styles.modalBtn}
              />
              <Button
                title="Erase All"
                variant="destructive"
                loading={isDeleting}
                disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                onPress={handleClearAllData}
                fullWidth={false}
                style={styles.modalBtn}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Open Source Licenses Modal */}
      <Modal
        visible={licensesModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLicensesModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Open Source Licenses</Text>
              <Pressable onPress={() => setLicensesModalVisible(false)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <View style={styles.statsGrid}>
              {OPEN_SOURCE_LICENSES.map((item) => (
                <View key={item.name} style={styles.dbStatRow}>
                  <Text style={styles.dbStatLabel}>{item.name}</Text>
                  <Text style={styles.licenseTag}>{item.license}</Text>
                </View>
              ))}
            </View>
            <Button
              title="Done"
              variant="primary"
              onPress={() => setLicensesModalVisible(false)}
              style={{ marginTop: Spacing.sm }}
            />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.textSecondary,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: Spacing.xl,
    marginBottom: Spacing.sm,
    marginLeft: 4,
  },
  sectionCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 22,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: 14,
    gap: 14,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4EF',
  },
  rowPressed: {
    opacity: 0.7,
  },
  rowIconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  rowLabelDestructive: {
    color: Colors.expense,
    fontWeight: '600',
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    maxWidth: '46%',
  },
  rowValue: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  expandableSubRow: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4EF',
    gap: Spacing.sm,
  },
  thresholdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  thresholdCaption: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  thresholdBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  thresholdTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: '#EDF1EC',
    overflow: 'hidden',
  },
  thresholdFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 3,
  },
  thresholdChips: {
    gap: Spacing.xs,
    paddingTop: 2,
  },
  thresholdChip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: 5,
    minHeight: 32,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.96 }],
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
  modalDescription: {
    fontSize: 14,
    lineHeight: 20,
    color: Colors.textSecondary,
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
  pickerList: {
    gap: 8,
  },
  pickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  pickerOptionSelected: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
  },
  pickerOptionTextWrap: {
    flex: 1,
  },
  pickerOptionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  pickerOptionLabelSelected: {
    color: Colors.primary,
    fontWeight: '700',
  },
  pickerOptionSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  pickerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.primary,
  },
  statsGrid: {
    gap: Spacing.sm,
    backgroundColor: '#F8FAF8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    padding: 14,
  },
  dbStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dbStatLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  dbStatValue: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  licenseTag: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.primary,
  },
});
