/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React from 'react';
import { Pressable, StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import {
  ArrowLeftRight,
  ArrowRight,
  Baby,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Camera,
  Car,
  Coffee,
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
  TrainFront,
  TrendingUp,
  Tv,
  Utensils,
  Watch,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { TransactionWithDetails } from '../../types/transaction.types';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currencyUtils';
import { formatRelative, formatTime } from '../../utils/dateUtils';

export interface TransactionCardProps {
  transaction: TransactionWithDetails;
  currencyCode?: string;
  numberFormat?: 'indian' | 'international';
  decimalPlaces?: number;
  hideBalance?: boolean;
  onPress?: (transaction: TransactionWithDetails) => void;
  showDivider?: boolean;
  style?: StyleProp<ViewStyle>;
}

const renderCategoryIcon = (
  iconName: string | undefined,
  type: TransactionWithDetails['type'],
  fallbackLabel: string
) => {
  const iconProps = { size: 20, color: Colors.textInverse, strokeWidth: 2 };

  if (type === 'transfer') {
    return <ArrowLeftRight {...iconProps} />;
  }

  switch (iconName) {
    case 'utensils':
      return <Utensils {...iconProps} />;
    case 'shopping-cart':
      return <ShoppingCart {...iconProps} />;
    case 'car':
      return <Car {...iconProps} />;
    case 'fuel':
      return <Fuel {...iconProps} />;
    case 'shopping-bag':
      return <ShoppingBag {...iconProps} />;
    case 'zap':
      return <Zap {...iconProps} />;
    case 'home':
      return <Home {...iconProps} />;
    case 'heart-pulse':
      return <HeartPulse {...iconProps} />;
    case 'book-open':
      return <BookOpen {...iconProps} />;
    case 'film':
      return <Film {...iconProps} />;
    case 'plane':
      return <Plane {...iconProps} />;
    case 'scissors':
      return <Scissors {...iconProps} />;
    case 'smartphone':
      return <Smartphone {...iconProps} />;
    case 'gift':
      return <Gift {...iconProps} />;
    case 'package':
      return <Package {...iconProps} />;
    case 'briefcase':
      return <Briefcase {...iconProps} />;
    case 'building-2':
      return <Building2 {...iconProps} />;
    case 'laptop':
      return <Laptop {...iconProps} />;
    case 'trending-up':
      return <TrendingUp {...iconProps} />;
    case 'repeat':
      return <Repeat {...iconProps} />;
    case 'coffee':
      return <Coffee {...iconProps} />;
    case 'music':
      return <Music {...iconProps} />;
    case 'gamepad-2':
      return <Gamepad2 {...iconProps} />;
    case 'dumbbell':
      return <Dumbbell {...iconProps} />;
    case 'baby':
      return <Baby {...iconProps} />;
    case 'wrench':
    case 'tool':
      return <Wrench {...iconProps} />;
    case 'shield':
      return <Shield {...iconProps} />;
    case 'graduation-cap':
      return <GraduationCap {...iconProps} />;
    case 'bus':
      return <Bus {...iconProps} />;
    case 'train':
      return <TrainFront {...iconProps} />;
    case 'bike':
      return <Bike {...iconProps} />;
    case 'pizza':
      return <Pizza {...iconProps} />;
    case 'shirt':
      return <Shirt {...iconProps} />;
    case 'watch':
      return <Watch {...iconProps} />;
    case 'camera':
      return <Camera {...iconProps} />;
    case 'tv':
      return <Tv {...iconProps} />;
    case 'wifi':
      return <Wifi {...iconProps} />;
    case 'printer':
      return <Printer {...iconProps} />;
    default: {
      const initial = (fallbackLabel || 'T').trim().charAt(0).toUpperCase() || 'T';
      return <Text style={styles.initialText}>{initial}</Text>;
    }
  }
};

export const TransactionCard: React.FC<TransactionCardProps> = ({
  transaction,
  currencyCode,
  numberFormat = 'indian',
  decimalPlaces = 2,
  hideBalance = false,
  onPress,
  showDivider = false,
  style,
}) => {
  const effectiveCurrency = transaction.currencyCode || currencyCode || 'INR';

  const displayTitle =
    transaction.title?.trim() ||
    transaction.categoryName ||
    (transaction.type === 'transfer' ? 'Transfer' : 'Transaction');

  const isLinkedWalletTransfer =
    transaction.type === 'transfer' &&
    Boolean(transaction.walletName) &&
    Boolean(transaction.destinationWalletName);

  const subtitleParts: string[] = [];
  if (transaction.type === 'transfer') {
    if (!isLinkedWalletTransfer) {
      if (transaction.walletName) {
        subtitleParts.push(`Transfer · ${transaction.walletName}`);
      } else {
        subtitleParts.push('Transfer');
      }
    }
  } else {
    if (transaction.categoryName) subtitleParts.push(transaction.categoryName);
    if (transaction.walletName) subtitleParts.push(transaction.walletName);
  }
  const metaLine = subtitleParts.join(' · ') || 'Uncategorized';

  const datePart = formatRelative(transaction.transactionDate);
  const timePart = formatTime(transaction.transactionDate);
  const timeLine = timePart ? `${datePart} · ${timePart}` : datePart;

  const badgeBg =
    transaction.type === 'transfer'
      ? Colors.secondary
      : transaction.categoryColor ||
        (transaction.type === 'income' ? Colors.primary : Colors.expense);

  const amountColor =
    transaction.type === 'income'
      ? Colors.primary
      : transaction.type === 'expense'
        ? Colors.expense
        : Colors.textSecondary;

  const baseFormatted = formatCurrency(
    transaction.amountMinor,
    effectiveCurrency,
    numberFormat,
    decimalPlaces
  );

  const formattedAmount = hideBalance
    ? '•••••'
    : transaction.type === 'income'
      ? `+${baseFormatted}`
      : transaction.type === 'expense'
        ? `-${baseFormatted}`
        : baseFormatted;

  const handlePress = () => {
    if (!onPress) return;
    Haptics.selectionAsync().catch(() => {});
    onPress(transaction);
  };

  return (
    <Pressable
      onPress={handlePress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${displayTitle}, ${formattedAmount}`}
      style={({ pressed }) => [
        styles.row,
        showDivider && styles.divider,
        pressed && onPress && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.avatar, { backgroundColor: badgeBg }]}>
        {renderCategoryIcon(
          transaction.categoryIcon,
          transaction.type,
          transaction.categoryName || displayTitle
        )}
      </View>

      <View style={styles.center}>
        <Text style={styles.title} numberOfLines={1}>
          {displayTitle}
        </Text>

        {isLinkedWalletTransfer ? (
          <View style={styles.transferMetaRow}>
            <Text style={styles.meta} numberOfLines={1}>
              {transaction.walletName}
            </Text>
            <ArrowRight size={11} color={Colors.textSecondary} strokeWidth={2.2} />
            <Text style={styles.meta} numberOfLines={1}>
              {transaction.destinationWalletName}
            </Text>
          </View>
        ) : (
          <Text style={styles.meta} numberOfLines={1}>
            {metaLine}
          </Text>
        )}

        <Text style={styles.time} numberOfLines={1}>
          {timeLine}
        </Text>
      </View>

      <View style={styles.right}>
        <View style={styles.amountRow}>
          {transaction.type === 'transfer' && !hideBalance ? (
            <ArrowLeftRight
              size={13}
              color={Colors.secondary}
              strokeWidth={2.2}
            />
          ) : null}
          <Text style={[styles.amount, { color: amountColor }]} numberOfLines={1}>
            {formattedAmount}
          </Text>
        </View>
      </View>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.md,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F4EF',
  },
  pressed: {
    opacity: 0.75,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  initialText: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textInverse,
    letterSpacing: -0.2,
  },
  center: {
    flex: 1,
    gap: 3,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
    letterSpacing: -0.1,
  },
  transferMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  meta: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.1,
    flexShrink: 1,
  },
  time: {
    fontSize: 11,
    fontWeight: '500',
    color: Colors.textDisabled,
    letterSpacing: 0.2,
  },
  right: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  amount: {
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.3,
  },
});
