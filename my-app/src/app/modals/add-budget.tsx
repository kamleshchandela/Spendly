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
  KeyboardAvoidingView,
  LayoutChangeEvent,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '../../components/common/CustomAlert';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  addMonths,
  endOfDay,
  endOfMonth,
  getDay,
  getDaysInMonth,
  startOfDay,
  startOfMonth,
  subMonths,
} from 'date-fns';
import {
  Baby,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Calendar,
  Camera,
  Car,
  Check,
  ChevronLeft,
  ChevronRight,
  Coffee,
  Dog,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Music,
  Package,
  Pizza,
  Plane,
  Printer,
  Repeat,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sprout,
  Train,
  TrendingUp,
  Tv,
  Utensils,
  Watch,
  Wifi,
  Wrench,
  X,
  Zap,
} from 'lucide-react-native';
import { Colors, Shapes, Shadows, Spacing } from '../../theme';
import { BudgetPeriodType, InsertBudget } from '../../types/budget.types';
import { Category } from '../../types/category.types';
import { getDatabase } from '../../database/database';
import { BudgetRepository } from '../../database/repositories/BudgetRepository';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { useBudgetStore } from '../../store/budgetStore';
import { useSettingsStore } from '../../store/settingsStore';
import {
  fromMinorUnits,
  getCurrencySymbol,
  parseCurrencyToMinor,
} from '../../utils/currencyUtils';
import { addDays, formatDisplay, isSameDay } from '../../utils/dateUtils';
import {
  validateAmount,
  validateBudgetDates,
  validateRequired,
} from '../../utils/validationUtils';
import {
  AmountInput,
  Button,
  Chip,
  Input,
  LoadingState,
  SoftSwitch,
} from '../../components/common';

const PERIOD_OPTIONS: Array<{ key: BudgetPeriodType; label: string }> = [
  { key: 'weekly', label: 'Weekly' },
  { key: 'monthly', label: 'Monthly' },
  { key: 'yearly', label: 'Yearly' },
  { key: 'custom', label: 'Custom' },
];

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const THRESHOLD_MIN = 50;
const THRESHOLD_MAX = 95;
const THRESHOLD_STEP = 5;

const ICON_MAP: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  utensils: Utensils,
  'shopping-cart': ShoppingCart,
  car: Car,
  fuel: Fuel,
  'shopping-bag': ShoppingBag,
  zap: Zap,
  home: Home,
  'heart-pulse': HeartPulse,
  'book-open': BookOpen,
  film: Film,
  plane: Plane,
  scissors: Scissors,
  smartphone: Smartphone,
  gift: Gift,
  package: Package,
  briefcase: Briefcase,
  'building-2': Building2,
  laptop: Laptop,
  'trending-up': TrendingUp,
  repeat: Repeat,
  coffee: Coffee,
  music: Music,
  'gamepad-2': Gamepad2,
  dumbbell: Dumbbell,
  baby: Baby,
  dog: Dog,
  plant: Sprout,
  wrench: Wrench,
  shield: Shield,
  'graduation-cap': GraduationCap,
  bus: Bus,
  train: Train,
  bike: Bike,
  pizza: Pizza,
  beer: Beer,
  shirt: Shirt,
  watch: Watch,
  camera: Camera,
  tv: Tv,
  wifi: Wifi,
  printer: Printer,
  tool: Wrench,
};

function CategoryIcon({
  iconName,
  size = 18,
  color = Colors.textPrimary,
}: {
  iconName?: string;
  size?: number;
  color?: string;
}) {
  const IconComp = (iconName && ICON_MAP[iconName]) || Package;
  return <IconComp size={size} color={color} />;
}

function calculateAutoEndDate(start: Date, periodType: BudgetPeriodType): Date {
  const normalizedStart = startOfDay(start);
  switch (periodType) {
    case 'weekly':
      return endOfDay(addDays(normalizedStart, 7));
    case 'monthly':
      if (normalizedStart.getDate() === 1) {
        return endOfDay(endOfMonth(normalizedStart));
      }
      return endOfDay(addDays(normalizedStart, 30));
    case 'yearly':
      return endOfDay(addDays(normalizedStart, 365));
    case 'custom':
    default:
      return endOfDay(addDays(normalizedStart, 30));
  }
}

function clampThreshold(val: number): number {
  const snapped = Math.round(val / THRESHOLD_STEP) * THRESHOLD_STEP;
  return Math.max(THRESHOLD_MIN, Math.min(THRESHOLD_MAX, snapped));
}

interface ThresholdSliderProps {
  value: number;
  onChange: (next: number) => void;
}

const ThresholdSlider: React.FC<ThresholdSliderProps> = ({ value, onChange }) => {
  const trackWidthRef = useRef(1);
  const startXRef = useRef(0);
  const lastValueRef = useRef(value);
  lastValueRef.current = value;

  const updateFromX = useCallback(
    (localX: number) => {
      const clampedX = Math.max(0, Math.min(trackWidthRef.current, localX));
      const ratio = trackWidthRef.current > 0 ? clampedX / trackWidthRef.current : 0;
      const raw = THRESHOLD_MIN + ratio * (THRESHOLD_MAX - THRESHOLD_MIN);
      const next = clampThreshold(raw);
      if (next !== lastValueRef.current) {
        Haptics.selectionAsync().catch(() => {});
        onChange(next);
      }
    },
    [onChange]
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => {
          const x = evt.nativeEvent.locationX;
          startXRef.current = x;
          updateFromX(x);
        },
        onPanResponderMove: (_evt, gestureState) => {
          updateFromX(startXRef.current + gestureState.dx);
        },
      }),
    [updateFromX]
  );

  const handleLayout = (e: LayoutChangeEvent) => {
    trackWidthRef.current = Math.max(1, e.nativeEvent.layout.width);
  };

  const pct = ((value - THRESHOLD_MIN) / (THRESHOLD_MAX - THRESHOLD_MIN)) * 100;
  const activeColor = value >= 90 ? Colors.expense : value >= 70 ? Colors.warning : Colors.primary;

  return (
    <View style={sliderStyles.container}>
      <View
        onLayout={handleLayout}
        style={sliderStyles.touchArea}
        {...panResponder.panHandlers}
      >
        <View style={sliderStyles.track} pointerEvents="none">
          <View
            style={[
              sliderStyles.fill,
              { width: `${pct}%`, backgroundColor: activeColor },
            ]}
          />
        </View>
        <View
          pointerEvents="none"
          style={[
            sliderStyles.thumb,
            {
              left: `${pct}%`,
              borderColor: activeColor,
            },
          ]}
        />
      </View>

      <View style={sliderStyles.markersRow}>
        {[50, 65, 80, 95].map((mark) => (
          <Pressable
            key={mark}
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onChange(mark);
            }}
            hitSlop={8}
          >
            <Text
              style={[
                sliderStyles.markerText,
                value === mark && { color: activeColor, fontWeight: '700' },
              ]}
            >
              {mark}%
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};

interface DatePickerModalProps {
  visible: boolean;
  title: string;
  selectedDate: Date;
  minDate?: Date;
  onSelect: (date: Date) => void;
  onClose: () => void;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  title,
  selectedDate,
  minDate,
  onSelect,
  onClose,
}) => {
  const [viewingMonth, setViewingMonth] = useState<Date>(() => startOfMonth(selectedDate));

  useEffect(() => {
    if (visible) {
      setViewingMonth(startOfMonth(selectedDate));
    }
  }, [visible, selectedDate]);

  const calendarCells = useMemo(() => {
    const year = viewingMonth.getFullYear();
    const month = viewingMonth.getMonth();
    const firstWeekday = getDay(new Date(year, month, 1));
    const totalDays = getDaysInMonth(viewingMonth);

    const cells: Array<Date | null> = [];
    for (let i = 0; i < firstWeekday; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= totalDays; d++) {
      cells.push(new Date(year, month, d));
    }
    while (cells.length % 7 !== 0) {
      cells.push(null);
    }
    return cells;
  }, [viewingMonth]);

  const minDay = minDate ? startOfDay(minDate) : null;
  const today = startOfDay(new Date());

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={calendarStyles.backdrop} onPress={onClose}>
        <Pressable style={calendarStyles.sheet} onPress={() => {}}>
          <View style={calendarStyles.header}>
            <Text style={calendarStyles.title}>{title}</Text>
            <Pressable
              onPress={onClose}
              style={calendarStyles.closeBtn}
              accessibilityLabel="Close date picker"
            >
              <X size={20} color={Colors.textSecondary} />
            </Pressable>
          </View>

          <View style={calendarStyles.monthNav}>
            <Pressable
              onPress={() => setViewingMonth((m) => subMonths(m, 1))}
              style={calendarStyles.navBtn}
              accessibilityLabel="Previous month"
            >
              <ChevronLeft size={20} color={Colors.textPrimary} />
            </Pressable>
            <Text style={calendarStyles.monthLabel}>
              {formatDisplay(viewingMonth, 'MMMM yyyy')}
            </Text>
            <Pressable
              onPress={() => setViewingMonth((m) => addMonths(m, 1))}
              style={calendarStyles.navBtn}
              accessibilityLabel="Next month"
            >
              <ChevronRight size={20} color={Colors.textPrimary} />
            </Pressable>
          </View>

          <View style={calendarStyles.weekdaysRow}>
            {WEEKDAYS.map((wd) => (
              <Text key={wd} style={calendarStyles.weekdayText}>
                {wd}
              </Text>
            ))}
          </View>

          <View style={calendarStyles.daysGrid}>
            {calendarCells.map((cellDate, idx) => {
              if (!cellDate) {
                return <View key={`empty-${idx}`} style={calendarStyles.dayCell} />;
              }
              const isSelected = isSameDay(cellDate, selectedDate);
              const isTodayCell = isSameDay(cellDate, today);
              const isDisabled = minDay ? startOfDay(cellDate) < minDay : false;

              return (
                <Pressable
                  key={cellDate.toISOString()}
                  disabled={isDisabled}
                  onPress={() => {
                    Haptics.selectionAsync().catch(() => {});
                    onSelect(cellDate);
                    onClose();
                  }}
                  style={calendarStyles.dayCell}
                >
                  <View
                    style={[
                      calendarStyles.dayBadge,
                      isSelected && calendarStyles.dayBadgeSelected,
                      !isSelected && isTodayCell && calendarStyles.dayBadgeToday,
                    ]}
                  >
                    <Text
                      style={[
                        calendarStyles.dayText,
                        isSelected && calendarStyles.dayTextSelected,
                        !isSelected && isTodayCell && { color: Colors.primary, fontWeight: '700' },
                        isDisabled && calendarStyles.dayTextDisabled,
                      ]}
                    >
                      {cellDate.getDate()}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <Pressable
            onPress={() => {
              const target = minDay && today < minDay ? minDay : today;
              Haptics.selectionAsync().catch(() => {});
              onSelect(target);
              onClose();
            }}
            style={calendarStyles.todayBtn}
          >
            <Text style={calendarStyles.todayBtnText}>Select Today</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

export default function AddBudgetModalScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditMode = Boolean(id);
  const router = useRouter();
  const { settings } = useSettingsStore();
  const { loadBudgets } = useBudgetStore();
  const insets = useSafeAreaInsets();
  const footerBottomPadding = Math.max(insets.bottom, Platform.OS === 'android' ? 16 : 10) + 10;

  const baseCurrency = settings?.baseCurrency ?? 'INR';
  const defaultThreshold = clampThreshold(settings?.budgetWarningThreshold ?? 80);

  const [name, setName] = useState('');
  const [amountStr, setAmountStr] = useState('0');
  const [periodType, setPeriodType] = useState<BudgetPeriodType>('monthly');
  const [startDate, setStartDate] = useState<Date>(() => startOfDay(startOfMonth(new Date())));
  const [autoEndDate, setAutoEndDate] = useState(true);
  const [endDate, setEndDate] = useState<Date>(() =>
    calculateAutoEndDate(startOfMonth(new Date()), 'monthly')
  );
  const [applyToAllCats, setApplyToAllCats] = useState(true);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([]);
  const [warningThresholdPct, setWarningThresholdPct] = useState<number>(defaultThreshold);

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [amountModalVisible, setAmountModalVisible] = useState(false);
  const [datePickerTarget, setDatePickerTarget] = useState<'start' | 'end' | null>(null);

  const [errors, setErrors] = useState<{
    name?: string | null;
    amount?: string | null;
    dates?: string | null;
    categories?: string | null;
  }>({});

  // Load categories & existing budget if editing
  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const db = await getDatabase();
        const catRepo = new CategoryRepository(db);
        const expenseCats = await catRepo.getAll('expense', false);
        if (!mounted) return;
        setCategories(expenseCats);

        if (id) {
          const budgetRepo = new BudgetRepository(db);
          const existing = await budgetRepo.getById(id);
          if (existing && mounted) {
            setName(existing.name);
            const major = fromMinorUnits(existing.amountMinor);
            setAmountStr(major % 1 === 0 ? String(major) : major.toFixed(2));
            setPeriodType(existing.periodType);
            setStartDate(startOfDay(new Date(existing.startDate)));
            setEndDate(endOfDay(new Date(existing.endDate)));
            setAutoEndDate(false);
            setApplyToAllCats(existing.applyToAllCats);
            setSelectedCategoryIds(existing.categoryIds);
            const normalizedThresh =
              existing.warningThreshold <= 1
                ? existing.warningThreshold * 100
                : existing.warningThreshold;
            setWarningThresholdPct(clampThreshold(normalizedThresh));
          }
        }
      } catch (error) {
        console.error('Failed to initialize add-budget modal:', error);
      } finally {
        if (mounted) setIsLoading(false);
      }
    };
    init();
    return () => {
      mounted = false;
    };
  }, [id]);

  // Keep endDate auto-calculated when autoEndDate is ON
  useEffect(() => {
    if (autoEndDate && periodType !== 'custom') {
      setEndDate(calculateAutoEndDate(startDate, periodType));
    }
  }, [startDate, periodType, autoEndDate]);

  const handleSelectPeriod = (nextPeriod: BudgetPeriodType) => {
    Haptics.selectionAsync().catch(() => {});
    setPeriodType(nextPeriod);
    if (nextPeriod === 'custom') {
      setAutoEndDate(false);
    } else if (autoEndDate) {
      setEndDate(calculateAutoEndDate(startDate, nextPeriod));
    }
  };

  const handleToggleAutoEnd = (enabled: boolean) => {
    Haptics.selectionAsync().catch(() => {});
    setAutoEndDate(enabled);
    if (enabled) {
      if (periodType === 'custom') {
        setPeriodType('monthly');
        setEndDate(calculateAutoEndDate(startDate, 'monthly'));
      } else {
        setEndDate(calculateAutoEndDate(startDate, periodType));
      }
    }
  };

  const handleToggleCategory = (catId: string) => {
    Haptics.selectionAsync().catch(() => {});
    setSelectedCategoryIds((prev) =>
      prev.includes(catId) ? prev.filter((item) => item !== catId) : [...prev, catId]
    );
    setErrors((prev) => ({ ...prev, categories: null }));
  };

  const handleSave = async () => {
    const amountMinor = parseCurrencyToMinor(amountStr);
    const majorAmount = fromMinorUnits(amountMinor);
    const startIso = startOfDay(startDate).toISOString();
    const endIso = endOfDay(endDate).toISOString();

    const nameError = validateRequired(name, 'Budget name');
    const amountError = validateAmount(majorAmount);
    const datesError = validateBudgetDates(startIso, endIso);
    const categoriesError =
      !applyToAllCats && selectedCategoryIds.length === 0
        ? 'Select at least one category or enable All categories'
        : null;

    setErrors({
      name: nameError,
      amount: amountError,
      dates: datesError,
      categories: categoriesError,
    });

    if (nameError || amountError || datesError || categoriesError) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
      return;
    }

    setIsSaving(true);
    try {
      const db = await getDatabase();
      const repo = new BudgetRepository(db);

      const payload: InsertBudget = {
        name: name.trim(),
        amountMinor,
        currencyCode: baseCurrency,
        periodType,
        recurrence: periodType === 'custom' ? 'once' : 'recurring',
        startDate: startIso,
        endDate: endIso,
        warningThreshold: Number((warningThresholdPct / 100).toFixed(2)),
        applyToAllCats,
        isActive: true,
      };

      const catsToSave = applyToAllCats ? [] : selectedCategoryIds;

      if (isEditMode && id) {
        const updated = await repo.update(id, payload, catsToSave);
        await loadBudgets();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        if (router.canGoBack()) {
          router.back();
        } else {
          router.replace(`/(tabs)/budgets/${updated.id}` as never);
        }
      } else {
        const created = await repo.insert(payload, catsToSave);
        await loadBudgets();
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        router.replace(`/(tabs)/budgets/${created.id}` as never);
      }
    } catch (error) {
      console.error('Failed to save budget:', error);
      Alert.alert('Save Failed', 'Could not save this budget. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const currencySymbol = getCurrencySymbol(baseCurrency);
  const hasEnteredAmount = parseCurrencyToMinor(amountStr) > 0;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            hitSlop={6}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <X size={20} color={Colors.textPrimary} />
          </Pressable>
          <Text style={styles.headerTitle}>{isEditMode ? 'Edit Budget' : 'New Budget'}</Text>
          <View style={styles.headerSpacer} />
        </View>
        <LoadingState />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* HEADER */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={6}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Close"
        >
          <X size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>{isEditMode ? 'Edit Budget' : 'New Budget'}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* 1. BUDGET NAME */}
          <View style={styles.card}>
            <Input
              label="Budget Name"
              placeholder="e.g., Monthly Groceries"
              value={name}
              onChangeText={(text) => {
                setName(text);
                if (errors.name) setErrors((prev) => ({ ...prev, name: null }));
              }}
              error={errors.name}
              maxLength={40}
              returnKeyType="done"
            />
          </View>

          {/* 2. BUDGET AMOUNT */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Budget Amount</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setAmountModalVisible(true);
              }}
              accessibilityRole="button"
              accessibilityLabel="Enter budget amount"
              style={({ pressed }) => [
                styles.amountBox,
                errors.amount ? styles.amountBoxError : null,
                pressed && styles.amountBoxPressed,
              ]}
            >
              <Text style={styles.amountCurrency}>{currencySymbol}</Text>
              <Text
                style={[
                  styles.amountValue,
                  !hasEnteredAmount && styles.amountValuePlaceholder,
                ]}
                numberOfLines={1}
                adjustsFontSizeToFit
              >
                {amountStr === '' ? '0' : amountStr}
              </Text>
            </Pressable>
            <Text style={styles.fieldHint}>Tap above to enter amount</Text>
            {errors.amount ? <Text style={styles.errorText}>{errors.amount}</Text> : null}
          </View>

          {/* 3. PERIOD TYPE */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Period Type</Text>
            <View style={styles.periodChipsRow}>
              {PERIOD_OPTIONS.map((opt) => (
                <Chip
                  key={opt.key}
                  label={opt.label}
                  active={periodType === opt.key}
                  onPress={() => handleSelectPeriod(opt.key)}
                />
              ))}
            </View>
          </View>

          {/* 4 & 5. START DATE & END DATE */}
          <View style={styles.card}>
            <Text style={styles.fieldLabel}>Start Date</Text>
            <Pressable
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setDatePickerTarget('start');
              }}
              style={({ pressed }) => [styles.dateRowButton, pressed && styles.pressed]}
              accessibilityRole="button"
            >
              <View style={styles.dateRowLeft}>
                <View style={styles.dateIconWrap}>
                  <Calendar size={16} color={Colors.primary} />
                </View>
                <Text style={styles.dateValueText}>
                  {formatDisplay(startDate, 'dd MMM yyyy')}
                </Text>
              </View>
              <ChevronRight size={18} color={Colors.textSecondary} />
            </Pressable>

            <View style={styles.divider} />

            <View style={styles.toggleRow}>
              <View style={styles.toggleLabelWrap}>
                <Text style={styles.fieldLabelNoMargin}>End Date</Text>
                <Text style={styles.toggleSubLabel}>
                  {autoEndDate ? 'Auto-calculated from period' : 'Manual selection'}
                </Text>
              </View>
              <View style={styles.autoSwitchWrap}>
                <Text style={styles.autoSwitchLabel}>Auto</Text>
                <SoftSwitch
                  value={autoEndDate}
                  onValueChange={handleToggleAutoEnd}
                  accessibilityLabel="Auto end date"
                />
              </View>
            </View>

            <Pressable
              disabled={autoEndDate}
              onPress={() => {
                Haptics.selectionAsync().catch(() => {});
                setDatePickerTarget('end');
              }}
              style={({ pressed }) => [
                styles.dateRowButton,
                autoEndDate && styles.dateRowDisabled,
                !autoEndDate && pressed && styles.pressed,
              ]}
              accessibilityRole="button"
            >
              <View style={styles.dateRowLeft}>
                <View
                  style={[
                    styles.dateIconWrap,
                    autoEndDate && { backgroundColor: Colors.border },
                  ]}
                >
                  <Calendar
                    size={16}
                    color={autoEndDate ? Colors.textDisabled : Colors.primary}
                  />
                </View>
                <Text
                  style={[
                    styles.dateValueText,
                    autoEndDate && { color: Colors.textSecondary },
                  ]}
                >
                  {formatDisplay(endDate, 'dd MMM yyyy')}
                </Text>
              </View>
              {!autoEndDate && <ChevronRight size={18} color={Colors.textSecondary} />}
            </Pressable>

            {errors.dates ? <Text style={styles.errorText}>{errors.dates}</Text> : null}
          </View>

          {/* 6. APPLY TO CATEGORIES */}
          <View style={styles.card}>
            <View style={styles.toggleRow}>
              <View style={styles.toggleLabelWrap}>
                <Text style={styles.fieldLabelNoMargin}>All categories</Text>
                <Text style={styles.toggleSubLabel}>
                  {applyToAllCats
                    ? 'Tracks all expense categories'
                    : `${selectedCategoryIds.length} selected`}
                </Text>
              </View>
              <SoftSwitch
                value={applyToAllCats}
                onValueChange={(val) => {
                  setApplyToAllCats(val);
                  if (val) setErrors((prev) => ({ ...prev, categories: null }));
                }}
                accessibilityLabel="Apply to all categories"
              />
            </View>

            {!applyToAllCats && (
              <View style={styles.categoriesGrid}>
                {categories.map((cat) => {
                  const isSelected = selectedCategoryIds.includes(cat.id);
                  return (
                    <Pressable
                      key={cat.id}
                      onPress={() => handleToggleCategory(cat.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: isSelected }}
                      style={[
                        styles.catTile,
                        isSelected && {
                          borderColor: Colors.primary,
                          backgroundColor: Colors.primarySoft,
                        },
                      ]}
                    >
                      {isSelected && (
                        <View style={styles.catCheckBadge}>
                          <Check size={10} color={Colors.textInverse} strokeWidth={3} />
                        </View>
                      )}
                      <View
                        style={[
                          styles.catIconCircle,
                          { backgroundColor: `${cat.color}20` },
                        ]}
                      >
                        <CategoryIcon iconName={cat.iconName} size={18} color={cat.color} />
                      </View>
                      <Text
                        style={[
                          styles.catTileName,
                          isSelected && { color: Colors.textPrimary, fontWeight: '600' },
                        ]}
                        numberOfLines={2}
                      >
                        {cat.name}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}

            {errors.categories ? (
              <Text style={styles.errorText}>{errors.categories}</Text>
            ) : null}
          </View>

          {/* 7. WARNING THRESHOLD */}
          <View style={styles.card}>
            <View style={styles.thresholdHeader}>
              <View>
                <Text style={styles.fieldLabelNoMargin}>Warning Threshold</Text>
                <Text style={styles.toggleSubLabel}>Alert when spending reaches this level</Text>
              </View>
              <View style={styles.thresholdValuePill}>
                <Text style={styles.thresholdValueText}>{warningThresholdPct}%</Text>
              </View>
            </View>

            <ThresholdSlider
              value={warningThresholdPct}
              onChange={setWarningThresholdPct}
            />
          </View>
        </ScrollView>

        {/* STICKY FOOTER CTA */}
        <View style={[styles.footer, { paddingBottom: footerBottomPadding }]}>
          <Button
            title={isEditMode ? 'Update Budget' : 'Save Budget'}
            onPress={handleSave}
            loading={isSaving}
          />
        </View>
      </KeyboardAvoidingView>

      {/* AMOUNT ENTRY MODAL */}
      <Modal
        visible={amountModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setAmountModalVisible(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => setAmountModalVisible(false)}
        >
          <Pressable style={styles.amountModalSheet} onPress={() => {}}>
            <View style={styles.sheetHandle} />
            <View style={styles.amountModalHeader}>
              <Text style={styles.amountModalTitle}>Enter Budget Amount</Text>
              <Pressable
                onPress={() => setAmountModalVisible(false)}
                style={styles.amountDoneBtn}
              >
                <Text style={styles.amountDoneText}>Done</Text>
              </Pressable>
            </View>
            <AmountInput
              value={amountStr}
              onChange={(next) => {
                setAmountStr(next);
                if (errors.amount) setErrors((prev) => ({ ...prev, amount: null }));
              }}
              currencyCode={baseCurrency}
              accentColor={Colors.primary}
            />
            <View style={styles.amountModalFooter}>
              <Button
                title="Confirm Amount"
                onPress={() => setAmountModalVisible(false)}
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* CALENDAR DATE PICKER MODAL */}
      <DatePickerModal
        visible={datePickerTarget !== null}
        title={datePickerTarget === 'start' ? 'Select Start Date' : 'Select End Date'}
        selectedDate={datePickerTarget === 'end' ? endDate : startDate}
        minDate={datePickerTarget === 'end' ? addDays(startOfDay(startDate), 1) : undefined}
        onSelect={(picked) => {
          if (datePickerTarget === 'start') {
            setStartDate(startOfDay(picked));
            if (!autoEndDate && endOfDay(endDate) <= startOfDay(picked)) {
              setEndDate(calculateAutoEndDate(picked, periodType));
            }
          } else if (datePickerTarget === 'end') {
            setEndDate(endOfDay(picked));
          }
          if (errors.dates) setErrors((prev) => ({ ...prev, dates: null }));
        }}
        onClose={() => setDatePickerTarget(null)}
      />
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
    paddingVertical: Spacing.sm,
  },
  closeButton: {
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
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
    height: 42,
  },
  pressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }],
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 90,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.sm,
  },
  fieldLabelNoMargin: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  fieldHint: {
    fontSize: 12,
    color: Colors.textDisabled,
    marginTop: Spacing.xs + 2,
    textAlign: 'center',
  },
  errorText: {
    fontSize: 12,
    color: Colors.expense,
    marginTop: Spacing.xs + 2,
  },
  amountBox: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    backgroundColor: '#F8FAF8',
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingVertical: 18,
    paddingHorizontal: Spacing.lg,
    gap: 6,
  },
  amountBoxError: {
    borderColor: Colors.expense,
  },
  amountBoxPressed: {
    borderColor: '#C6E8D5',
    backgroundColor: '#E5F4EC',
  },
  amountCurrency: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: -0.5,
  },
  amountValue: {
    fontSize: 40,
    fontWeight: '800',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  amountValuePlaceholder: {
    color: Colors.textDisabled,
  },
  periodChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  dateRowButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F8FAF8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingHorizontal: 14,
    minHeight: 50,
    marginTop: Spacing.xs,
  },
  dateRowDisabled: {
    opacity: 0.75,
  },
  dateRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  dateIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#E5F4EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateValueText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F4EF',
    marginVertical: Spacing.md,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
  },
  toggleLabelWrap: {
    flex: 1,
  },
  toggleSubLabel: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  autoSwitchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  autoSwitchLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: Spacing.md,
    marginHorizontal: -4,
  },
  catTile: {
    width: '23%',
    margin: '1%',
    backgroundColor: '#F8FAF8',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingVertical: 12,
    paddingHorizontal: Spacing.xs,
    alignItems: 'center',
    position: 'relative',
  },
  catCheckBadge: {
    position: 'absolute',
    top: 5,
    right: 5,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
  catIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  catTileName: {
    fontSize: 11,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 14,
  },
  thresholdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  thresholdValuePill: {
    backgroundColor: Colors.warningSoft,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#F8DFBE',
  },
  thresholdValueText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.warning,
    fontVariant: ['tabular-nums'],
  },
  footer: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: 14,
    backgroundColor: Colors.bgMain,
    borderTopWidth: 1,
    borderTopColor: '#EDF2EC',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(20, 32, 25, 0.45)',
    justifyContent: 'flex-end',
  },
  amountModalSheet: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingTop: 14,
    paddingBottom: 36,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    ...Shadows.bottomSheet,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
    alignSelf: 'center',
    marginBottom: Spacing.md,
  },
  amountModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.xs,
  },
  amountModalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  amountDoneBtn: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  amountDoneText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.primary,
  },
  amountModalFooter: {
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.lg,
  },
});

const sliderStyles = StyleSheet.create({
  container: {
    paddingTop: Spacing.xs,
  },
  touchArea: {
    height: 40,
    justifyContent: 'center',
    position: 'relative',
  },
  track: {
    height: 8,
    borderRadius: 4,
    backgroundColor: '#EDF1EC',
    overflow: 'hidden',
  },
  fill: {
    height: 8,
    borderRadius: 4,
  },
  thumb: {
    position: 'absolute',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.bgCard,
    borderWidth: 3,
    marginLeft: -12,
    top: 8,
    ...Shadows.card,
  },
  markersRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.xs,
  },
  markerText: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});

const calendarStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(30, 43, 37, 0.35)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  sheet: {
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  closeBtn: {
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
  navBtn: {
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
  weekdaysRow: {
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
  dayTextSelected: {
    color: Colors.textInverse,
    fontWeight: '700',
  },
  dayTextDisabled: {
    color: Colors.textDisabled,
    fontWeight: '400',
  },
  todayBtn: {
    marginTop: Spacing.md,
    height: 46,
    borderRadius: 16,
    backgroundColor: '#E5F4EC',
    borderWidth: 1,
    borderColor: '#C6E8D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  todayBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.primary,
  },
});
