/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { Shapes } from '../../theme/shapes';
import { Spacing } from '../../theme/spacing';

export type BadgeStatus = 'on-track' | 'warning' | 'over-budget';

export interface BadgeProps {
  status: BadgeStatus;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

const BADGE_CONFIG: Record<
  BadgeStatus,
  { bg: string; border: string; text: string; defaultLabel: string }
> = {
  'on-track': {
    bg: Colors.primarySoft,
    border: '#CBEAD9',
    text: Colors.primary,
    defaultLabel: 'On Track',
  },
  warning: {
    bg: Colors.warningSoft,
    border: '#F7DFBD',
    text: Colors.warning,
    defaultLabel: 'Near Limit',
  },
  'over-budget': {
    bg: Colors.expenseSoft,
    border: '#F4D2D2',
    text: Colors.expense,
    defaultLabel: 'Over Budget',
  },
};

export const Badge: React.FC<BadgeProps> = ({ status, label, style }) => {
  const config = BADGE_CONFIG[status];
  return (
    <View
      style={[
        styles.base,
        { backgroundColor: config.bg, borderColor: config.border },
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: config.text }]} />
      <Text style={[styles.label, { color: config.text }]}>
        {label ?? config.defaultLabel}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    borderRadius: Shapes.chipRadius,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: Spacing.xs,
    gap: 5,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
});
