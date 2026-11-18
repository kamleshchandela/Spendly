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
  Banknote,
  CreditCard,
  Landmark,
  PiggyBank,
  Plus,
  Wallet as WalletIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { Wallet, WalletType } from '../../types/wallet.types';
import { Colors } from '../../theme/colors';
import { Shapes } from '../../theme/shapes';
import { Shadows } from '../../theme/shadows';
import { Spacing } from '../../theme/spacing';
import { formatCurrency } from '../../utils/currencyUtils';

export interface WalletCardProps {
  wallet: Wallet;
  balanceMinor: number;
  transactionCount?: number;
  hideBalance?: boolean;
  numberFormat?: 'indian' | 'international';
  decimalPlaces?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

const renderWalletTypeIcon = (type: WalletType) => {
  const props = { size: 15, color: Colors.textInverse, strokeWidth: 2 };
  switch (type) {
    case 'cash':
      return <Banknote {...props} />;
    case 'bank':
      return <Landmark {...props} />;
    case 'savings':
      return <PiggyBank {...props} />;
    case 'credit':
      return <CreditCard {...props} />;
    case 'other':
    default:
      return <WalletIcon {...props} />;
  }
};

export const WalletCard: React.FC<WalletCardProps> = ({
  wallet,
  balanceMinor,
  transactionCount = 0,
  hideBalance = false,
  numberFormat = 'indian',
  decimalPlaces = 2,
  onPress,
  style,
}) => {
  const handlePress = () => {
    if (!onPress) return;
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  const formattedBalance = hideBalance
    ? '•••••'
    : formatCurrency(balanceMinor, wallet.currencyCode, numberFormat, decimalPlaces);

  const txLabel =
    transactionCount === 1 ? '1 transaction' : `${transactionCount} transactions`;

  return (
    <Pressable
      onPress={handlePress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={`${wallet.name} wallet, balance ${formattedBalance}`}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: wallet.color || Colors.primary },
        pressed && onPress && styles.pressed,
        style,
      ]}
    >
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {wallet.name}
        </Text>
        <View style={styles.iconBadge}>{renderWalletTypeIcon(wallet.type)}</View>
      </View>

      <Text style={styles.balance} numberOfLines={1} adjustsFontSizeToFit>
        {formattedBalance}
      </Text>

      <Text style={styles.count} numberOfLines={1}>
        {txLabel}
      </Text>
    </Pressable>
  );
};

export interface AddWalletCardProps {
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
}

export const AddWalletCard: React.FC<AddWalletCardProps> = ({ onPress, style }) => {
  const handlePress = () => {
    Haptics.selectionAsync().catch(() => {});
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      accessibilityRole="button"
      accessibilityLabel="Add Wallet"
      style={({ pressed }) => [
        styles.addCard,
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={styles.addIconCircle}>
        <Plus size={22} color={Colors.primary} strokeWidth={2.2} />
      </View>
      <Text style={styles.addCardText}>Add Wallet</Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  card: {
    width: 170,
    height: 104,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    justifyContent: 'space-between',
    ...Shadows.card,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.xs,
  },
  name: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textInverse,
    letterSpacing: 0.2,
  },
  iconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  balance: {
    fontSize: 20,
    fontWeight: '800',
    color: Colors.textInverse,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  count: {
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.85)',
    letterSpacing: 0.2,
  },
  addCard: {
    width: 140,
    height: 104,
    borderRadius: 18,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.primary,
    backgroundColor: '#FAFDFB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
  },
  addIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addCardText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
    letterSpacing: 0.1,
  },
  pressed: {
    opacity: 0.88,
    transform: [{ scale: 0.97 }],
  },
});
