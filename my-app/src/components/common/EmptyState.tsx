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
import { Inbox } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/shadows';
import { Spacing } from '../../theme/spacing';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  /** @deprecated Emojis are not rendered; pass a Lucide ReactNode via `icon` instead. */
  emoji?: string;
  heading: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  heading,
  subtitle,
  ctaLabel,
  onCtaPress,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.outerRing}>
        <View style={styles.innerCircle}>
          {icon ?? <Inbox size={26} color={Colors.primary} />}
        </View>
      </View>
      <Text style={styles.heading}>{heading}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <Button
          title={ctaLabel}
          onPress={onCtaPress}
          fullWidth={false}
          style={styles.cta}
        />
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing['3xl'],
    paddingHorizontal: Spacing['2xl'],
  },
  outerRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.lg,
  },
  innerCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.card,
  },
  heading: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.xs + 2,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 21,
    maxWidth: 280,
  },
  cta: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing['2xl'],
  },
});
