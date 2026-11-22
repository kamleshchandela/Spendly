/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ChevronLeft, Database, Lock, ShieldCheck, Smartphone } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { Shadows } from '../../theme/shadows';
import { Spacing } from '../../theme/spacing';
import { Card } from '../../components/common';

const POLICY_SECTIONS = [
  {
    icon: Smartphone,
    color: Colors.primary,
    bg: Colors.primarySoft,
    title: '100% Local-First Storage',
    body: 'Spendly stores all your wallets, transactions, budgets, categories, and recurring bills strictly on your device using an on-device SQLite database. We never upload your financial data to external servers.',
  },
  {
    icon: ShieldCheck,
    color: Colors.secondary,
    bg: Colors.secondarySoft,
    title: 'Zero Tracking or Ads',
    body: 'Spendly does not include third-party analytics SDKs, advertising trackers, or account registration requirements. Your spending habits belong solely to you.',
  },
  {
    icon: Lock,
    color: Colors.accentLavender,
    bg: Colors.accentLavenderSoft,
    title: 'Encrypted Backups',
    body: 'When you export a .spendly backup file, you may optionally protect it with a password. Backups are shared directly via your device share sheet so you stay in full control of where your copies live.',
  },
  {
    icon: Database,
    color: Colors.warning,
    bg: Colors.warningSoft,
    title: 'Full Data Ownership & Deletion',
    body: 'You can inspect your database record counts, export all records, or permanently wipe all stored data at any time from Settings under Data & Privacy.',
  },
];

export default function PrivacyPolicyScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backBtn, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <ChevronLeft size={20} color={Colors.textPrimary} />
        </Pressable>
        <Text style={styles.headerTitle}>Privacy Policy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.heroCard}>
          <View style={styles.heroIconCircle}>
            <ShieldCheck size={30} color={Colors.primary} />
          </View>
          <Text style={styles.heroTitle}>Your Money, Your Privacy</Text>
          <Text style={styles.heroSubtitle}>
            Spendly is built from the ground up as a calm, offline-first personal finance
            companion. Everything stays on your device.
          </Text>
        </Card>

        {POLICY_SECTIONS.map((sec) => {
          const IconComp = sec.icon;
          return (
            <Card key={sec.title} style={styles.policyCard}>
              <View style={styles.policyHeader}>
                <View style={[styles.iconBox, { backgroundColor: sec.bg }]}>
                  <IconComp size={18} color={sec.color} />
                </View>
                <Text style={styles.policyTitle}>{sec.title}</Text>
              </View>
              <Text style={styles.policyBody}>{sec.body}</Text>
            </Card>
          );
        })}

        <Text style={styles.footerNote}>
          Last updated: Spendly v1.0.0 · Local notifications are scheduled on-device only when you
          enable budget warnings or recurring bill reminders.
        </Text>
      </ScrollView>
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
  backBtn: {
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
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.3,
  },
  headerSpacer: {
    width: 42,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 100,
    gap: 14,
  },
  heroCard: {
    alignItems: 'center',
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 24,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  heroIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#E5F4EC',
    borderWidth: 1,
    borderColor: '#C6E8D5',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.xs,
  },
  heroTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.textPrimary,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  heroSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  policyCard: {
    gap: 10,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    padding: 16,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  policyTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  policyBody: {
    fontSize: 13,
    lineHeight: 20,
    color: Colors.textSecondary,
  },
  footerNote: {
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.72,
  },
});
