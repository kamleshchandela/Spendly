/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React from 'react';
import { Text, TextProps } from 'react-native';
import { Typography as TypographyStyles } from '../../theme/typography';
import { Colors } from '../../theme/colors';

export type TypographyVariant = keyof typeof TypographyStyles;

export interface AppTypographyProps extends TextProps {
  variant?: TypographyVariant;
  color?: string;
  align?: 'auto' | 'left' | 'right' | 'center' | 'justify';
  children: React.ReactNode;
}

export const Typography: React.FC<AppTypographyProps> = ({
  variant = 'bodyMd',
  color = Colors.textPrimary,
  align,
  style,
  children,
  ...rest
}) => {
  return (
    <Text
      style={[TypographyStyles[variant], { color }, align ? { textAlign: align } : undefined, style]}
      {...rest}
    >
      {children}
    </Text>
  );
};
