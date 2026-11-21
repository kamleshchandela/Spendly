/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
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
  Banknote,
  Briefcase,
  Check,
  Coins,
  CreditCard,
  Globe,
  Landmark,
  PiggyBank,
  Search,
  Shield,
  Wallet as WalletIcon,
  X,
} from 'lucide-react-native';
import { Button, Card, Chip, Input, LoadingState, SoftSwitch } from '../../components/common';
import { CURRENCIES, POPULAR_CURRENCIES } from '../../constants/currencies';
import { getDatabase } from '../../database/database';
import { WalletRepository } from '../../database/repositories/WalletRepository';
import { useSettingsStore } from '../../store/settingsStore';
import { useWalletStore } from '../../store/walletStore';
import { Colors, Shadows, Shapes, Spacing } from '../../theme';
import { WalletType } from '../../types/wallet.types';
import {
  formatCurrency,
  fromMinorUnits,
  getCurrencySymbol,
  toMinorUnits,
} from '../../utils/currencyUtils';
import { validateRequired } from '../../utils/validationUtils';

const WALLET_TYPES: Array<{ value: WalletType; label: string; defaultIcon: string }> = [
  { value: 'cash', label: 'Cash', defaultIcon: 'banknote' },
  { value: 'bank', label: 'Bank', defaultIcon: 'landmark' },
  { value: 'savings', label: 'Savings', defaultIcon: 'piggy-bank' },
  { value: 'credit', label: 'Credit', defaultIcon: 'credit-card' },
  { value: 'other', label: 'Other', defaultIcon: 'wallet' },
];

const WALLET_ICONS = [
  { id: 'wallet', label: 'Wallet' },
  { id: 'landmark', label: 'Bank' },
  { id: 'piggy-bank', label: 'Savings' },
  { id: 'credit-card', label: 'Card' },
  { id: 'banknote', label: 'Cash' },
  { id: 'briefcase', label: 'Business' },
  { id: 'coins', label: 'Coins' },
  { id: 'shield', label: 'Safe' },
] as const;

const renderWalletIcon = (iconName: string, color: string, size: number = 22) => {
  switch (iconName) {
    case 'landmark':
      return <Landmark size={size} color={color} />;
    case 'piggy-bank':
      return <PiggyBank size={size} color={color} />;
    case 'credit-card':
      return <CreditCard size={size} color={color} />;
    case 'banknote':
      return <Banknote size={size} color={color} />;
    case 'briefcase':
      return <Briefcase size={size} color={color} />;
    case 'coins':
      return <Coins size={size} color={color} />;
    case 'shield':
      return <Shield size={size} color={color} />;
    case 'wallet':
    default:
      return <WalletIcon size={size} color={color} />;
  }
};

export default function AddWalletModal() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEditing = Boolean(id);

  const settings = useSettingsStore((s) => s.settings);
  const loadWallets = useWalletStore((s) => s.loadWallets);

  const defaultCurrency = settings?.baseCurrency ?? 'INR';
  const numberFormat = settings?.numberFormat ?? 'indian';
  const decimalPlaces = settings?.decimalPlaces ?? 2;

  const [loading, setLoading] = useState(isEditing);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [type, setType] = useState<WalletType>('bank');
  const [openingBalanceText, setOpeningBalanceText] = useState('');
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [currencyCode, setCurrencyCode] = useState(defaultCurrency);
  const [color, setColor] = useState<string>(Colors.categoryColors[0]);
  const [iconName, setIconName] = useState<string>('landmark');
  const [includeInTotal, setIncludeInTotal] = useState(true);

  const [currencyModalVisible, setCurrencyModalVisible] = useState(false);
  const [currencySearch, setCurrencySearch] = useState('');

  useEffect(() => {
    if (!id) {
      setCurrencyCode(defaultCurrency);
      return;
    }

    const loadWallet = async () => {
      try {
        const db = await getDatabase();
        const repo = new WalletRepository(db);
        const existing = await repo.getById(id);
        if (existing) {
          setName(existing.name);
          setType(existing.type);
          setOpeningBalanceText(
            existing.openingBalanceMinor === 0
              ? ''
              : String(fromMinorUnits(existing.openingBalanceMinor))
          );
          setCurrencyCode(existing.currencyCode);
          setColor(existing.color);
          setIconName(existing.iconName);
          setIncludeInTotal(existing.includeInTotal);
        }
      } catch (error) {
        console.error('Failed to load wallet for edit:', error);
      } finally {
        setLoading(false);
      }
    };

    loadWallet();
  }, [id, defaultCurrency]);

  const parsedOpeningMinor = useMemo(() => {
    if (!openingBalanceText.trim()) return 0;
    const num = parseFloat(openingBalanceText.replace(/[^0-9.-]/g, ''));
    if (!Number.isFinite(num)) return 0;
    return toMinorUnits(num);
  }, [openingBalanceText]);

  const filteredCurrencies = useMemo(() => {
    const q = currencySearch.trim().toLowerCase();
    if (!q) return CURRENCIES;
    return CURRENCIES.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    );
  }, [currencySearch]);

  const handleSelectType = (nextType: WalletType) => {
    setType(nextType);
    if (!isEditing) {
      const matched = WALLET_TYPES.find((t) => t.value === nextType);
      if (matched) setIconName(matched.defaultIcon);
    }
    Haptics.selectionAsync().catch(() => {});
  };

  const handleSave = async () => {
    const trimmedName = name.trim();
    const err = validateRequired(trimmedName, 'Wallet name');
    if (err) {
      setNameError(err);
      return;
    }

    if (openingBalanceText.trim().length > 0) {
      const numeric = Number(openingBalanceText.replace(/,/g, ''));
      if (!Number.isFinite(numeric)) {
        setBalanceError('Please enter a valid opening balance');
        return;
      }
      if (Math.abs(numeric) > 999999999) {
        setBalanceError('Opening balance is too large');
        return;
      }
    }

    setNameError(null);
    setBalanceError(null);
    setSaving(true);

    try {
      const db = await getDatabase();
      const repo = new WalletRepository(db);

      if (isEditing && id) {
        await repo.update(id, {
          name: trimmedName,
          type,
          currencyCode,
          openingBalanceMinor: parsedOpeningMinor,
          color,
          iconName,
          includeInTotal,
        });
      } else {
        await repo.insert({
          name: trimmedName,
          type,
          currencyCode,
          openingBalanceMinor: parsedOpeningMinor,
          color,
          iconName,
          includeInTotal,
          isArchived: false,
        });
      }

      await loadWallets();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      router.back();
    } catch (error) {
      console.error('Failed to save wallet:', error);
      Alert.alert('Save Failed', 'Could not save wallet. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <LoadingState message="Loading wallet..." />
      </SafeAreaView>
    );
  }

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
          {isEditing ? 'Edit Wallet' : 'Add Wallet'}
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
          {/* Live Preview Card */}
          <Card style={styles.previewCard}>
            <View style={[styles.previewIcon, { backgroundColor: `${color}20` }]}>
              {renderWalletIcon(iconName, color, 24)}
            </View>
            <View style={styles.previewInfo}>
              <Text style={styles.previewName} numberOfLines={1}>
                {name.trim() || 'My Wallet'}
              </Text>
              <Text style={styles.previewType}>
                {WALLET_TYPES.find((t) => t.value === type)?.label} • {currencyCode}
              </Text>
            </View>
            <Text style={styles.previewBalance}>
              {formatCurrency(parsedOpeningMinor, currencyCode, numberFormat, decimalPlaces)}
            </Text>
          </Card>

          {/* Wallet Name */}
          <Input
            label="Wallet Name *"
            placeholder="e.g., HDFC Savings, Cash Wallet"
            value={name}
            onChangeText={(text) => {
              setName(text);
              if (nameError) setNameError(null);
            }}
            maxLength={40}
            error={nameError}
            returnKeyType="done"
          />

          {/* Wallet Type */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Wallet Type</Text>
            <View style={styles.chipsWrap}>
              {WALLET_TYPES.map((item) => (
                <Chip
                  key={item.value}
                  label={item.label}
                  active={type === item.value}
                  onPress={() => handleSelectType(item.value)}
                />
              ))}
            </View>
          </View>

          {/* Opening Balance */}
          <Input
            label="Opening Balance (optional)"
            placeholder="0.00"
            value={openingBalanceText}
            onChangeText={(text) => {
              const cleaned = text.replace(/[^0-9.-]/g, '');
              setOpeningBalanceText(cleaned);
              if (balanceError) setBalanceError(null);
            }}
            keyboardType="decimal-pad"
            error={balanceError}
            leftElement={
              <Text style={styles.currencyPrefix}>{getCurrencySymbol(currencyCode)}</Text>
            }
          />

          {/* Currency Selector */}
          <View style={styles.section}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionLabel}>Currency</Text>
              <Pressable
                onPress={() => setCurrencyModalVisible(true)}
                style={styles.moreBtn}
              >
                <Globe size={14} color={Colors.primary} />
                <Text style={styles.moreBtnText}>All currencies</Text>
              </Pressable>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.currencyRow}
            >
              {POPULAR_CURRENCIES.map((c) => {
                const active = currencyCode === c.code;
                return (
                  <Pressable
                    key={c.code}
                    onPress={() => {
                      setCurrencyCode(c.code);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    style={({ pressed }) => [
                      styles.currencyPill,
                      active && styles.currencyPillActive,
                      pressed && styles.pressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.currencyPillSymbolCircle,
                        active && styles.currencyPillSymbolCircleActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.currencyPillSymbolText,
                          active && styles.currencyPillSymbolTextActive,
                        ]}
                        numberOfLines={1}
                      >
                        {c.symbol}
                      </Text>
                    </View>
                    <Text
                      style={[
                        styles.currencyPillCode,
                        active && styles.currencyPillCodeActive,
                      ]}
                    >
                      {c.code}
                    </Text>
                  </Pressable>
                );
              })}
              {!POPULAR_CURRENCIES.some((c) => c.code === currencyCode) && (
                <Pressable
                  onPress={() => setCurrencyModalVisible(true)}
                  style={[styles.currencyPill, styles.currencyPillActive]}
                >
                  <View
                    style={[
                      styles.currencyPillSymbolCircle,
                      styles.currencyPillSymbolCircleActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyPillSymbolText,
                        styles.currencyPillSymbolTextActive,
                      ]}
                      numberOfLines={1}
                    >
                      {getCurrencySymbol(currencyCode).trim()}
                    </Text>
                  </View>
                  <Text style={[styles.currencyPillCode, styles.currencyPillCodeActive]}>
                    {currencyCode}
                  </Text>
                </Pressable>
              )}
            </ScrollView>
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
                    style={({ pressed }) => [
                      styles.colorSwatch,
                      { backgroundColor: swatch },
                      selected && styles.colorSwatchSelected,
                      pressed && styles.colorSwatchPressed,
                    ]}
                    accessibilityLabel={`Select color ${swatch}`}
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
            <View style={styles.iconGrid}>
              {WALLET_ICONS.map((ic) => {
                const selected = iconName === ic.id;
                return (
                  <Pressable
                    key={ic.id}
                    onPress={() => {
                      setIconName(ic.id);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    style={({ pressed }) => [
                      styles.iconTile,
                      selected && {
                        backgroundColor: `${color}12`,
                        borderColor: color,
                      },
                      pressed && styles.iconTilePressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.iconBox,
                        selected && { backgroundColor: `${color}22` },
                      ]}
                    >
                      {renderWalletIcon(
                        ic.id,
                        selected ? color : Colors.textSecondary,
                        22
                      )}
                    </View>
                    <Text
                      style={[
                        styles.iconTileLabel,
                        selected && { color, fontWeight: '700' },
                      ]}
                      numberOfLines={1}
                    >
                      {ic.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Include in Total Balance */}
          <Card style={styles.switchCard}>
            <View style={styles.switchInfo}>
              <Text style={styles.switchTitle}>Include in Total Balance</Text>
              <Text style={styles.switchSubtitle}>
                Count this wallet toward your home screen total balance
              </Text>
            </View>
            <SoftSwitch
              value={includeInTotal}
              onValueChange={setIncludeInTotal}
              accessibilityLabel="Include in Total Balance"
            />
          </Card>

          {/* Save Button */}
          <Button
            title={isEditing ? 'Save Changes' : 'Create Wallet'}
            onPress={handleSave}
            loading={saving}
            style={styles.saveBtn}
          />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* All Currencies Picker Modal */}
      <Modal
        visible={currencyModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCurrencyModalVisible(false)}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.header}>
            <Pressable
              onPress={() => setCurrencyModalVisible(false)}
              style={styles.closeBtn}
            >
              <X size={20} color={Colors.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Select Currency</Text>
            <View style={styles.headerSpacer} />
          </View>
          <View style={styles.modalSearchWrap}>
            <Input
              placeholder="Search currency (e.g. INR, USD, Euro)"
              value={currencySearch}
              onChangeText={setCurrencySearch}
              leftElement={<Search size={18} color={Colors.textSecondary} />}
            />
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            {filteredCurrencies.map((c) => {
              const active = c.code === currencyCode;
              return (
                <Pressable
                  key={c.code}
                  onPress={() => {
                    setCurrencyCode(c.code);
                    setCurrencyModalVisible(false);
                    setCurrencySearch('');
                  }}
                  style={[styles.currencyOption, active && styles.currencyOptionActive]}
                >
                  <View
                    style={[
                      styles.currencyBadgeCircle,
                      active && styles.currencyBadgeCircleActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyBadgeSymbol,
                        active && styles.currencyBadgeSymbolActive,
                      ]}
                      numberOfLines={1}
                      adjustsFontSizeToFit
                    >
                      {c.symbol}
                    </Text>
                  </View>
                  <View style={styles.currencyOptionInfo}>
                    <Text style={styles.currencyOptionCode}>{c.code}</Text>
                    <Text style={styles.currencyOptionName}>{c.name}</Text>
                  </View>
                  {active && (
                    <View style={styles.currencyCheckCircle}>
                      <Check size={14} color={Colors.textInverse} strokeWidth={2.5} />
                    </View>
                  )}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>
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
    gap: 18,
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
  previewIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInfo: {
    flex: 1,
    gap: 2,
  },
  previewName: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  previewType: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  previewBalance: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  section: {
    gap: 10,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  currencyPrefix: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  currencyRow: {
    gap: Spacing.sm,
    paddingVertical: 2,
  },
  currencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: '#EDF1EC',
    paddingLeft: 6,
    paddingRight: Spacing.md,
    paddingVertical: 6,
    gap: Spacing.xs + 2,
  },
  currencyPillActive: {
    backgroundColor: '#E5F4EC',
    borderColor: '#C6E8D5',
  },
  currencyPillSymbolCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgMain,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyPillSymbolCircleActive: {
    backgroundColor: Colors.bgCard,
  },
  currencyPillSymbolText: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.textSecondary,
  },
  currencyPillSymbolTextActive: {
    color: Colors.primary,
  },
  currencyPillCode: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  currencyPillCodeActive: {
    color: Colors.primary,
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  moreBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.primary,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    rowGap: 14,
    columnGap: 14,
    paddingVertical: 2,
  },
  colorSwatch: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorSwatchSelected: {
    borderWidth: 2.5,
    borderColor: '#102816',
    transform: [{ scale: 1.06 }],
  },
  colorSwatchPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.94 }],
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
  },
  iconTile: {
    width: '23%',
    aspectRatio: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: '#EDF2EC',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
  },
  iconTilePressed: {
    opacity: 0.82,
    transform: [{ scale: 0.95 }],
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  iconTileLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '500',
    textAlign: 'center',
    width: '100%',
  },
  switchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    borderRadius: 20,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  switchInfo: {
    flex: 1,
    gap: 2,
  },
  switchTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  switchSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  saveBtn: {
    marginTop: Spacing.xs,
  },
  modalSafe: {
    flex: 1,
    backgroundColor: Colors.bgMain,
  },
  modalSearchWrap: {
    paddingHorizontal: Spacing.xl,
    marginBottom: Spacing.sm,
  },
  modalList: {
    paddingHorizontal: Spacing.xl,
    paddingBottom: Spacing['3xl'],
    gap: 8,
  },
  currencyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  currencyOptionActive: {
    borderColor: '#C6E8D5',
    backgroundColor: '#E5F4EC',
  },
  currencyBadgeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F6F2',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  currencyBadgeCircleActive: {
    backgroundColor: Colors.bgCard,
  },
  currencyBadgeSymbol: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  currencyBadgeSymbolActive: {
    color: Colors.primary,
  },
  currencyCheckCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  currencyOptionInfo: {
    flex: 1,
  },
  currencyOptionCode: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  currencyOptionName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
});
