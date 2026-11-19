/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import * as Haptics from 'expo-haptics';
import {
  ArrowLeftRight,
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
  Coffee,
  Dog,
  Dumbbell,
  FileText,
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
  Pencil,
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
  Tag,
  Train,
  Trash2,
  TrendingUp,
  Tv,
  Utensils,
  Wallet as WalletIcon,
  Watch,
  Wifi,
  Wrench,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { TransactionWithDetails } from '../../types/transaction.types';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { Shapes } from '../../theme/shapes';
import { formatCurrency } from '../../utils/currencyUtils';
import { formatDisplay, formatTime } from '../../utils/dateUtils';
import { useSettingsStore } from '../../store/settingsStore';

const ICON_MAP: Record<string, LucideIcon> = {
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

export interface CategoryIconProps {
  iconName?: string;
  size?: number;
  color?: string;
  isTransfer?: boolean;
  fallbackLabel?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  iconName,
  size = 20,
  color = Colors.textInverse,
  isTransfer = false,
  fallbackLabel,
}) => {
  if (isTransfer) {
    return <ArrowLeftRight size={size} color={color} strokeWidth={2.2} />;
  }

  const IconComponent = iconName ? ICON_MAP[iconName] : undefined;
  if (IconComponent) {
    return <IconComponent size={size} color={color} strokeWidth={2} />;
  }

  if (fallbackLabel && fallbackLabel.trim().length > 0) {
    return (
      <Text
        style={{
          color,
          fontSize: Math.max(12, Math.round(size * 0.8)),
          fontWeight: '700',
        }}
      >
        {fallbackLabel.trim()[0].toUpperCase()}
      </Text>
    );
  }

  return <Tag size={size} color={color} strokeWidth={2} />;
};

export interface TransactionDetailSheetProps {
  transaction: TransactionWithDetails | null;
  onClose: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export const TransactionDetailSheet: React.FC<TransactionDetailSheetProps> = ({
  transaction,
  onClose,
  onEdit,
  onDelete,
}) => {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['64%', '85%'], []);
  const { settings } = useSettingsStore();
  const insets = useSafeAreaInsets();
  const detailPaddingBottom = Math.max(insets.bottom, Platform.OS === 'android' ? 24 : 16) + 36;

  useEffect(() => {
    if (transaction) {
      sheetRef.current?.snapToIndex(0);
    } else {
      sheetRef.current?.close();
    }
  }, [transaction]);

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

  if (!transaction) {
    return null;
  }

  const isExpense = transaction.type === 'expense';
  const isIncome = transaction.type === 'income';
  const isTransfer = transaction.type === 'transfer';

  const amountPrefix = isExpense ? '−' : isIncome ? '+' : '';
  const amountColor = isExpense
    ? Colors.expense
    : isIncome
      ? Colors.primary
      : Colors.secondary;

  const badgeBg = isExpense
    ? Colors.expenseSoft
    : isIncome
      ? Colors.primarySoft
      : Colors.secondarySoft;

  const badgeLabel = isExpense ? 'Expense' : isIncome ? 'Income' : 'Transfer';
  const iconBg = isTransfer
    ? Colors.secondary
    : transaction.categoryColor || Colors.primary;

  const formattedAmount = formatCurrency(
    transaction.amountMinor,
    transaction.currencyCode || settings?.baseCurrency || 'INR',
    settings?.numberFormat || 'indian',
    settings?.decimalPlaces ?? 2
  );

  const dateLabel = `${formatDisplay(transaction.transactionDate, 'dd MMM yyyy')} · ${formatTime(
    transaction.transactionDate
  )}`;

  const displayTitle =
    transaction.title?.trim() ||
    (isTransfer ? 'Wallet Transfer' : transaction.categoryName || 'Transaction');

  const handleEditPress = () => {
    if (settings?.hapticEnabled !== false) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    onEdit(transaction.id);
  };

  const handleDeletePress = () => {
    if (settings?.hapticEnabled !== false) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    onDelete(transaction.id);
  };

  return (
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
      <BottomSheetScrollView
        contentContainerStyle={[styles.contentContainer, { paddingBottom: detailPaddingBottom }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Top bar with close button */}
        <View style={styles.topBar}>
          <Text style={styles.sheetTitle}>Transaction Details</Text>
          <Pressable
            onPress={onClose}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="Close transaction details"
          >
            <X size={20} color={Colors.textSecondary} />
          </Pressable>
        </View>

        {/* Hero section */}
        <View style={styles.heroSection}>
          <View style={[styles.largeIconCircle, { backgroundColor: iconBg }]}>
            <CategoryIcon
              iconName={transaction.categoryIcon}
              size={28}
              color={Colors.textInverse}
              isTransfer={isTransfer}
              fallbackLabel={transaction.categoryName || displayTitle}
            />
          </View>

          <View style={styles.amountHeroRow}>
            {isTransfer && (
              <ArrowLeftRight size={24} color={Colors.secondary} strokeWidth={2.4} />
            )}
            <Text
              style={[styles.amountText, { color: amountColor }]}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {amountPrefix}
              {formattedAmount}
            </Text>
          </View>

          <View style={[styles.typeBadge, { backgroundColor: badgeBg }]}>
            {isTransfer && (
              <ArrowLeftRight size={12} color={amountColor} strokeWidth={2.2} />
            )}
            <Text style={[styles.typeBadgeText, { color: amountColor }]}>{badgeLabel}</Text>
          </View>

          <Text style={styles.transactionTitle}>{displayTitle}</Text>
        </View>

        {/* Details List */}
        <View style={styles.detailsCard}>
          {!isTransfer && (
            <View style={styles.detailRow}>
              <View style={styles.detailLabelGroup}>
                <Tag size={16} color={Colors.textSecondary} />
                <Text style={styles.detailLabel}>Category</Text>
              </View>
              <View style={styles.categoryValueRow}>
                <View
                  style={[
                    styles.categoryDot,
                    { backgroundColor: transaction.categoryColor || Colors.primary },
                  ]}
                />
                <Text style={styles.detailValue}>
                  {transaction.categoryName || 'Uncategorized'}
                </Text>
              </View>
            </View>
          )}

          {isTransfer ? (
            <>
              <View style={styles.detailRow}>
                <View style={styles.detailLabelGroup}>
                  <WalletIcon size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailLabel}>From Wallet</Text>
                </View>
                <Text style={styles.detailValue}>{transaction.walletName || 'Unknown'}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.detailRow}>
                <View style={styles.detailLabelGroup}>
                  <ArrowLeftRight size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailLabel}>To Wallet</Text>
                </View>
                <Text style={styles.detailValue}>
                  {transaction.destinationWalletName || 'Unknown'}
                </Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <View style={styles.detailLabelGroup}>
                  <WalletIcon size={16} color={Colors.textSecondary} />
                  <Text style={styles.detailLabel}>Wallet</Text>
                </View>
                <Text style={styles.detailValue}>{transaction.walletName || 'Default Wallet'}</Text>
              </View>
            </>
          )}

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLabelGroup}>
              <Calendar size={16} color={Colors.textSecondary} />
              <Text style={styles.detailLabel}>Date & Time</Text>
            </View>
            <Text style={styles.detailValue}>{dateLabel}</Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.detailRow}>
            <View style={styles.detailLabelGroup}>
              <FileText size={16} color={Colors.textSecondary} />
              <Text style={styles.detailLabel}>Currency</Text>
            </View>
            <Text style={styles.detailValue}>
              {transaction.currencyCode || settings?.baseCurrency || 'INR'}
            </Text>
          </View>

          {transaction.note && transaction.note.trim().length > 0 ? (
            <>
              <View style={styles.divider} />
              <View style={styles.noteRow}>
                <Text style={styles.detailLabel}>Note</Text>
                <Text style={styles.noteText}>{transaction.note}</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Actions */}
        <View style={styles.actionsRow}>
          <Pressable
            onPress={handleEditPress}
            style={({ pressed }) => [
              styles.actionButton,
              styles.editButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Edit transaction"
          >
            <Pencil size={18} color={Colors.secondary} />
            <Text style={styles.editButtonText}>Edit</Text>
          </Pressable>

          <Pressable
            onPress={handleDeletePress}
            style={({ pressed }) => [
              styles.actionButton,
              styles.deleteButton,
              pressed && styles.buttonPressed,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Delete transaction"
          >
            <Trash2 size={18} color={Colors.expense} />
            <Text style={styles.deleteButtonText}>Delete</Text>
          </Pressable>
        </View>
      </BottomSheetScrollView>
    </BottomSheet>
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
  contentContainer: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  largeIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  amountHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  amountText: {
    fontSize: 32,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Shapes.chipRadius,
    marginBottom: Spacing.sm,
  },
  typeBadgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  transactionTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  detailsCard: {
    backgroundColor: '#F8FAF8',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xl,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  detailLabelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  detailLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
  },
  detailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    flexShrink: 1,
    textAlign: 'right',
    letterSpacing: -0.1,
  },
  categoryValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  divider: {
    height: 1,
    backgroundColor: '#EDF2EC',
  },
  noteRow: {
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
  },
  noteText: {
    fontSize: 14,
    color: Colors.textPrimary,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  actionButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  editButton: {
    backgroundColor: '#EBF4FB',
    borderWidth: 1,
    borderColor: '#D4E8F8',
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.secondary,
    letterSpacing: 0.1,
  },
  deleteButton: {
    backgroundColor: '#FDF0ED',
    borderWidth: 1,
    borderColor: '#F9D8D0',
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.expense,
    letterSpacing: 0.1,
  },
  buttonPressed: {
    opacity: 0.8,
    transform: [{ scale: 0.98 }],
  },
});
