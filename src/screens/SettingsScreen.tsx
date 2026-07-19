// src/screens/SettingsScreen.tsx
// Appearance (system/light/dark), bid defaults (your numbers), backup
// export/import (never gated), Pro section.

import { useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { exportBackup, pickBackup } from '../backup';
import { replaceAll } from '../db';
import { parseMoneyToCents } from '../models';
import { ThemeMode, useSettings } from '../SettingsContext';
import { useProAccess, isFailOpen, purchasePro, restorePurchases } from '../proAccess';
import { FREE_CLIENTS } from '../revenuecat';
import { Palette, useTheme } from '../theme';

interface Props {
  onBack: () => void;
}

const THEME_CHOICES: { mode: ThemeMode; label: string }[] = [
  { mode: 'system', label: 'System' },
  { mode: 'light', label: 'Light' },
  { mode: 'dark', label: 'Dark' },
];

export default function SettingsScreen({ onBack }: Props) {
  const { settings, update } = useSettings();
  const pro = useProAccess();
  const { colors: c, statusBarStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [busy, setBusy] = useState(false);
  const [laborText, setLaborText] = useState((settings.laborRateCents / 100).toString());
  const [prodText, setProdText] = useState(settings.prodRateSqftHr.toString());

  const saveLabor = () => {
    const cents = parseMoneyToCents(laborText);
    if (cents != null && cents > 0) update({ laborRateCents: cents });
    else setLaborText((settings.laborRateCents / 100).toString());
  };

  const saveProd = () => {
    const n = Number(prodText.replace(/[^0-9]/g, ''));
    if (n > 0) update({ prodRateSqftHr: n });
    else setProdText(settings.prodRateSqftHr.toString());
  };

  const doExport = async () => {
    setBusy(true);
    try {
      await exportBackup();
    } catch (e: any) {
      Alert.alert('Export failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const doImport = async () => {
    setBusy(true);
    try {
      const backup = await pickBackup();
      if (!backup) return;
      Alert.alert(
        'Restore backup?',
        `This replaces everything in DayPorter with ${backup.clients.length} client(s) from the file. There is no undo.`,
        [
          {
            text: 'Replace all',
            style: 'destructive',
            onPress: () => {
              replaceAll(backup);
              Alert.alert('Restored', 'Backup loaded.');
            },
          },
          { text: 'Cancel', style: 'cancel' },
        ],
      );
    } catch (e: any) {
      Alert.alert('Import failed', String(e?.message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const buyPro = () =>
    purchasePro()
      .then((ok) => ok && Alert.alert('Thanks!', 'Unlimited clients unlocked.'))
      .catch((e) => Alert.alert('Purchase failed', String(e?.message ?? e)));

  const restore = () =>
    restorePurchases()
      .then((ok) =>
        Alert.alert(ok ? 'Restored' : 'Nothing to restore', ok ? 'Pro is active.' : undefined),
      )
      .catch((e) => Alert.alert('Restore failed', String(e?.message ?? e)));

  const pctStepper = (
    label: string,
    value: number,
    key: 'suppliesPct' | 'marginPct',
    max: number,
  ) => (
    <View style={styles.rowBetween}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable hitSlop={8} onPress={() => update({ [key]: Math.max(0, value - 1) })}>
          <Text style={styles.stepBtn}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}%</Text>
        <Pressable hitSlop={8} onPress={() => update({ [key]: Math.min(max, value + 1) })}>
          <Text style={styles.stepBtn}>+</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.scroll}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar style={statusBarStyle} />
      <View style={styles.topBar}>
        <Pressable onPress={onBack} hitSlop={8}>
          <Text style={styles.topLink}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Settings</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Appearance</Text>
        <View style={styles.chipRow}>
          {THEME_CHOICES.map(({ mode, label }) => {
            const on = settings.themeMode === mode;
            return (
              <Pressable
                key={mode}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => update({ themeMode: mode })}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.hint}>System follows your phone's light/dark setting.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bid defaults</Text>
        <Text style={styles.hint}>New bids start from these numbers.</Text>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Loaded labor $/hr</Text>
          <TextInput
            style={styles.numInput}
            value={laborText}
            onChangeText={setLaborText}
            onEndEditing={saveLabor}
            keyboardType="decimal-pad"
          />
        </View>
        <View style={styles.rowBetween}>
          <Text style={styles.label}>Production sqft/hr</Text>
          <TextInput
            style={styles.numInput}
            value={prodText}
            onChangeText={setProdText}
            onEndEditing={saveProd}
            keyboardType="number-pad"
          />
        </View>
        {pctStepper('Supplies (% of labor)', settings.suppliesPct, 'suppliesPct', 50)}
        {pctStepper('Margin (% of price)', settings.marginPct, 'marginPct', 90)}
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Backup</Text>
        <Text style={styles.hint}>
          Everything stays on this phone. Backups are plain JSON you keep wherever you like.
        </Text>
        <Pressable style={styles.btn} onPress={doExport} disabled={busy}>
          <Text style={styles.btnText}>Export backup</Text>
        </Pressable>
        <Pressable style={styles.btn} onPress={doImport} disabled={busy}>
          <Text style={styles.btnText}>Import backup</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>DayPorter Pro</Text>
        {pro ? (
          <Text style={styles.hint}>
            {isFailOpen()
              ? 'Pro is unlocked in this build.'
              : 'Unlimited clients — thanks for the support.'}
          </Text>
        ) : (
          <>
            <Text style={styles.hint}>
              One-time purchase for unlimited clients. The first {FREE_CLIENTS} are free,
              and sites, contracts, bids, and export are free forever.
            </Text>
            <Pressable style={styles.btn} onPress={buyPro}>
              <Text style={styles.btnText}>Unlock unlimited clients</Text>
            </Pressable>
          </>
        )}
        <Pressable style={styles.btn} onPress={restore}>
          <Text style={styles.btnText}>Restore purchases</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: Palette) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: c.bg },
    scroll: { padding: 16, paddingTop: 0, paddingBottom: 48 },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingTop: 64,
      paddingBottom: 12,
    },
    title: { fontSize: 17, fontWeight: '600', color: c.textPrimary },
    topLink: { color: c.textMuted, fontSize: 14, width: 44 },
    card: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.cardBorder,
      padding: 14,
      marginBottom: 14,
    },
    sectionTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary, marginBottom: 4 },
    rowBetween: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 10,
    },
    label: { fontSize: 15, color: c.textPrimary },
    numInput: {
      backgroundColor: c.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 7,
      fontSize: 15,
      color: c.textPrimary,
      minWidth: 90,
      textAlign: 'right',
    },
    stepper: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    stepBtn: { fontSize: 20, color: c.textBody, paddingHorizontal: 4 },
    stepValue: { fontSize: 15, color: c.textPrimary, minWidth: 44, textAlign: 'center' },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
      alignItems: 'center',
    },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 13, color: c.textBody },
    chipTextOn: { fontSize: 13, color: c.accentText, fontWeight: '500' },
    hint: { color: c.textMuted, fontSize: 12, marginTop: 4, marginBottom: 6 },
    btn: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 8,
    },
    btnText: { color: c.textBody, fontSize: 15, fontWeight: '500' },
  });
