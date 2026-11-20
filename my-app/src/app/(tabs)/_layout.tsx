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
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeftRight, BarChart2, Home, Plus, Wallet } from 'lucide-react-native';
import Svg, { Path } from 'react-native-svg';
import { Colors } from '../../theme/colors';
import { useSettingsStore } from '../../store/settingsStore';
import { useTabBarStore } from '../../store/tabBarStore';

type TabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

interface TabConfig {
  key: string;
  label: string;
  renderIcon: (color: string, size: number, focused: boolean) => React.ReactNode;
}

const LEFT_TABS: TabConfig[] = [
  {
    key: 'index',
    label: 'Home',
    renderIcon: (color, size, focused) => (
      <Home size={size} color={color} strokeWidth={focused ? 2.3 : 2.0} />
    ),
  },
  {
    key: 'transactions',
    label: 'Transactions',
    renderIcon: (color, size, focused) => (
      <ArrowLeftRight size={size} color={color} strokeWidth={focused ? 2.3 : 2.0} />
    ),
  },
];

const RIGHT_TABS: TabConfig[] = [
  {
    key: 'budgets',
    label: 'Budgets',
    renderIcon: (color, size, focused) => (
      <Wallet size={size} color={color} strokeWidth={focused ? 2.3 : 2.0} />
    ),
  },
  {
    key: 'insights',
    label: 'Insights',
    renderIcon: (color, size, focused) => (
      <BarChart2 size={size} color={color} strokeWidth={focused ? 2.3 : 2.0} />
    ),
  },
];

const BAR_HEIGHT = 60;
const FAB_SIZE = 50;
const FAB_ELEVATION = 18; // How much FAB extends above the top edge of the tab bar
const NOTCH_HALF_WIDTH = 48; // Width of the scooped notch
const NOTCH_DEPTH = 39; // Depth of the scoop cradle
const SHADOW_PAD = 8; // Extra vertical space for soft ambient drop shadows

function getNotchPath(width: number, height: number): string {
  const r = 26; // Corner radius of the floating capsule
  const cx = width / 2;
  const minX = 1;
  const maxX = width - 1;
  const minY = 1;
  const maxY = height - 1;

  // Seamless S-curve scoop around the center FAB with comfortable breathing gap
  return (
    `M ${minX} ${minY + r} ` +
    `A ${r} ${r} 0 0 1 ${minX + r} ${minY} ` +
    `L ${cx - NOTCH_HALF_WIDTH} ${minY} ` +
    `C ${cx - 30} ${minY}, ${cx - 27} ${NOTCH_DEPTH}, ${cx} ${NOTCH_DEPTH} ` +
    `C ${cx + 27} ${NOTCH_DEPTH}, ${cx + 30} ${minY}, ${cx + NOTCH_HALF_WIDTH} ${minY} ` +
    `L ${maxX - r} ${minY} ` +
    `A ${r} ${r} 0 0 1 ${maxX} ${minY + r} ` +
    `L ${maxX} ${maxY - r} ` +
    `A ${r} ${r} 0 0 1 ${maxX - r} ${maxY} ` +
    `L ${minX + r} ${maxY} ` +
    `A ${r} ${r} 0 0 1 ${minX} ${maxY - r} ` +
    `Z`
  );
}

function TabItem({
  tab,
  isFocused,
  onPress,
}: {
  tab: TabConfig;
  isFocused: boolean;
  onPress: () => void;
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dotAnim = useRef(new Animated.Value(isFocused ? 1 : 0)).current;

  useEffect(() => {
    Animated.spring(dotAnim, {
      toValue: isFocused ? 1 : 0,
      useNativeDriver: true,
      friction: 7,
      tension: 120,
    }).start();
  }, [isFocused]);

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.92,
      useNativeDriver: true,
      friction: 7,
      tension: 160,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1.0,
      useNativeDriver: true,
      friction: 7,
      tension: 160,
    }).start();
  };

  const color = isFocused ? Colors.primary : '#8E9E94';

  const iconScale = dotAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.06],
  });

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      accessibilityRole="tab"
      accessibilityState={{ selected: isFocused }}
      accessibilityLabel={tab.label}
      style={styles.tabItem}
    >
      <Animated.View
        style={[
          styles.tabInner,
          {
            transform: [{ scale: scaleAnim }],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.tabIconWrap,
            {
              transform: [{ scale: iconScale }],
            },
          ]}
        >
          {tab.renderIcon(color, 21, isFocused)}
        </Animated.View>
        <Text
          style={[
            styles.tabLabel,
            { color },
            isFocused && styles.tabLabelActive,
          ]}
          numberOfLines={1}
        >
          {tab.label}
        </Text>
        <Animated.View
          style={[
            styles.activeDot,
            {
              opacity: dotAnim,
              transform: [
                {
                  scale: dotAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.3, 1],
                  }),
                },
              ],
            },
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

function SpendlyTabBar({ state, emitter, navigateToTab, insets }: TabBarProps) {
  const isTabBarVisible = useTabBarStore((s) => s.isTabBarVisible);
  const router = useRouter();
  const safeInsets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const hapticEnabled = useSettingsStore((s) => s.settings?.hapticEnabled ?? true);

  // Responsive bar width with margins on both sides
  const horizontalMargin = 14;
  const [barWidth, setBarWidth] = useState(
    Math.max(windowWidth - horizontalMargin * 2, 300)
  );

  // Full safe area clearance: sits comfortably snug above system navigation
  const rawBottom = Math.max(insets?.bottom ?? 0, safeInsets.bottom ?? 0);
  const bottomOffset = rawBottom > 0
    ? rawBottom - 5
    : Platform.select({ android: 16, default: 10 });

  // Center FAB animated press state
  const fabScaleAnim = useRef(new Animated.Value(1)).current;

  const currentRouteName = state.routes[state.index]?.name;
  const isHomeScreen = currentRouteName === 'index' || currentRouteName === 'budgets';

  // Failsafe: Tab bar must NEVER be hidden on Home or Budgets screen
  if (!isTabBarVisible && !isHomeScreen) {
    return null;
  }

  const handleFabPressIn = () => {
    Animated.spring(fabScaleAnim, {
      toValue: 0.91,
      useNativeDriver: true,
      friction: 5,
      tension: 140,
    }).start();
  };

  const handleFabPressOut = () => {
    Animated.spring(fabScaleAnim, {
      toValue: 1.0,
      useNativeDriver: true,
      friction: 5,
      tension: 140,
    }).start();
  };

  const findRouteForKey = (key: string) => {
    const idx = state.routes.findIndex(
      (r) => r.name === key || r.name === `${key}/index`
    );
    return idx >= 0 ? { route: state.routes[idx], index: idx } : null;
  };

  const handleTabPress = (key: string) => {
    const match = findRouteForKey(key);
    if (!match) return;

    const isFocused = state.index === match.index;
    const event = emitter.emit({
      type: 'tabPress',
      target: match.route.key,
      canPreventDefault: true,
    });

    if (hapticEnabled) {
      Haptics.selectionAsync().catch(() => {});
    }

    if (key === 'budgets') {
      if (isFocused) {
        router.replace('/(tabs)/budgets' as never);
      } else {
        router.navigate('/(tabs)/budgets' as never);
      }
      return;
    }

    if (key === 'insights') {
      if (isFocused) {
        router.replace('/(tabs)/insights' as never);
      } else {
        router.navigate('/(tabs)/insights' as never);
      }
      return;
    }

    if (!isFocused && !event.defaultPrevented) {
      navigateToTab(match.route.key);
    }
  };

  const handleAddPress = () => {
    if (hapticEnabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
    router.push('/modals/add-transaction' as never);
  };

  return (
    <View
      style={[
        styles.outerContainer,
        {
          paddingBottom: bottomOffset,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.floatingBar,
          {
            width: barWidth,
            height: BAR_HEIGHT + FAB_ELEVATION + SHADOW_PAD,
          },
        ]}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0 && Math.abs(w - barWidth) > 1) {
            setBarWidth(w);
          }
        }}
        pointerEvents="box-none"
      >
        {/* Soft Multi-Layered Floating Ambient Shadow (Curves with the Scoop) */}
        <View style={styles.svgWrapper} pointerEvents="none">
          <Svg
            width={barWidth}
            height={BAR_HEIGHT + SHADOW_PAD}
            viewBox={`0 0 ${barWidth} ${BAR_HEIGHT + SHADOW_PAD}`}
          >
            {/* Ambient drop shadow layer 1 (outer soft glow) */}
            <Path
              d={getNotchPath(barWidth, BAR_HEIGHT)}
              fill="rgba(14, 40, 24, 0.025)"
              transform="translate(0, 8)"
            />
            {/* Ambient drop shadow layer 2 (mid blur) */}
            <Path
              d={getNotchPath(barWidth, BAR_HEIGHT)}
              fill="rgba(14, 40, 24, 0.035)"
              transform="translate(0, 5.5)"
            />
            {/* Ambient drop shadow layer 3 (contact shadow) */}
            <Path
              d={getNotchPath(barWidth, BAR_HEIGHT)}
              fill="rgba(14, 40, 24, 0.045)"
              transform="translate(0, 3)"
            />
            {/* Ambient drop shadow layer 4 (close rim) */}
            <Path
              d={getNotchPath(barWidth, BAR_HEIGHT)}
              fill="rgba(14, 40, 24, 0.05)"
              transform="translate(0, 1.5)"
            />

            {/* Main Crisp White Tab Bar with Hairline Border */}
            <Path
              d={getNotchPath(barWidth, BAR_HEIGHT)}
              fill={Colors.bgCard}
              stroke="#EDF2EC"
              strokeWidth={1.2}
            />
          </Svg>
        </View>

        {/* Elevated Center Floating Action Button (+ Transaction) with Ambient Glow */}
        <View
          style={[
            styles.fabAnchor,
            {
              left: (barWidth - FAB_SIZE) / 2,
            },
          ]}
        >
          {/* Soft Green Ambient Lift Glow under FAB */}
          <View style={styles.fabGlow} pointerEvents="none" />
          <Animated.View style={{ transform: [{ scale: fabScaleAnim }] }}>
            <Pressable
              onPress={handleAddPress}
              onPressIn={handleFabPressIn}
              onPressOut={handleFabPressOut}
              accessibilityRole="button"
              accessibilityLabel="Add transaction"
              style={styles.fabButton}
            >
              <Plus size={26} color={Colors.textInverse} strokeWidth={2.6} />
            </Pressable>
          </Animated.View>
        </View>

        {/* Tabs Row (Left tabs, Center scooped gap, Right tabs) */}
        <View style={styles.tabsRow}>
          <View style={styles.tabSideGroup}>
            {LEFT_TABS.map((tab) => {
              const match = findRouteForKey(tab.key);
              const isFocused = match ? state.index === match.index : false;
              return (
                <TabItem
                  key={tab.key}
                  tab={tab}
                  isFocused={isFocused}
                  onPress={() => handleTabPress(tab.key)}
                />
              );
            })}
          </View>

          {/* Reserved gap for center scoop cradle */}
          <View style={styles.centerScoopGap} pointerEvents="none" />

          <View style={styles.tabSideGroup}>
            {RIGHT_TABS.map((tab) => {
              const match = findRouteForKey(tab.key);
              const isFocused = match ? state.index === match.index : false;
              return (
                <TabItem
                  key={tab.key}
                  tab={tab}
                  isFocused={isFocused}
                  onPress={() => handleTabPress(tab.key)}
                />
              );
            })}
          </View>
        </View>
      </View>
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <SpendlyTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          backgroundColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
        },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions' }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets' }} />
      <Tabs.Screen name="insights" options={{ title: 'Insights' }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    backgroundColor: 'transparent',
  },
  floatingBar: {
    position: 'relative',
    alignItems: 'center',
    ...Platform.select({
      ios: {
        shadowColor: '#0E2818',
        shadowOpacity: 0.12,
        shadowOffset: { width: 0, height: 8 },
        shadowRadius: 20,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  svgWrapper: {
    position: 'absolute',
    top: FAB_ELEVATION,
    left: 0,
    right: 0,
    height: BAR_HEIGHT + SHADOW_PAD,
  },
  fabAnchor: {
    position: 'absolute',
    top: 0, // Elevated by FAB_ELEVATION above the tab bar top edge
    width: FAB_SIZE,
    height: FAB_SIZE,
    zIndex: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fabGlow: {
    position: 'absolute',
    top: 6,
    width: FAB_SIZE - 4,
    height: FAB_SIZE - 4,
    borderRadius: (FAB_SIZE - 4) / 2,
    backgroundColor: 'rgba(45, 122, 80, 0.28)',
  },
  fabButton: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0, // Clean solid green, no white border ring
    ...Platform.select({
      ios: {
        shadowColor: '#123D24',
        shadowOpacity: 0.42,
        shadowOffset: { width: 0, height: 7 },
        shadowRadius: 13,
      },
      android: {
        elevation: 9,
      },
    }),
  },
  tabsRow: {
    position: 'absolute',
    top: FAB_ELEVATION,
    left: 0,
    right: 0,
    height: BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  tabSideGroup: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    height: '100%',
  },
  centerScoopGap: {
    width: 70,
    height: '100%',
  },
  tabItem: {
    flex: 1,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabInner: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 5,
    paddingBottom: 3,
  },
  tabIconWrap: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 10.5,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 3,
    letterSpacing: -0.1,
  },
  tabLabelActive: {
    fontWeight: '700',
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.primary,
    marginTop: 3,
  },
});
