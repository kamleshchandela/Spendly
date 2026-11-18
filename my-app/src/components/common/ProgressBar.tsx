/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { Colors } from '../../theme/colors';
import { Shapes } from '../../theme/shapes';

export interface ProgressBarProps {
  /** Percentage value from 0 to 100+ */
  percentage: number;
  height?: number;
  trackColor?: string;
  colorOverride?: string;
  style?: StyleProp<ViewStyle>;
}

export const getProgressColor = (percentage: number): string => {
  if (percentage >= 90) return Colors.expense;
  if (percentage >= 70) return Colors.warning;
  return Colors.primary;
};

export const ProgressBar: React.FC<ProgressBarProps> = ({
  percentage,
  height = 8,
  trackColor = Colors.border,
  colorOverride,
  style,
}) => {
  const clamped = Math.max(0, Math.min(100, percentage));
  const animWidth = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(animWidth, {
      toValue: clamped,
      duration: 450,
      useNativeDriver: false,
    }).start();
  }, [clamped, animWidth]);

  const fillColor = colorOverride || getProgressColor(percentage);

  const widthInterpolated = animWidth.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
  });

  return (
    <View
      style={[
        styles.track,
        { height, backgroundColor: trackColor, borderRadius: Shapes.progressRadius },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            width: widthInterpolated,
            height,
            backgroundColor: fillColor,
            borderRadius: Shapes.progressRadius,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
