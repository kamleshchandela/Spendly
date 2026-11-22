/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '../../components/common/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  Baby,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Camera,
  Car,
  ChevronLeft,
  Coffee,
  Dog,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  Hammer,
  HeartPulse,
  Home,
  Laptop,
  Music,
  Package,
  Pizza,
  Plane,
  Plus,
  Printer,
  Repeat,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sprout,
  Tag,
  TrainFront,
  TrendingUp,
  Tv,
  Utensils,
  Watch,
  Wifi,
  Wrench,
  Zap,
} from 'lucide-react-native';
import { EmptyState, LoadingState } from '../../components/common';
import { getDatabase } from '../../database/database';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { useCategoryStore } from '../../store/categoryStore';
import { useTransactionStore } from '../../store/transactionStore';
import { Colors, Shadows, Shapes, Spacing } from '../../theme';
import { Category, CategoryType } from '../../types/category.types';
import { nowISO } from '../../utils/dateUtils';
import { pluralize } from '../../utils/formatUtils';

const renderCategoryIcon = (iconName: string, color: string, size: number = 22) => {
  switch (iconName) {
    case 'utensils':
      return <Utensils size={size} color={color} />;
    case 'shopping-cart':
      return <ShoppingCart size={size} color={color} />;
    case 'car':
      return <Car size={size} color={color} />;
    case 'fuel':
      return <Fuel size={size} color={color} />;
    case 'shopping-bag':
      return <ShoppingBag size={size} color={color} />;
    case 'zap':
      return <Zap size={size} color={color} />;
    case 'home':
      return <Home size={size} color={color} />;
    case 'heart-pulse':
      return <HeartPulse size={size} color={color} />;
    case 'book-open':
      return <BookOpen size={size} color={color} />;
    case 'film':
      return <Film size={size} color={color} />;
    case 'plane':
      return <Plane size={size} color={color} />;
    case 'scissors':
      return <Scissors size={size} color={color} />;
    case 'smartphone':
      return <Smartphone size={size} color={color} />;
    case 'gift':
      return <Gift size={size} color={color} />;
    case 'package':
      return <Package size={size} color={color} />;
    case 'briefcase':
      return <Briefcase size={size} color={color} />;
    case 'building-2':
      return <Building2 size={size} color={color} />;
    case 'laptop':
      return <Laptop size={size} color={color} />;
    case 'trending-up':
      return <TrendingUp size={size} color={color} />;
    case 'repeat':
      return <Repeat size={size} color={color} />;
    case 'coffee':
      return <Coffee size={size} color={color} />;
    case 'music':
      return <Music size={size} color={color} />;
    case 'gamepad-2':
      return <Gamepad2 size={size} color={color} />;
    case 'dumbbell':
      return <Dumbbell size={size} color={color} />;
    case 'baby':
      return <Baby size={size} color={color} />;
    case 'dog':
      return <Dog size={size} color={color} />;
    case 'plant':
      return <Sprout size={size} color={color} />;
    case 'wrench':
      return <Wrench size={size} color={color} />;
    case 'shield':
      return <Shield size={size} color={color} />;
    case 'graduation-cap':
      return <GraduationCap size={size} color={color} />;
    case 'bus':
      return <Bus size={size} color={color} />;
    case 'train':
      return <TrainFront size={size} color={color} />;
    case 'bike':
      return <Bike size={size} color={color} />;
    case 'pizza':
      return <Pizza size={size} color={color} />;
    case 'beer':
      return <Beer size={size} color={color} />;
    case 'shirt':
      return <Shirt size={size} color={color} />;
    case 'watch':
      return <Watch size={size} color={color} />;
    case 'camera':
      return <Camera size={size} color={color} />;
    case 'tv':
      return <Tv size={size} color={color} />;
    case 'wifi':
      return <Wifi size={size} color={color} />;
    case 'printer':
      return <Printer size={size} color={color} />;
    case 'tool':
      return <Hammer size={size} color={color} />;
    default:
      return <Tag size={size} color={color} />;
  }
};

export default function CategoriesScreen() {
  const router = useRouter();
  const loadCategoryStore = useCategoryStore((s) => s.loadCategories);
  const loadTransactionStore = useTransactionStore((s) => s.loadTransactions);

  const [activeTab, setActiveTab] = useState<CategoryType>('expense');
  const [categories, setCategories] = useState<Category[]>([]);
  const [txCounts, setTxCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchCategories = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const db = await getDatabase();
      const repo = new CategoryRepository(db);
      const [allCats, countRows] = await Promise.all([
        repo.getAll(undefined, false),
        db.getAllAsync<{ category_id: string; count: number }>(
          `SELECT category_id, COUNT(*) AS count
           FROM transactions
           WHERE is_deleted = 0 AND category_id IS NOT NULL
           GROUP BY category_id`
        ),
      ]);

      const countMap: Record<string, number> = {};
      for (const row of countRows) {
        countMap[row.category_id] = row.count;
      }

      setCategories(allCats);
      setTxCounts(countMap);
    } catch (error) {
      console.error('Failed to load categories:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchCategories();
    }, [fetchCategories])
  );

  const visibleCategories = useMemo(
    () => categories.filter((c) => c.type === activeTab && !c.isArchived),
    [categories, activeTab]
  );

  const reassignAndArchive = async (cat: Category) => {
    try {
      const db = await getDatabase();
      const fallback = categories.find(
        (c) =>
          c.type === cat.type &&
          c.id !== cat.id &&
          !c.isArchived &&
          c.name.toLowerCase() === 'other'
      );
      const fallbackId = fallback?.id ?? null;
      const now = nowISO();

      await db.withTransactionAsync(async () => {
        await db.runAsync(
          'UPDATE transactions SET category_id = ?, updated_at = ? WHERE category_id = ?',
          [fallbackId, now, cat.id]
        );
        if (fallbackId) {
          await db.runAsync(
            'UPDATE recurring_payments SET category_id = ?, updated_at = ? WHERE category_id = ?',
            [fallbackId, now, cat.id]
          );
        }
        await db.runAsync(
          'UPDATE categories SET is_archived = 1, updated_at = ? WHERE id = ?',
          [now, cat.id]
        );
      });

      await Promise.all([loadCategoryStore(), loadTransactionStore(), fetchCategories()]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      console.error('Failed to reassign and archive category:', error);
      Alert.alert('Error', 'Could not reassign transactions. Please try again.');
    }
  };

  const archiveOnly = async (cat: Category) => {
    try {
      const db = await getDatabase();
      const repo = new CategoryRepository(db);
      await repo.archive(cat.id);
      await Promise.all([loadCategoryStore(), fetchCategories()]);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      console.error('Failed to archive category:', error);
      Alert.alert('Error', 'Could not archive category.');
    }
  };

  const handleLongPress = (cat: Category) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});

    if (cat.isDefault) {
      Alert.alert(
        cat.name,
        'Default categories cannot be deleted, but you can tap to customize their name, icon, or color.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Edit Category',
            onPress: () => router.push(`/modals/add-category?id=${cat.id}` as never),
          },
        ]
      );
      return;
    }

    const txCount = txCounts[cat.id] ?? 0;
    if (txCount > 0) {
      Alert.alert(
        `Remove "${cat.name}"?`,
        `This category is used in ${txCount} ${pluralize(txCount, 'transaction')}. Choose how to handle existing history:`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reassign to "Other"',
            onPress: () => reassignAndArchive(cat),
          },
          {
            text: 'Archive (Keep History)',
            style: 'destructive',
            onPress: () => archiveOnly(cat),
          },
        ]
      );
    } else {
      Alert.alert(
        `Archive "${cat.name}"?`,
        'This custom category has no transactions and will be hidden from pickers.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            style: 'destructive',
            onPress: () => archiveOnly(cat),
          },
        ]
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Categories</Text>
        <Pressable
          onPress={() => router.push(`/modals/add-category?type=${activeTab}` as never)}
          style={({ pressed }) => [styles.addBtn, pressed && styles.pressed]}
          accessibilityLabel="Add category"
        >
          <Plus size={20} color={Colors.textInverse} />
        </Pressable>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.segmentedWrapper}>
        <View style={styles.segmentedTrack}>
          <Pressable
            onPress={() => {
              setActiveTab('expense');
              Haptics.selectionAsync().catch(() => {});
            }}
            style={[
              styles.segmentedTab,
              activeTab === 'expense' && styles.segmentedTabActive,
            ]}
          >
            <Text
              style={[
                styles.segmentedTabText,
                activeTab === 'expense' && styles.segmentedTabTextExpense,
              ]}
            >
              Expense Categories
            </Text>
          </Pressable>

          <Pressable
            onPress={() => {
              setActiveTab('income');
              Haptics.selectionAsync().catch(() => {});
            }}
            style={[
              styles.segmentedTab,
              activeTab === 'income' && styles.segmentedTabActive,
            ]}
          >
            <Text
              style={[
                styles.segmentedTabText,
                activeTab === 'income' && styles.segmentedTabTextIncome,
              ]}
            >
              Income Categories
            </Text>
          </Pressable>
        </View>
      </View>

      {loading ? (
        <LoadingState message="Loading categories..." />
      ) : visibleCategories.length === 0 ? (
        <View style={styles.emptyWrap}>
          <EmptyState
            icon={<Tag size={30} color={Colors.primary} />}
            heading={`No ${activeTab} categories`}
            subtitle="Create custom categories to organize your spending and income."
            ctaLabel="Add Category"
            onCtaPress={() => router.push(`/modals/add-category?type=${activeTab}` as never)}
          />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchCategories(true)}
              tintColor={Colors.primary}
            />
          }
        >
          <Text style={styles.helperText}>
            Tap any category to edit • Long-press a custom category to archive
          </Text>

          <View style={styles.grid}>
            {visibleCategories.map((cat) => {
              const txCount = txCounts[cat.id] ?? 0;
              return (
                <Pressable
                  key={cat.id}
                  onPress={() => router.push(`/modals/add-category?id=${cat.id}` as never)}
                  onLongPress={() => handleLongPress(cat)}
                  delayLongPress={350}
                  style={({ pressed }) => [styles.catCard, pressed && styles.cardPressed]}
                >
                  {cat.isDefault && (
                    <View style={styles.defaultPill}>
                      <Text style={styles.defaultPillText}>Default</Text>
                    </View>
                  )}

                  <View
                    style={[
                      styles.catIconCircle,
                      { backgroundColor: `${cat.color}20` },
                    ]}
                  >
                    {renderCategoryIcon(cat.iconName, cat.color, 22)}
                  </View>

                  <Text style={styles.catName} numberOfLines={2}>
                    {cat.name}
                  </Text>

                  <Text style={styles.catCount}>
                    {txCount} {pluralize(txCount, 'txn', 'txns')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.sm,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#EDF1EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  addBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
    shadowColor: Colors.primary,
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 8,
  },
  pressed: {
    opacity: 0.8,
    transform: [{ scale: 0.96 }],
  },
  segmentedWrapper: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  segmentedTrack: {
    flexDirection: 'row',
    backgroundColor: '#F3F6F2',
    borderRadius: 16,
    padding: 4,
    gap: 4,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  segmentedTab: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedTabActive: {
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 1 },
    shadowRadius: 4,
  },
  segmentedTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  segmentedTabTextExpense: {
    color: Colors.expense,
  },
  segmentedTabTextIncome: {
    color: Colors.primary,
  },
  emptyWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 100,
  },
  helperText: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: 'center',
    letterSpacing: -0.1,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  catCard: {
    width: '31%',
    backgroundColor: Colors.bgCard,
    borderRadius: 18,
    paddingVertical: Spacing.md,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    minHeight: 120,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  cardPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  defaultPill: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#F3F6F2',
    borderRadius: 100,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  defaultPillText: {
    fontSize: 9,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  catIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
    marginTop: Spacing.xs,
  },
  catName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
    textAlign: 'center',
    lineHeight: 16,
    marginBottom: 3,
  },
  catCount: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
