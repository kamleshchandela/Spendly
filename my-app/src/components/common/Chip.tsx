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
import { Colors } from '../../theme/colors';
import { Shapes } from '../../theme/shapes';
import { Spacing } from '../../theme/spacing';

export interface ChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  activeColor?: string;
  activeSoftColor?: string;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export const Chip: React.FC<ChipProps> = ({
  label,
  active = false,
  onPress,
  activeColor = Colors.primary,
  activeSoftColor = Colors.primarySoft,
  icon,
  style,
}) => {
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.base,
        active
          ? { backgroundColor: activeSoftColor, borderColor: '#C6E8D5' }
          : styles.inactive,
        pressed && onPress && styles.pressed,
        style,
      ]}
    >
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <Text
        style={[
          styles.label,
          active ? { color: activeColor, fontWeight: '700' } : styles.labelInactive,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: Shapes.chipRadius,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    minHeight: 38,
    borderWidth: 1,
    gap: 6,
  },
  iconWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  inactive: {
    backgroundColor: Colors.bgCard,
    borderColor: '#EDF1EC',
  },
  pressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  label: {
    fontSize: 13,
    fontWeight: '500',
  },
  labelInactive: {
    color: Colors.textSecondary,
  },
});
