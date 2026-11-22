/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';

interface AnimatedSplashScreenProps {
  isReady: boolean;
  onAnimationComplete: () => void;
}

export function AnimatedSplashScreen({
  isReady,
  onAnimationComplete,
}: AnimatedSplashScreenProps) {
  // Exit fade & scale
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const exitScaleAnim = useRef(new Animated.Value(1)).current;

  // Gentle floating / breathing idle animation
  const floatAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Content entrance animation
  const contentFadeAnim = useRef(new Animated.Value(0)).current;
  const contentSlideAnim = useRef(new Animated.Value(14)).current;

  const [hasStartedExit, setHasStartedExit] = useState(false);
  const mountTimeRef = useRef(Date.now());

  useEffect(() => {
    // Hide native splash screen once custom animated splash is mounted
    SplashScreen.hideAsync().catch(() => {});

    // Entrance animation
    Animated.parallel([
      Animated.timing(contentFadeAnim, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentSlideAnim, {
        toValue: 0,
        duration: 450,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();

    // Floating loop (gentle hover)
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    // Pulse loop (soft ambient glow expansion)
    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    );

    floatLoop.start();
    pulseLoop.start();

    return () => {
      floatLoop.stop();
      pulseLoop.stop();
    };
  }, [contentFadeAnim, contentSlideAnim, floatAnim, pulseAnim]);

  // Handle smooth transition out when app is ready
  useEffect(() => {
    if (!isReady || hasStartedExit) return;

    // Ensure splash is visible for at least 800ms for a silky smooth feel
    const elapsed = Date.now() - mountTimeRef.current;
    const minDisplayTime = 850;
    const delay = Math.max(0, minDisplayTime - elapsed);

    const timer = setTimeout(() => {
      setHasStartedExit(true);

      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(exitScaleAnim, {
          toValue: 1.05,
          duration: 380,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start(() => {
        onAnimationComplete();
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [isReady, hasStartedExit, fadeAnim, exitScaleAnim, onAnimationComplete]);

  // Interpolations
  const translateY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -8],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ scale: exitScaleAnim }],
        },
      ]}
      pointerEvents={hasStartedExit ? 'none' : 'auto'}
    >
      <Animated.View
        style={[
          styles.content,
          {
            opacity: contentFadeAnim,
            transform: [{ translateY: contentSlideAnim }],
          },
        ]}
      >
        {/* Soft Ambient Radial Background Halo */}
        <Animated.View
          style={[
            styles.glowRing,
            {
              transform: [{ scale: pulseAnim }],
            },
          ]}
        />

        {/* Floating 3D Rupee Wallet Logo */}
        <Animated.View
          style={[
            styles.walletWrapper,
            {
              transform: [{ translateY }],
            },
          ]}
        >
          <Image
            source={require('../../../assets/images/splash-icon.png')}
            style={styles.walletImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Brand Typography */}
        <View style={styles.brandWrapper}>
          <Text style={styles.appName}>Spendly</Text>
          <Text style={styles.appTagline}>Smart Personal Finance</Text>
        </View>

        {/* Soft Modern Footer Pill */}
        <View style={styles.footerPill}>
          <View style={styles.footerDot} />
          <Text style={styles.footerText}>Secure • Offline • Personal</Text>
        </View>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Colors.bgMain,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
  },
  glowRing: {
    position: 'absolute',
    top: -15,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primarySoft,
    opacity: 0.65,
  },
  walletWrapper: {
    width: 170,
    height: 160,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xl,
  },
  walletImage: {
    width: '100%',
    height: '100%',
  },
  brandWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing['3xl'],
  },
  appName: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.6,
  },
  appTagline: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.3,
    marginTop: 4,
  },
  footerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: Colors.border,
    shadowColor: Colors.textPrimary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
    gap: 8,
  },
  footerDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.textSecondary,
    letterSpacing: 0.2,
  },
});
