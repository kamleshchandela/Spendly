/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Alert } from '../../components/common/CustomAlert';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import {
  AlertTriangle,
  Archive,
  Baby,
  Beer,
  Bike,
  BookOpen,
  Briefcase,
  Building2,
  Bus,
  Camera,
  Car,
  Check,
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
  Lock,
  Music,
  Package,
  Pizza,
  Plane,
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
  X,
  Zap,
} from 'lucide-react-native';
import { Button, Card, Chip, Input, LoadingState } from '../../components/common';
import { CATEGORY_ICONS } from '../../constants/icons';
import { getDatabase } from '../../database/database';
import { CategoryRepository } from '../../database/repositories/CategoryRepository';
import { useCategoryStore } from '../../store/categoryStore';
import { useTransactionStore } from '../../store/transactionStore';
import { Colors, Shadows, Shapes, Spacing } from '../../theme';
import { Category, CategoryType } from '../../types/category.types';
import { nowISO } from '../../utils/dateUtils';
import { pluralize } from '../../utils/formatUtils';
import { validateRequired } from '../../utils/validationUtils';

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

export default function AddCategoryModal() {
  const router = useRouter();
  const { id, type: paramType } = useLocalSearchParams<{
    id?: string;
    type?: CategoryType;
  }>();
  const isEditing = Boolean(id);

  const loadCategories = useCategoryStore((s) => s.loadCategories);
  const loadTransactions = useTransactionStore((s) => s.loadTransactions);

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [existingCategory, setExistingCategory] = useState<Category | null>(null);
  const [txCount, setTxCount] = useState(0);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [type, setType] = useState<CategoryType>(
    paramType === 'income' ? 'income' : 'expense'
  );
  const [iconName, setIconName] = useState<string>(CATEGORY_ICONS[0]);
  const [color, setColor] = useState<string>(Colors.categoryColors[0]);

  useEffect(() => {
    if (!id) return;

    const loadCategory = async () => {
      try {
        const db = await getDatabase();
        const repo = new CategoryRepository(db);
        const found = await repo.getById(id);
        if (found) {
          setExistingCategory(found);
          setName(found.name);
          setType(found.type);
          setIconName(found.iconName);
          setColor(found.color);

          const countRow = await db.getFirstAsync<{ count: number }>(
            'SELECT COUNT(*) AS count FROM transactions WHERE is_deleted = 0 AND category_id = ?',
            [found.id]
          );
          setTxCount(countRow?.count ?? 0);
        }
      } catch (error) {
        console.error('Failed to load category:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategory();
  }, [id]);

  const handleSave = async () => {
    const trimmedName = name.trim();
    const err = validateRequired(trimmedName, 'Category name');
    if (err) {
      setNameError(err);
      return;
    }
    if (trimmedName.length > 25) {
      setNameError('Category name must be 25 characters or fewer');
      return;
    }

    setNameError(null);
    setSaving(true);

    try {
      const db = await getDatabase();
      const repo = new CategoryRepository(db);

      if (isEditing && id) {
        await repo.update(id, {
          name: trimmedName,
          type: existingCategory?.isDefault ? existingCategory.type : type,
          iconName,
          color,
        });
      } else {
        await repo.insert({
          name: trimmedName,
          type,
          iconName,
          color,
          isDefault: false,
          isArchived: false,
        });
      }

      await loadCategories();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (error) {
      console.error('Failed to save category:', error);
      Alert.alert('Save Failed', 'Could not save category. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const performArchive = async (reassignToOther: boolean) => {
    if (!existingCategory) return;
    setSaving(true);
    try {
      const db = await getDatabase();
      const repo = new CategoryRepository(db);
      const now = nowISO();

      if (reassignToOther) {
        const sameTypeCats = await repo.getAll(existingCategory.type, false);
        const otherCat = sameTypeCats.find(
          (c) => c.id !== existingCategory.id && c.name.toLowerCase() === 'other'
        );
        const fallbackId = otherCat?.id ?? null;

        await db.withTransactionAsync(async () => {
          await db.runAsync(
            'UPDATE transactions SET category_id = ?, updated_at = ? WHERE category_id = ?',
            [fallbackId, now, existingCategory.id]
          );
          if (fallbackId) {
            await db.runAsync(
              'UPDATE recurring_payments SET category_id = ?, updated_at = ? WHERE category_id = ?',
              [fallbackId, now, existingCategory.id]
            );
          }
          await db.runAsync(
            'UPDATE categories SET is_archived = 1, updated_at = ? WHERE id = ?',
            [now, existingCategory.id]
          );
        });
        await loadTransactions();
      } else {
        await repo.archive(existingCategory.id);
      }

      await loadCategories();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      router.back();
    } catch (error) {
      console.error('Failed to archive category:', error);
      Alert.alert('Error', 'Could not archive this category. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleArchivePress = () => {
    if (!existingCategory || existingCategory.isDefault) return;

    if (txCount > 0) {
      Alert.alert(
        `Category in use (${txCount} ${pluralize(txCount, 'transaction')})`,
        'You can reassign existing transactions to "Other" before removing this category, or archive it to keep past history intact.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Reassign to "Other"',
            onPress: () => performArchive(true),
          },
          {
            text: 'Archive Only',
            style: 'destructive',
            onPress: () => performArchive(false),
          },
        ]
      );
    } else {
      Alert.alert(
        `Archive "${existingCategory.name}"?`,
        'This custom category has no transactions and will be archived.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Archive',
            style: 'destructive',
            onPress: () => performArchive(false),
          },
        ]
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message="Loading category..." />
      </SafeAreaView>
    );
  }

  const isTypeLocked = Boolean(existingCategory?.isDefault);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      {/* Modal Header */}
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeBtn, pressed && styles.pressed]}
          accessibilityLabel="Close"
        >
          <X size={22} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {isEditing ? 'Edit Category' : 'Add Category'}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Preview Card */}
          <Card style={styles.previewCard}>
            <View style={[styles.previewCircle, { backgroundColor: `${color}20` }]}>
              {renderCategoryIcon(iconName, color, 28)}
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewName} numberOfLines={1}>
                {name.trim() || 'Category Name'}
              </Text>
              <View style={styles.previewMetaRow}>
                <View
                  style={[
                    styles.typePill,
                    {
                      backgroundColor:
                        type === 'expense' ? Colors.expenseSoft : Colors.primarySoft,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typePillText,
                      { color: type === 'expense' ? Colors.expense : Colors.primary },
                    ]}
                  >
                    {type === 'expense' ? 'Expense' : 'Income'}
                  </Text>
                </View>
                {existingCategory?.isDefault && (
                  <View style={styles.defaultBadge}>
                    <Text style={styles.defaultBadgeText}>Default</Text>
                  </View>
                )}
              </View>
            </View>
          </Card>

          {/* Name Input */}
          <Input
            label="Category Name *"
            placeholder="e.g., Coffee, Freelance"
            value={name}
            onChangeText={(text) => {
              setName(text.slice(0, 25));
              if (nameError) setNameError(null);
            }}
            maxLength={25}
            error={nameError}
            rightElement={
              <Text style={styles.charCount}>{name.length}/25</Text>
            }
          />

          {/* Type Selector */}
          <View style={styles.section}>
            <View style={styles.labelRow}>
              <Text style={styles.sectionLabel}>Category Type</Text>
              {isTypeLocked && (
                <View style={styles.lockHint}>
                  <Lock size={12} color={Colors.textSecondary} />
                  <Text style={styles.lockHintText}>Locked for default</Text>
                </View>
              )}
            </View>
            <View style={styles.typeRow}>
              <Chip
                label="Expense"
                active={type === 'expense'}
                activeColor={Colors.expense}
                activeSoftColor={Colors.expenseSoft}
                onPress={
                  isTypeLocked
                    ? undefined
                    : () => {
                        setType('expense');
                        Haptics.selectionAsync().catch(() => {});
                      }
                }
                style={styles.typeChip}
              />
              <Chip
                label="Income"
                active={type === 'income'}
                activeColor={Colors.primary}
                activeSoftColor={Colors.primarySoft}
                onPress={
                  isTypeLocked
                    ? undefined
                    : () => {
                        setType('income');
                        Haptics.selectionAsync().catch(() => {});
                      }
                }
                style={styles.typeChip}
              />
            </View>
          </View>

          {/* Color Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Color</Text>
            <View style={styles.colorGrid}>
              {Colors.categoryColors.map((swatch) => {
                const selected = color === swatch;
                return (
                  <Pressable
                    key={swatch}
                    onPress={() => {
                      setColor(swatch);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    style={[
                      styles.colorSwatch,
                      { backgroundColor: swatch },
                      selected && styles.colorSwatchSelected,
                    ]}
                  >
                    {selected && <Check size={16} color={Colors.textInverse} strokeWidth={3} />}
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Icon Picker */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Icon</Text>
            <Card style={styles.iconPickerCard}>
              <ScrollView
                style={styles.iconScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
              >
                <View style={styles.iconGrid}>
                  {CATEGORY_ICONS.map((ic) => {
                    const selected = iconName === ic;
                    return (
                      <Pressable
                        key={ic}
                        onPress={() => {
                          setIconName(ic);
                          Haptics.selectionAsync().catch(() => {});
                        }}
                        style={[
                          styles.iconCell,
                          selected && {
                            backgroundColor: `${color}20`,
                            borderColor: color,
                          },
                        ]}
                        accessibilityLabel={`Select icon ${ic}`}
                      >
                        {renderCategoryIcon(
                          ic,
                          selected ? color : Colors.textSecondary,
                          20
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>
            </Card>
          </View>

          {/* Save Button */}
          <Button
            title={isEditing ? 'Save Changes' : 'Create Category'}
            onPress={handleSave}
            loading={saving}
          />

          {/* Delete / Archive for Custom Categories in Edit Mode */}
          {isEditing && existingCategory && !existingCategory.isDefault && (
            <Card style={styles.dangerCard}>
              {txCount > 0 && (
                <View style={styles.warningRow}>
                  <AlertTriangle size={16} color={Colors.warning} />
                  <Text style={styles.warningText}>
                    Used in {txCount} {pluralize(txCount, 'transaction')}. You can reassign them to
                    &ldquo;Other&rdquo; or archive to preserve history.
                  </Text>
                </View>
              )}
              <Button
                title={txCount > 0 ? 'Archive or Reassign Category' : 'Delete / Archive Category'}
                variant="destructive"
                onPress={handleArchivePress}
                disabled={saving}
                icon={<Archive size={18} color={Colors.expense} />}
              />
            </Card>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  flex: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
    backgroundColor: Colors.bgMain,
  },
  closeBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  pressed: {
    opacity: 0.8,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 80,
    gap: 14,
  },
  previewCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  previewCircle: {
    width: 54,
    height: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flex: 1,
    gap: 6,
  },
  previewName: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  previewMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  typePill: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 2,
    borderRadius: 100,
  },
  typePillText: {
    fontSize: 11,
    fontWeight: '600',
  },
  defaultBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: 100,
    backgroundColor: '#F3F6F2',
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  defaultBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  charCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
  section: {
    gap: Spacing.sm,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  lockHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  lockHintText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  typeRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  typeChip: {
    flex: 1,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 3,
    borderColor: Colors.textPrimary,
  },
  iconPickerCard: {
    padding: Spacing.md,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  iconScroll: {
    maxHeight: 220,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  iconCell: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#F8FAF8',
    borderWidth: 1,
    borderColor: '#EDF2EC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerCard: {
    gap: Spacing.md,
    borderRadius: 22,
    backgroundColor: '#FDF0ED',
    borderWidth: 1,
    borderColor: '#F9D8D0',
  },
  warningRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.warningSoft,
    padding: Spacing.md,
    borderRadius: Shapes.inputRadius,
  },
  warningText: {
    flex: 1,
    fontSize: 12,
    color: Colors.textPrimary,
    lineHeight: 18,
  },
});
