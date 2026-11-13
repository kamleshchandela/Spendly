/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

export const CATEGORY_ICONS = [
  'utensils', 'shopping-cart', 'car', 'fuel', 'shopping-bag', 'zap',
  'home', 'heart-pulse', 'book-open', 'film', 'plane', 'scissors',
  'smartphone', 'gift', 'package', 'briefcase', 'building-2', 'laptop',
  'trending-up', 'repeat', 'coffee', 'music', 'gamepad-2', 'dumbbell',
  'baby', 'dog', 'plant', 'wrench', 'shield', 'graduation-cap',
  'bus', 'train', 'bike', 'pizza', 'beer', 'shirt', 'watch',
  'camera', 'tv', 'wifi', 'printer', 'tool',
] as const;

export type CategoryIconName = typeof CATEGORY_ICONS[number];
