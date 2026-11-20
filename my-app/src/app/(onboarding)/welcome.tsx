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
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Svg, { Circle, Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import {
  ArrowRight,
  Check,
  PieChart,
  ShieldCheck,
  Sparkles,
  TrendingUp,
  Wallet,
} from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Spacing } from '../../theme/spacing';
import { useSettingsStore } from '../../store/settingsStore';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface BenefitRowProps {
  icon: React.ReactNode;
  iconBg: string;
  text: string;
}

function BenefitRow({ icon, iconBg, text }: BenefitRowProps) {
  return (
    <View style={styles.benefitRow}>
      <View style={[styles.benefitIconBox, { backgroundColor: iconBg }]}>{icon}</View>
      <Text style={styles.benefitText}>{text}</Text>
      <View style={styles.checkBadge}>
        <Check size={14} color={Colors.primary} strokeWidth={2.6} />
      </View>
    </View>
  );
}

function HeroEmblem() {
  return (
    <View style={styles.emblemWrapper}>
      {/* Soft concentric SVG rings */}
      <Svg width={220} height={220} viewBox="0 0 220 220" style={styles.emblemSvg}>
        <Defs>
          <RadialGradient id="emblemGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={Colors.primary} stopOpacity="0.22" />
            <Stop offset="60%" stopColor={Colors.primary} stopOpacity="0.08" />
            <Stop offset="100%" stopColor={Colors.primary} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="110" cy="110" r="108" fill="url(#emblemGlow)" />
        <Circle
          cx="110"
          cy="110"
          r="92"
          fill="none"
          stroke={Colors.primary}
          strokeOpacity="0.18"
          strokeWidth="1.5"
          strokeDasharray="6 6"
        />
        <Circle
          cx="110"
          cy="110"
          r="72"
          fill="#FFFFFF"
          fillOpacity="0.65"
          stroke={Colors.primary}
          strokeOpacity="0.12"
          strokeWidth="1"
        />
      </Svg>

      {/* Center white elevated badge with Wallet icon */}
      <View style={styles.centerBadge}>
        <View style={styles.centerInnerCircle}>
          <Wallet size={46} color={Colors.primary} strokeWidth={1.85} />
        </View>
      </View>

      {/* Top-right floating accent badge */}
      <View style={[styles.floatingBadge, styles.floatingTopRight]}>
        <View style={[styles.floatingInner, { backgroundColor: Colors.primarySoft }]}>
          <TrendingUp size={18} color={Colors.primary} strokeWidth={2.2} />
        </View>
      </View>

      {/* Bottom-left floating accent badge */}
      <View style={[styles.floatingBadge, styles.floatingBottomLeft]}>
        <View style={[styles.floatingInner, { backgroundColor: Colors.secondarySoft }]}>
          <ShieldCheck size={18} color={Colors.secondary} strokeWidth={2.2} />
        </View>
      </View>

      {/* Top-left subtle sparkle accent */}
      <View style={[styles.floatingBadgeSmall, styles.floatingTopLeft]}>
        <View style={[styles.floatingInnerSmall, { backgroundColor: Colors.accentLavenderSoft }]}>
          <Sparkles size={14} color={Colors.accentLavender} strokeWidth={2.2} />
        </View>
      </View>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const { updateSetting } = useSettingsStore();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 550,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" />

      {/* Soft mint-to-canvas linear gradient backdrop */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <Svg width="100%" height="100%" preserveAspectRatio="none" viewBox="0 0 100 100">
          <Defs>
            <LinearGradient id="welcomeBg" x1="0%" y1="0%" x2="0%" y2="100%">
              <Stop offset="0%" stopColor={Colors.primarySoft} stopOpacity="1" />
              <Stop offset="55%" stopColor="#EFF7F2" stopOpacity="1" />
              <Stop offset="100%" stopColor={Colors.bgMain} stopOpacity="1" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100" height="100" fill="url(#welcomeBg)" />
        </Svg>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={[
              styles.container,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            {/* Layered Vector Emblem */}
            <View style={styles.illustrationContainer}>
              <HeroEmblem />
            </View>

            {/* Text block */}
            <View style={styles.textBlock}>
              <Text style={styles.heading}>Welcome to Spendly</Text>
              <Text style={styles.subtitle}>
                {'Your personal finance companion.\nNo account. No internet.\nJust you and your money.'}
              </Text>
            </View>

            {/* Benefits Card */}
            <View style={styles.benefitsContainer}>
              <BenefitRow
                icon={<Sparkles size={18} color={Colors.primary} strokeWidth={2.1} />}
                iconBg={Colors.primarySoft}
                text="Track every rupee, effortlessly"
              />
              <View style={styles.benefitDivider} />
              <BenefitRow
                icon={<PieChart size={18} color={Colors.secondary} strokeWidth={2.1} />}
                iconBg={Colors.secondarySoft}
                text="Understand your spending habits"
              />
              <View style={styles.benefitDivider} />
              <BenefitRow
                icon={<ShieldCheck size={18} color={Colors.accentLavender} strokeWidth={2.1} />}
                iconBg={Colors.accentLavenderSoft}
                text="Your data stays only on your phone"
              />
            </View>
          </Animated.View>
        </ScrollView>

        {/* CTA */}
        <SafeAreaView edges={['bottom']} style={styles.ctaWrapper}>
          <Pressable
            style={({ pressed }) => [styles.ctaButton, pressed && styles.ctaButtonPressed]}
            onPress={() => router.push('/(onboarding)/currency' as never)}
            accessibilityRole="button"
            accessibilityLabel="Get Started"
          >
            <Text style={styles.ctaText}>Get Started</Text>
            <ArrowRight size={18} color={Colors.textInverse} strokeWidth={2.3} />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.skipIntroBtn, pressed && styles.skipIntroBtnPressed]}
            onPress={async () => {
              await updateSetting('onboardingCompleted', true);
              router.replace('/(tabs)/' as never);
            }}
            accessibilityRole="button"
            accessibilityLabel="Skip to Dashboard"
          >
            <Text style={styles.skipIntroText}>Skip to Dashboard</Text>
          </Pressable>
        </SafeAreaView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  safeArea: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingBottom: Spacing.xl,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.xl,
  },

  // Hero Emblem
  illustrationContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: Math.min(SCREEN_HEIGHT * 0.3, 240),
    marginBottom: Spacing['2xl'],
  },
  emblemWrapper: {
    width: 220,
    height: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emblemSvg: {
    position: 'absolute',
  },
  centerBadge: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOpacity: 0.18,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
      },
      android: { elevation: 6 },
    }),
  },
  centerInnerCircle: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: Colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingBadge: {
    position: 'absolute',
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 3 },
        shadowRadius: 8,
      },
      android: { elevation: 3 },
    }),
  },
  floatingInner: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTopRight: {
    top: 24,
    right: 18,
  },
  floatingBottomLeft: {
    bottom: 24,
    left: 18,
  },
  floatingBadgeSmall: {
    position: 'absolute',
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  floatingInnerSmall: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  floatingTopLeft: {
    top: 34,
    left: 26,
  },

  // Text
  textBlock: {
    alignItems: 'center',
    marginBottom: Spacing['2xl'],
  },
  heading: {
    fontSize: 32,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.md,
    letterSpacing: -0.6,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '400',
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },

  // Benefits Card
  benefitsContainer: {
    backgroundColor: Colors.bgCard,
    borderRadius: 22,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  benefitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    minHeight: 56,
    paddingVertical: Spacing.xs,
  },
  benefitIconBox: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.textPrimary,
    flex: 1,
  },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5F4EC',
    borderWidth: 1,
    borderColor: '#C6E8D5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  benefitDivider: {
    height: 1,
    backgroundColor: '#F0F4EF',
  },

  // CTA
  ctaWrapper: {
    paddingHorizontal: Spacing['2xl'],
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    height: 52,
    borderRadius: 16,
    ...Platform.select({
      ios: {
        shadowColor: Colors.primary,
        shadowOpacity: 0.25,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
      },
      android: { elevation: 4 },
    }),
  },
  ctaButtonPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  ctaText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textInverse,
    letterSpacing: 0.2,
  },
  skipIntroBtn: {
    paddingVertical: Spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  skipIntroBtnPressed: {
    opacity: 0.7,
  },
  skipIntroText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.textSecondary,
  },
});
