/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { forwardRef, useCallback, useMemo } from 'react';
import { StyleProp, StyleSheet, Text, View, ViewStyle } from 'react-native';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetBackdropProps,
  BottomSheetProps as GorhomBottomSheetProps,
  BottomSheetScrollView,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { Colors } from '../../theme/colors';
import { Shapes } from '../../theme/shapes';
import { Shadows } from '../../theme/shadows';
import { Spacing } from '../../theme/spacing';

export type BottomSheetRef = GorhomBottomSheet;

export interface AppBottomSheetProps
  extends Omit<
    GorhomBottomSheetProps,
    'backgroundStyle' | 'handleIndicatorStyle' | 'children'
  > {
  children: React.ReactNode;
  title?: string;
  snapPoints?: Array<string | number>;
  scrollable?: boolean;
  showBackdrop?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  backgroundStyle?: StyleProp<ViewStyle>;
  onClose?: () => void;
}

export const BottomSheet = forwardRef<GorhomBottomSheet, AppBottomSheetProps>(
  (
    {
      children,
      title,
      snapPoints,
      scrollable = false,
      showBackdrop = true,
      contentContainerStyle,
      backgroundStyle,
      index = -1,
      enablePanDownToClose = true,
      onClose,
      ...rest
    },
    ref
  ) => {
    const resolvedSnapPoints = useMemo(() => snapPoints ?? ['55%', '85%'], [snapPoints]);

    const renderBackdrop = useCallback(
      (props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          disappearsOnIndex={-1}
          appearsOnIndex={0}
          opacity={0.4}
          pressBehavior="close"
        />
      ),
      []
    );

    return (
      <GorhomBottomSheet
        ref={ref}
        index={index}
        snapPoints={resolvedSnapPoints}
        enablePanDownToClose={enablePanDownToClose}
        backdropComponent={showBackdrop ? renderBackdrop : undefined}
        backgroundStyle={[styles.background, backgroundStyle]}
        handleIndicatorStyle={styles.handleIndicator}
        handleStyle={styles.handle}
        style={styles.sheetShadow}
        onClose={onClose}
        {...rest}
      >
        {scrollable ? (
          <BottomSheetScrollView
            contentContainerStyle={[styles.content, contentContainerStyle]}
            showsVerticalScrollIndicator={false}
          >
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </BottomSheetScrollView>
        ) : (
          <BottomSheetView style={[styles.content, contentContainerStyle]}>
            {title ? <Text style={styles.title}>{title}</Text> : null}
            {children}
          </BottomSheetView>
        )}
      </GorhomBottomSheet>
    );
  }
);

BottomSheet.displayName = 'BottomSheet';

export { BottomSheetScrollView, BottomSheetView };
export default BottomSheet;

const styles = StyleSheet.create({
  sheetShadow: {
    ...Shadows.bottomSheet,
  },
  background: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: Shapes.bottomSheetRadius,
    borderTopRightRadius: Shapes.bottomSheetRadius,
  },
  handle: {
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  handleIndicator: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.borderStrong,
  },
  content: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: 54,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: Spacing.lg,
  },
});
