/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Colors } from '../../theme/colors';

export interface SoftSwitchProps {
  value: boolean;
  onValueChange: (newValue: boolean) => void;
  disabled?: boolean;
  accessibilityLabel?: string;
  activeColor?: string;
  inactiveColor?: string;
}

const TRACK_WIDTH = 48;
const TRACK_HEIGHT = 28;
const PADDING = 3;
const THUMB_SIZE = TRACK_HEIGHT - PADDING * 2; // 22px
const TRAVEL_DISTANCE = TRACK_WIDTH - THUMB_SIZE - PADDING * 2; // 20px

export function SoftSwitch({
  value,
  onValueChange,
  disabled = false,
  accessibilityLabel,
  activeColor = Colors.primary,
  inactiveColor = '#DEE5DE',
}: SoftSwitchProps) {
  // 0 = false (off), 1 = true (on)
  const animValue = useRef(new Animated.Value(value ? 1 : 0)).current;
  const pressScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(animValue, {
      toValue: value ? 1 : 0,
      friction: 8,
      tension: 180,
      useNativeDriver: true,
    }).start();
  }, [value, animValue]);

  const handlePressIn = () => {
    if (disabled) return;
    Animated.spring(pressScale, {
      toValue: 0.94,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (disabled) return;
    Animated.spring(pressScale, {
      toValue: 1,
      friction: 6,
      tension: 200,
      useNativeDriver: true,
    }).start();
  };

  const handleToggle = () => {
    if (disabled) return;
    Haptics.selectionAsync().catch(() => {});
    const nextVal = !value;
    // Instant optimistic spring on native thread for 0ms latency
    Animated.spring(animValue, {
      toValue: nextVal ? 1 : 0,
      friction: 8,
      tension: 200,
      useNativeDriver: true,
    }).start();
    onValueChange(nextVal);
  };

  const translateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, TRAVEL_DISTANCE],
  });

  return (
    <Pressable
      onPress={handleToggle}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled }}
      accessibilityLabel={accessibilityLabel}
      hitSlop={8}
      style={[styles.container, disabled && styles.containerDisabled]}
    >
      <View style={styles.trackWrapper}>
        {/* Inactive base track */}
        <View
          style={[
            styles.baseTrack,
            { backgroundColor: inactiveColor },
          ]}
        />

        {/* Active track overlay (animates opacity natively for 60fps zero-lag transition) */}
        <Animated.View
          style={[
            styles.activeTrack,
            {
              backgroundColor: activeColor,
              opacity: animValue,
            },
          ]}
        />

        {/* Floating smooth thumb */}
        <Animated.View
          style={[
            styles.thumb,
            {
              transform: [{ translateX }, { scale: pressScale }],
            },
          ]}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  containerDisabled: {
    opacity: 0.5,
  },
  trackWrapper: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: TRACK_HEIGHT / 2,
    position: 'relative',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  baseTrack: {
    ...StyleSheet.absoluteFill,
    borderRadius: TRACK_HEIGHT / 2,
    borderWidth: 1,
    borderColor: '#D4DDD4',
  },
  activeTrack: {
    ...StyleSheet.absoluteFill,
    borderRadius: TRACK_HEIGHT / 2,
  },
  thumb: {
    position: 'absolute',
    left: PADDING,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#FFFFFF',
    ...Platform.select({
      ios: {
        shadowColor: '#102816',
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 3,
      },
      android: {
        elevation: 3,
      },
    }),
  },
});
