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
import * as Haptics from 'expo-haptics';
import { Delete } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/shadows';
import { Spacing } from '../../theme/spacing';
import { getCurrencySymbol } from '../../utils/currencyUtils';

export interface AmountInputProps {
  value: string;
  onChange: (nextValue: string) => void;
  currencyCode?: string;
  accentColor?: string;
  maxIntegerDigits?: number;
  maxDecimalDigits?: number;
  showKeypad?: boolean;
  style?: StyleProp<ViewStyle>;
}

const KEYPAD_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'backspace'],
] as const;

export const AmountInput: React.FC<AmountInputProps> = ({
  value,
  onChange,
  currencyCode = 'INR',
  accentColor = Colors.textPrimary,
  maxIntegerDigits = 9,
  maxDecimalDigits = 2,
  showKeypad = true,
  style,
}) => {
  const symbol = getCurrencySymbol(currencyCode);

  const handleKeyPress = (key: string) => {
    Haptics.selectionAsync().catch(() => {});

    if (key === 'backspace') {
      if (value.length <= 1) {
        onChange('0');
      } else {
        onChange(value.slice(0, -1));
      }
      return;
    }

    if (key === '.') {
      if (value.includes('.')) return;
      onChange((value || '0') + '.');
      return;
    }

    if (value === '0' || value === '') {
      onChange(key);
      return;
    }

    const parts = value.split('.');
    if (parts.length === 2) {
      if (parts[1].length >= maxDecimalDigits) return;
    } else if (parts[0].length >= maxIntegerDigits) {
      return;
    }

    onChange(value + key);
  };

  const handleLongBackspace = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    onChange('0');
  };

  const displayAmount = value && value.length > 0 ? value : '0';

  return (
    <View style={[styles.container, style]}>
      <View style={styles.displayRow}>
        <Text style={[styles.currencySymbol, { color: accentColor }]}>{symbol}</Text>
        <Text
          style={[styles.amountText, { color: accentColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {displayAmount}
        </Text>
      </View>

      {showKeypad && (
        <View style={styles.keypad}>
          {KEYPAD_ROWS.map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keypadRow}>
              {row.map((key) => {
                const isBackspace = key === 'backspace';
                return (
                  <Pressable
                    key={key}
                    onPress={() => handleKeyPress(key)}
                    onLongPress={isBackspace ? handleLongBackspace : undefined}
                    accessibilityRole="button"
                    accessibilityLabel={isBackspace ? 'Backspace' : key}
                    style={({ pressed }) => [
                      styles.keyButton,
                      pressed && styles.keyButtonPressed,
                    ]}
                  >
                    {isBackspace ? (
                      <Delete size={22} color={Colors.textPrimary} />
                    ) : (
                      <Text style={styles.keyText}>{key}</Text>
                    )}
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  displayRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    paddingVertical: Spacing.lg,
    paddingHorizontal: Spacing.lg,
    gap: 6,
  },
  currencySymbol: {
    fontSize: 28,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  amountText: {
    fontSize: 48,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
    letterSpacing: -1,
  },
  keypad: {
    gap: 10,
    paddingHorizontal: Spacing.md,
  },
  keypadRow: {
    flexDirection: 'row',
    gap: 10,
  },
  keyButton: {
    flex: 1,
    height: 56,
    borderRadius: 16,
    backgroundColor: '#F8FAF8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  keyButtonPressed: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
    transform: [{ scale: 0.96 }],
  },
  keyText: {
    fontSize: 22,
    fontWeight: '600',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
});
