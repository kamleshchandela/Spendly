/**
 * Spendly - Personal Finance & Expense Tracker
 * Copyright (c) 2026 Spendly. All rights reserved.
 * 
 * PROPRIETARY & CONFIDENTIAL.
 * Unauthorized cloning, copying, distribution, modification, or commercial use
 * of this file and the Spendly codebase is strictly prohibited.
 */

import React, { useCallback, useState } from 'react';
import {
  Modal,
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
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  Circle,
  Clock,
  Download,
  Eye,
  EyeOff,
  FileText,
  HardDrive,
  Lock,
  RotateCcw,
  ShieldCheck,
  Upload,
  X,
  XCircle,
} from 'lucide-react-native';
import { Badge, Button, Card, Input, LoadingState, SoftSwitch } from '../../components/common';
import { getDatabase } from '../../database/database';
import { BackupRepository } from '../../database/repositories/BackupRepository';
import {
  ConflictAnalysisSummary,
  ConflictPolicy,
  EncryptedBackupEnvelope,
  ExportResult,
  ExportService,
  ImportExecutionResult,
  ImportService,
  ValidatedBackup,
} from '../../services/backup';
import { useBudgetStore } from '../../store/budgetStore';
import { useCategoryStore } from '../../store/categoryStore';
import { useSettingsStore } from '../../store/settingsStore';
import { useTransactionStore } from '../../store/transactionStore';
import { useWalletStore } from '../../store/walletStore';
import { Colors, Shadows, Shapes, Spacing } from '../../theme';
import { BackupHistory } from '../../types/backup.types';
import { formatDisplay, formatTime } from '../../utils/dateUtils';
import { pluralize } from '../../utils/formatUtils';

const CONFLICT_POLICIES: Array<{
  value: ConflictPolicy;
  label: string;
  description: string;
}> = [
  {
    value: 'keep_newer',
    label: 'Keep newer (Recommended)',
    description: 'Uses whichever record was updated most recently',
  },
  {
    value: 'keep_existing',
    label: 'Keep existing',
    description: 'Preserves your current device records on conflict',
  },
  {
    value: 'use_imported',
    label: 'Use imported',
    description: 'Overwrites differing local records with backup data',
  },
  {
    value: 'skip_conflicts',
    label: 'Skip all conflicts',
    description: 'Only adds brand-new records, ignores any conflicts',
  },
];

interface PendingImportPreview {
  fileName: string;
  backup: ValidatedBackup;
  analysis: ConflictAnalysisSummary;
}

export default function BackupScreen() {
  const router = useRouter();
  const settings = useSettingsStore((s) => s.settings);
  const updateSetting = useSettingsStore((s) => s.updateSetting);
  const loadSettings = useSettingsStore((s) => s.loadSettings);
  const loadWallets = useWalletStore((s) => s.loadWallets);
  const loadCategories = useCategoryStore((s) => s.loadCategories);
  const loadTransactions = useTransactionStore((s) => s.loadTransactions);
  const loadBudgets = useBudgetStore((s) => s.loadBudgets);

  // History state
  const [history, setHistory] = useState<BackupHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Export state
  const [encryptEnabled, setEncryptEnabled] = useState(settings?.backupEncrypt ?? false);
  const [exportPassword, setExportPassword] = useState('');
  const [showExportPassword, setShowExportPassword] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [lastExport, setLastExport] = useState<ExportResult | null>(null);

  // Import state
  const [pickingFile, setPickingFile] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [pendingPreview, setPendingPreview] = useState<PendingImportPreview | null>(null);
  const [selectedPolicy, setSelectedPolicy] = useState<ConflictPolicy>('keep_newer');
  const [executingImport, setExecutingImport] = useState(false);
  const [importSummary, setImportSummary] = useState<{
    mode: 'merge' | 'replace';
    fileName: string;
    result: ImportExecutionResult;
  } | null>(null);

  // Encrypted import password modal
  const [pendingEncrypted, setPendingEncrypted] = useState<{
    fileName: string;
    envelope: EncryptedBackupEnvelope;
  } | null>(null);
  const [decryptPassword, setDecryptPassword] = useState('');
  const [showDecryptPassword, setShowDecryptPassword] = useState(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [decrypting, setDecrypting] = useState(false);

  // Destructive Replace confirmation modal
  const [replaceModalVisible, setReplaceModalVisible] = useState(false);
  const [replaceConfirmText, setReplaceConfirmText] = useState('');

  const fetchHistory = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    try {
      const db = await getDatabase();
      const repo = new BackupRepository(db);
      const rows = await repo.getAll();
      setHistory(rows);
    } catch (error) {
      console.error('Failed to load backup history:', error);
    } finally {
      setLoadingHistory(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchHistory();
    }, [fetchHistory])
  );

  const refreshAllStores = async () => {
    await Promise.all([
      loadSettings(),
      loadWallets(),
      loadCategories(),
      loadTransactions(),
      loadBudgets(),
      fetchHistory(),
    ]);
  };

  const handleToggleEncrypt = async (val: boolean) => {
    setEncryptEnabled(val);
    if (!val) setExportPassword('');
    try {
      await updateSetting('backupEncrypt', val);
    } catch {
      // ignore non-critical setting persistence error
    }
  };

  const handleExport = async () => {
    if (encryptEnabled && exportPassword.trim().length < 4) {
      Alert.alert(
        'Password Required',
        'Please enter a password of at least 4 characters to encrypt your backup.'
      );
      return;
    }

    setExporting(true);
    try {
      const result = await ExportService.createAndShareBackup({
        password: encryptEnabled ? exportPassword.trim() : undefined,
        share: true,
      });
      setLastExport(result);
      await fetchHistory();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      console.error('Export error:', error);
      const message =
        error instanceof Error ? error.message : 'Unable to create backup. Please try again.';
      Alert.alert('Export Failed', message);
      await fetchHistory();
    } finally {
      setExporting(false);
    }
  };

  const handlePickImportFile = async () => {
    setImportError(null);
    setImportSummary(null);
    setPickingFile(true);

    try {
      const result = await ImportService.pickBackupFile();
      if (result.canceled) {
        return;
      }

      if ('error' in result) {
        setImportError(result.error);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
        return;
      }

      if (result.needsPassword) {
        setPendingEncrypted({
          fileName: result.fileName,
          envelope: result.envelope,
        });
        setDecryptPassword('');
        setDecryptError(null);
        return;
      }

      setPendingPreview({
        fileName: result.fileName,
        backup: result.backup,
        analysis: result.analysis,
      });
      setSelectedPolicy('keep_newer');
      Haptics.selectionAsync().catch(() => {});
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Unable to read the selected backup file.';
      setImportError(msg);
    } finally {
      setPickingFile(false);
    }
  };

  const handleDecryptBackup = async () => {
    if (!pendingEncrypted) return;
    if (!decryptPassword.trim()) {
      setDecryptError('Please enter the backup password.');
      return;
    }

    setDecrypting(true);
    setDecryptError(null);
    try {
      const { backup, analysis } = await ImportService.decryptAndAnalyzeBackup(
        pendingEncrypted.envelope,
        decryptPassword
      );
      setPendingPreview({
        fileName: pendingEncrypted.fileName,
        backup,
        analysis,
      });
      setPendingEncrypted(null);
      setDecryptPassword('');
      setSelectedPolicy('keep_newer');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const msg =
        error instanceof Error ? error.message : 'Incorrect password. Please try again.';
      setDecryptError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setDecrypting(false);
    }
  };

  const handleExecuteMerge = async () => {
    if (!pendingPreview) return;
    setExecutingImport(true);
    setImportError(null);
    try {
      const result = await ImportService.executeMergeImport(
        pendingPreview.backup,
        selectedPolicy,
        pendingPreview.fileName
      );
      await refreshAllStores();
      setImportSummary({
        mode: 'merge',
        fileName: pendingPreview.fileName,
        result,
      });
      setPendingPreview(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Import failed. Your existing data was left untouched.';
      setImportError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setExecutingImport(false);
    }
  };

  const handleExecuteReplace = async () => {
    if (!pendingPreview) return;
    if (replaceConfirmText.trim() !== 'REPLACE') return;

    setReplaceModalVisible(false);
    setReplaceConfirmText('');
    setExecutingImport(true);
    setImportError(null);
    try {
      const result = await ImportService.executeRestoreReplace(
        pendingPreview.backup,
        pendingPreview.fileName
      );
      await refreshAllStores();
      setImportSummary({
        mode: 'replace',
        fileName: pendingPreview.fileName,
        result,
      });
      setPendingPreview(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Restore failed and was rolled back. Your existing data is safe.';
      setImportError(msg);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    } finally {
      setExecutingImport(false);
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
        <Text style={styles.headerTitle}>Backup & Restore</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchHistory(true)}
            tintColor={Colors.primary}
          />
        }
      >
        {/* Local-first Privacy Banner */}
        <View style={styles.privacyBanner}>
          <ShieldCheck size={20} color={Colors.primary} />
          <Text style={styles.privacyText}>
            100% offline & private. Export a `.spendly` file anytime and save it to Google Drive,
            iCloud, email, or local storage.
          </Text>
        </View>

        {/* Export Data Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconCircle, { backgroundColor: Colors.primarySoft }]}>
              <Upload size={20} color={Colors.primary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Export Data</Text>
              <Text style={styles.cardSubtitle}>
                All wallets, categories, transactions, budgets & settings
              </Text>
            </View>
          </View>

          <View style={styles.encryptToggleRow}>
            <View style={styles.encryptInfo}>
              <View style={styles.encryptTitleRow}>
                <Lock size={15} color={Colors.textPrimary} />
                <Text style={styles.encryptTitle}>Encrypt backup with password</Text>
              </View>
              <Text style={styles.encryptSubtitle}>
                Protects your backup file with password encryption
              </Text>
            </View>
            <SoftSwitch
              value={encryptEnabled}
              onValueChange={handleToggleEncrypt}
              accessibilityLabel="Encrypt backup with password"
            />
          </View>

          {encryptEnabled && (
            <Input
              label="Backup Password"
              placeholder="Enter password (min 4 characters)"
              value={exportPassword}
              onChangeText={setExportPassword}
              secureTextEntry={!showExportPassword}
              autoCapitalize="none"
              autoCorrect={false}
              rightElement={
                <Pressable
                  onPress={() => setShowExportPassword((prev) => !prev)}
                  hitSlop={8}
                >
                  {showExportPassword ? (
                    <EyeOff size={18} color={Colors.textSecondary} />
                  ) : (
                    <Eye size={18} color={Colors.textSecondary} />
                  )}
                </Pressable>
              }
            />
          )}

          <Button
            title={exporting ? 'Creating Backup...' : 'Export & Share Backup (.spendly)'}
            onPress={handleExport}
            loading={exporting}
            icon={<Upload size={18} color={Colors.textInverse} />}
          />

          {lastExport && (
            <View style={styles.successBox}>
              <CheckCircle2 size={18} color={Colors.primary} />
              <View style={styles.successBoxText}>
                <Text style={styles.successTitle}>Backup created successfully</Text>
                <Text style={styles.successMeta}>
                  {lastExport.fileName} • {lastExport.totalRecords}{' '}
                  {pluralize(lastExport.totalRecords, 'record')}
                  {lastExport.encrypted ? ' • Encrypted' : ''}
                </Text>
              </View>
            </View>
          )}
        </Card>

        {/* Import / Restore Card */}
        <Card style={styles.sectionCard}>
          <View style={styles.cardHeaderRow}>
            <View style={[styles.cardIconCircle, { backgroundColor: Colors.secondarySoft }]}>
              <Download size={20} color={Colors.secondary} />
            </View>
            <View style={styles.cardHeaderText}>
              <Text style={styles.cardTitle}>Import & Restore</Text>
              <Text style={styles.cardSubtitle}>
                Merge records safely or restore a full backup snapshot
              </Text>
            </View>
          </View>

          <Button
            title={pickingFile ? 'Reading File...' : 'Import Backup File (.spendly)'}
            variant="secondary"
            onPress={handlePickImportFile}
            loading={pickingFile}
            disabled={executingImport}
            icon={<FileText size={18} color={Colors.textPrimary} />}
          />

          {importError && (
            <View style={styles.errorBox}>
              <XCircle size={18} color={Colors.expense} />
              <Text style={styles.errorBoxText}>{importError}</Text>
            </View>
          )}

          {/* Import Preview Panel */}
          {pendingPreview && (
            <View style={styles.previewBox}>
              <View style={styles.previewHeader}>
                <View style={styles.previewTitleWrap}>
                  <Text style={styles.previewTitle}>Import Preview</Text>
                  <Text style={styles.previewFileName} numberOfLines={1}>
                    {pendingPreview.fileName}
                  </Text>
                </View>
                <Pressable
                  onPress={() => setPendingPreview(null)}
                  hitSlop={8}
                  style={styles.clearPreviewBtn}
                >
                  <X size={16} color={Colors.textSecondary} />
                </Pressable>
              </View>

              {/* Manifest Meta */}
              <View style={styles.manifestMetaRow}>
                <Text style={styles.manifestMetaText}>
                  Backup Date:{' '}
                  {pendingPreview.backup.manifest.createdAt
                    ? formatDisplay(pendingPreview.backup.manifest.createdAt, 'dd MMM yyyy, h:mm a')
                    : 'Unknown'}
                </Text>
                <Text style={styles.manifestMetaText}>
                  App v{pendingPreview.backup.manifest.appVersion}
                </Text>
              </View>

              {/* Record Counts */}
              <View style={styles.countsGrid}>
                <View style={styles.countChip}>
                  <Text style={styles.countValue}>
                    {pendingPreview.backup.data.transactions.length}
                  </Text>
                  <Text style={styles.countLabel}>Transactions</Text>
                </View>
                <View style={styles.countChip}>
                  <Text style={styles.countValue}>
                    {pendingPreview.backup.data.wallets.length}
                  </Text>
                  <Text style={styles.countLabel}>Wallets</Text>
                </View>
                <View style={styles.countChip}>
                  <Text style={styles.countValue}>
                    {pendingPreview.backup.data.categories.length}
                  </Text>
                  <Text style={styles.countLabel}>Categories</Text>
                </View>
                <View style={styles.countChip}>
                  <Text style={styles.countValue}>
                    {pendingPreview.backup.data.budgets.length}
                  </Text>
                  <Text style={styles.countLabel}>Budgets</Text>
                </View>
                <View style={styles.countChip}>
                  <Text style={styles.countValue}>
                    {pendingPreview.backup.data.recurring_payments.length}
                  </Text>
                  <Text style={styles.countLabel}>Recurring</Text>
                </View>
              </View>

              {/* Conflict Analysis */}
              <View style={styles.analysisRow}>
                <View style={[styles.analysisBadge, { backgroundColor: Colors.primarySoft }]}>
                  <CheckCircle2 size={15} color={Colors.primary} />
                  <Text style={[styles.analysisNum, { color: Colors.primary }]}>
                    {pendingPreview.analysis.newCount}
                  </Text>
                  <Text style={styles.analysisLabel}>New</Text>
                </View>
                <View style={[styles.analysisBadge, { backgroundColor: Colors.secondarySoft }]}>
                  <Circle size={15} color={Colors.secondary} />
                  <Text style={[styles.analysisNum, { color: Colors.secondary }]}>
                    {pendingPreview.analysis.identicalCount}
                  </Text>
                  <Text style={styles.analysisLabel}>Identical</Text>
                </View>
                <View style={[styles.analysisBadge, { backgroundColor: Colors.warningSoft }]}>
                  <AlertTriangle size={15} color={Colors.warning} />
                  <Text style={[styles.analysisNum, { color: Colors.warning }]}>
                    {pendingPreview.analysis.conflictCount}
                  </Text>
                  <Text style={styles.analysisLabel}>Differing</Text>
                </View>
              </View>

              {/* Conflict Policy Picker */}
              <View style={styles.policySection}>
                <Text style={styles.policyTitle}>Conflict Resolution Policy</Text>
                {CONFLICT_POLICIES.map((opt) => {
                  const active = selectedPolicy === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => {
                        setSelectedPolicy(opt.value);
                        Haptics.selectionAsync().catch(() => {});
                      }}
                      style={[
                        styles.policyOption,
                        active && styles.policyOptionActive,
                      ]}
                    >
                      <View
                        style={[
                          styles.radioOuter,
                          active && styles.radioOuterActive,
                        ]}
                      >
                        {active && <View style={styles.radioInner} />}
                      </View>
                      <View style={styles.policyOptionText}>
                        <Text style={styles.policyOptionLabel}>{opt.label}</Text>
                        <Text style={styles.policyOptionDesc}>{opt.description}</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </View>

              {/* Merge & Destructive Replace Actions */}
              <View style={styles.importActions}>
                <Button
                  title={executingImport ? 'Importing...' : 'Import & Merge'}
                  onPress={handleExecuteMerge}
                  loading={executingImport}
                  icon={<RotateCcw size={17} color={Colors.textInverse} />}
                />
                <Button
                  title="Restore & Replace All"
                  variant="destructive"
                  onPress={() => {
                    setReplaceConfirmText('');
                    setReplaceModalVisible(true);
                  }}
                  disabled={executingImport}
                  icon={<AlertTriangle size={17} color={Colors.expense} />}
                />
              </View>
            </View>
          )}

          {/* Post-Import Summary Card */}
          {importSummary && (
            <View style={styles.summaryBox}>
              <View style={styles.summaryHeader}>
                <CheckCircle2 size={20} color={Colors.primary} />
                <View style={styles.summaryHeaderText}>
                  <Text style={styles.summaryTitle}>
                    {importSummary.mode === 'replace'
                      ? 'Full Restore Complete'
                      : 'Import & Merge Complete'}
                  </Text>
                  <Text style={styles.summarySubtext} numberOfLines={1}>
                    {importSummary.fileName}
                  </Text>
                </View>
              </View>

              <View style={styles.summaryStatsGrid}>
                <View style={styles.summaryStat}>
                  <CheckCircle2 size={14} color={Colors.primary} />
                  <Text style={[styles.summaryStatNum, { color: Colors.primary }]}>
                    {importSummary.result.inserted}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Inserted</Text>
                </View>
                <View style={styles.summaryStat}>
                  <Circle size={14} color={Colors.textSecondary} />
                  <Text style={[styles.summaryStatNum, { color: Colors.textSecondary }]}>
                    {importSummary.result.skipped}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Skipped</Text>
                </View>
                <View style={styles.summaryStat}>
                  <RotateCcw size={14} color={Colors.secondary} />
                  <Text style={[styles.summaryStatNum, { color: Colors.secondary }]}>
                    {importSummary.result.conflictsResolved}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Resolved</Text>
                </View>
                <View style={styles.summaryStat}>
                  <XCircle size={14} color={Colors.expense} />
                  <Text style={[styles.summaryStatNum, { color: Colors.expense }]}>
                    {importSummary.result.failed}
                  </Text>
                  <Text style={styles.summaryStatLabel}>Failed</Text>
                </View>
              </View>
            </View>
          )}
        </Card>

        {/* Backup History Section */}
        <View style={styles.historyHeader}>
          <Text style={styles.sectionHeading}>Backup History</Text>
          <Text style={styles.historyCount}>
            {history.length} {pluralize(history.length, 'entry', 'entries')}
          </Text>
        </View>

        {loadingHistory ? (
          <LoadingState size="small" message="Loading history..." />
        ) : history.length === 0 ? (
          <Card style={styles.emptyHistoryCard}>
            <HardDrive size={26} color={Colors.textDisabled} />
            <Text style={styles.emptyHistoryTitle}>No backups recorded yet</Text>
            <Text style={styles.emptyHistorySubtext}>
              Your exports and imports will appear here for easy reference.
            </Text>
          </Card>
        ) : (
          <Card style={styles.historyCard}>
            {history.map((item, idx) => (
              <View
                key={item.id}
                style={[styles.historyRow, idx > 0 && styles.historyDivider]}
              >
                <View style={styles.historyRowTop}>
                  <Text style={styles.historyFileName} numberOfLines={1}>
                    {item.fileName}
                  </Text>
                  <Badge
                    status={item.status === 'success' ? 'on-track' : 'over-budget'}
                    label={item.status === 'success' ? 'Success' : 'Failed'}
                  />
                </View>
                <View style={styles.historyRowBottom}>
                  <View style={styles.historyMetaItem}>
                    <Clock size={12} color={Colors.textSecondary} />
                    <Text style={styles.historyMetaText}>
                      {formatDisplay(item.backupDate, 'dd MMM yyyy')} •{' '}
                      {formatTime(item.backupDate)}
                    </Text>
                  </View>
                  <Text style={styles.historyMetaText}>
                    {item.recordCount} {pluralize(item.recordCount, 'record')}
                  </Text>
                </View>
                {item.note ? (
                  <Text style={styles.historyNote} numberOfLines={2}>
                    {item.note}
                  </Text>
                ) : null}
              </View>
            ))}
          </Card>
        )}
      </ScrollView>

      {/* Password Modal for Encrypted Backups */}
      <Modal
        visible={Boolean(pendingEncrypted)}
        transparent
        animationType="fade"
        onRequestClose={() => setPendingEncrypted(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <Lock size={18} color={Colors.primary} />
                <Text style={styles.modalTitle}>Encrypted Backup</Text>
              </View>
              <Pressable onPress={() => setPendingEncrypted(null)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>
            <Text style={styles.modalSubtitle}>
              Enter the password used to encrypt &ldquo;{pendingEncrypted?.fileName}&rdquo;.
            </Text>
            <Input
              label="Password"
              placeholder="Enter backup password"
              value={decryptPassword}
              onChangeText={(text) => {
                setDecryptPassword(text);
                if (decryptError) setDecryptError(null);
              }}
              secureTextEntry={!showDecryptPassword}
              autoCapitalize="none"
              autoCorrect={false}
              error={decryptError}
              rightElement={
                <Pressable
                  onPress={() => setShowDecryptPassword((prev) => !prev)}
                  hitSlop={8}
                >
                  {showDecryptPassword ? (
                    <EyeOff size={18} color={Colors.textSecondary} />
                  ) : (
                    <Eye size={18} color={Colors.textSecondary} />
                  )}
                </Pressable>
              }
            />
            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setPendingEncrypted(null)}
                fullWidth={false}
                style={styles.modalBtnHalf}
              />
              <Button
                title="Unlock"
                onPress={handleDecryptBackup}
                loading={decrypting}
                fullWidth={false}
                style={styles.modalBtnHalf}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Destructive Replace All Confirmation Modal */}
      <Modal
        visible={replaceModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setReplaceModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalTitleRow}>
                <AlertTriangle size={20} color={Colors.expense} />
                <Text style={[styles.modalTitle, { color: Colors.expense }]}>
                  Replace All Local Data?
                </Text>
              </View>
              <Pressable onPress={() => setReplaceModalVisible(false)} hitSlop={8}>
                <X size={20} color={Colors.textSecondary} />
              </Pressable>
            </View>

            <Text style={styles.modalSubtitle}>
              This will permanently delete all current wallets, categories, transactions, budgets,
              and recurring payments on this device and replace them with the selected backup.
            </Text>

            <Input
              label='Type "REPLACE" to confirm'
              placeholder="REPLACE"
              value={replaceConfirmText}
              onChangeText={setReplaceConfirmText}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            <View style={styles.modalButtons}>
              <Button
                title="Cancel"
                variant="secondary"
                onPress={() => setReplaceModalVisible(false)}
                fullWidth={false}
                style={styles.modalBtnHalf}
              />
              <Button
                title="Replace All"
                variant="destructive"
                onPress={handleExecuteReplace}
                disabled={replaceConfirmText.trim() !== 'REPLACE'}
                fullWidth={false}
                style={styles.modalBtnHalf}
              />
            </View>
          </View>
        </View>
      </Modal>
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
  headerSpacer: {
    width: 42,
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
  pressed: {
    opacity: 0.8,
  },
  scrollContent: {
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xs,
    paddingBottom: 100,
    gap: 16,
  },
  privacyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: '#E5F4EC',
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C6E8D5',
  },
  privacyText: {
    flex: 1,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.textPrimary,
  },
  sectionCard: {
    gap: 14,
    borderRadius: 22,
    backgroundColor: Colors.bgCard,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    padding: 18,
    elevation: 2,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 8,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  cardIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  encryptToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.md,
    backgroundColor: '#F3F6F2',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  encryptInfo: {
    flex: 1,
    gap: 2,
  },
  encryptTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  encryptTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  encryptSubtitle: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  successBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    backgroundColor: '#E5F4EC',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#C6E8D5',
  },
  successBoxText: {
    flex: 1,
    gap: 2,
  },
  successTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.primary,
  },
  successMeta: {
    fontSize: 12,
    color: Colors.textPrimary,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.expenseSoft,
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FCDAD7',
  },
  errorBoxText: {
    flex: 1,
    fontSize: 13,
    color: Colors.expense,
    fontWeight: '500',
  },
  previewBox: {
    backgroundColor: '#F8FAF8',
    borderRadius: 18,
    padding: 16,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  previewTitleWrap: {
    flex: 1,
  },
  previewTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  previewFileName: {
    fontSize: 12,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  clearPreviewBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
  },
  manifestMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  manifestMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  countsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs + 2,
  },
  countChip: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    minWidth: '30%',
    flexGrow: 1,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  countValue: {
    fontSize: 16,
    fontWeight: '700',
    color: Colors.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  countLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  analysisRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  analysisBadge: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  analysisNum: {
    fontSize: 17,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  analysisLabel: {
    fontSize: 11,
    color: Colors.textSecondary,
    fontWeight: '600',
  },
  policySection: {
    gap: Spacing.xs + 2,
  },
  policyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  policyOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  policyOptionActive: {
    borderColor: '#C6E8D5',
    backgroundColor: '#E5F4EC',
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Colors.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOuterActive: {
    borderColor: Colors.primary,
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: Colors.primary,
  },
  policyOptionText: {
    flex: 1,
  },
  policyOptionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  policyOptionDesc: {
    fontSize: 11,
    color: Colors.textSecondary,
    marginTop: 1,
  },
  importActions: {
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  summaryBox: {
    backgroundColor: '#E5F4EC',
    borderRadius: 18,
    padding: 16,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#C6E8D5',
  },
  summaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  summaryHeaderText: {
    flex: 1,
  },
  summaryTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.primary,
  },
  summarySubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  summaryStatsGrid: {
    flexDirection: 'row',
    gap: Spacing.xs + 2,
  },
  summaryStat: {
    flex: 1,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: '#EDF1EC',
  },
  summaryStatNum: {
    fontSize: 16,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  summaryStatLabel: {
    fontSize: 10,
    color: Colors.textSecondary,
    fontWeight: '600',
    marginTop: 2,
  },
  historyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    marginBottom: -6,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  historyCount: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  emptyHistoryCard: {
    alignItems: 'center',
    paddingVertical: Spacing['2xl'],
    gap: Spacing.xs + 2,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#EDF2EC',
  },
  emptyHistoryTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
    marginTop: Spacing.xs,
  },
  emptyHistorySubtext: {
    fontSize: 12,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 260,
  },
  historyCard: {
    padding: 0,
    overflow: 'hidden',
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
  historyRow: {
    padding: 16,
    gap: 6,
  },
  historyDivider: {
    borderTopWidth: 1,
    borderTopColor: '#F0F4EF',
  },
  historyRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.sm,
  },
  historyFileName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  historyRowBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  historyMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  historyMetaText: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  historyNote: {
    fontSize: 12,
    color: Colors.textSecondary,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(18, 28, 22, 0.45)',
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.bgCard,
    borderRadius: 24,
    padding: 22,
    gap: Spacing.md,
    borderWidth: 1,
    borderColor: '#EDF2EC',
    ...Shadows.bottomSheet,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  modalSubtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    lineHeight: 19,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  modalBtnHalf: {
    flex: 1,
  },
});
