/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React from 'react';
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
  Coffee,
  Dog,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HeartPulse,
  Home,
  Laptop,
  Leaf,
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

type LucideIconComponent = React.ComponentType<{
  size?: number;
  color?: string;
  strokeWidth?: number;
}>;

const ICON_MAP: Record<string, LucideIconComponent> = {
  utensils: Utensils,
  'shopping-cart': ShoppingCart,
  car: Car,
  fuel: Fuel,
  'shopping-bag': ShoppingBag,
  zap: Zap,
  home: Home,
  'heart-pulse': HeartPulse,
  'book-open': BookOpen,
  film: Film,
  plane: Plane,
  scissors: Scissors,
  smartphone: Smartphone,
  gift: Gift,
  package: Package,
  briefcase: Briefcase,
  'building-2': Building2,
  laptop: Laptop,
  'trending-up': TrendingUp,
  repeat: Repeat,
  coffee: Coffee,
  music: Music,
  'gamepad-2': Gamepad2,
  dumbbell: Dumbbell,
  baby: Baby,
  dog: Dog,
  plant: Leaf,
  wrench: Wrench,
  shield: Shield,
  'graduation-cap': GraduationCap,
  bus: Bus,
  train: TrainFront,
  bike: Bike,
  pizza: Pizza,
  beer: Beer,
  shirt: Shirt,
  watch: Watch,
  camera: Camera,
  tv: Tv,
  wifi: Wifi,
  printer: Printer,
  tool: Wrench,
};

export function renderCategoryIcon(
  iconName?: string | null,
  size: number = 20,
  color: string = '#5BAF85'
): React.ReactNode {
  const Icon = (iconName && ICON_MAP[iconName]) || Tag;
  return <Icon size={size} color={color} strokeWidth={2} />;
}
