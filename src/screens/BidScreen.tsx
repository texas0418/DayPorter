// src/screens/BidScreen.tsx
// The janitorial bid calculator. Inputs start from the Settings defaults;
// the breakdown recomputes live. Opened from a client it can save the bid to
// that client's history; opened from home it's a free-standing calculator.

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
import { addBid, getClient, listSites } from '../db';
import { computeBid, formatCents, parseMoneyToCents } from '../models';
import { useSettings } from '../SettingsContext';
import { Palette, useTheme } from '../theme';

interface Props {
  clientId: number | null;
  onBack: () => void;
}

const intFrom = (text: string): number => Number(text.replace(/[^0-9]/g, '')) || 0;

export default function BidScreen({ clientId, onBack }: Props) {
  const { settings } = useSettings();
  const { colors: c, statusBarStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const client = useMemo(
    () => (clientId == null ? null : getClient(clientId)),
    [clientId],
  );
  const sites = useMemo(
    () => (clientId == null ? [] : listSites(clientId)),
    [clientId],
  );

  const [sqft, setSqft] = useState(() =>
    sites.find((s) => s.sqft > 0)?.sqft.toString() ?? '',
  );
  const [siteId, setSiteId] = useState<number | null>(() => sites[0]?.id ?? null);
  const [visits, setVisits] = useState(3);
  const [prodRate, setProdRate] = useState(settings.prodRateSqftHr.toString());
  const [laborRate, setLaborRate] = useState((settings.laborRateCents / 100).toString());
  const [suppliesPct, setSuppliesPct] = useState(settings.suppliesPct);
  const [marginPct, setMarginPct] = useState(settings.marginPct);

  const laborRateCents = parseMoneyToCents(laborRate) ?? 0;
  const bid = computeBid({
    sqft: intFrom(sqft),
    visitsPerWeek: visits,
    prodRateSqftHr: intFrom(prodRate),
    laborRateCents,
    suppliesPct,
    marginPct,
  });

  const save = () => {
    if (clientId == null) return;
    if (bid.priceCents === 0) {
      Alert.alert('Nothing to save', 'Enter the building size first.');
      return;
    }
    addBid({
      clientId,
      siteId,
      sqft: intFrom(sqft),
      visitsPerWeek: visits,
      prodRateSqftHr: intFrom(prodRate),
      laborRateCents,
      suppliesPct,
      marginPct,
      priceCents: bid.priceCents,
      createdMs: Date.now(),
    });
    onBack();
  };

  const pctStepper = (
    label: string,
    value: number,
    set: (n: number) => void,
    max: number,
  ) => (
    <View style={styles.stepperRow}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable hitSlop={8} onPress={() => set(Math.max(0, value - 1))}>
          <Text style={styles.stepBtn}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{value}%</Text>
        <Pressable hitSlop={8} onPress={() => set(Math.min(max, value + 1))}>
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
        <Text style={styles.title}>{client ? `Bid — ${client.name}` : 'Bid calculator'}</Text>
        <View style={{ width: 44 }} />
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Building</Text>
        {sites.length > 1 && (
          <View style={styles.chipRow}>
            {sites.map((s) => {
              const on = siteId === s.id;
              return (
                <Pressable
                  key={s.id}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => {
                    setSiteId(s.id!);
                    if (s.sqft > 0) setSqft(s.sqft.toString());
                  }}
                >
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{s.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Square feet"
            placeholderTextColor={c.textMuted}
            value={sqft}
            onChangeText={setSqft}
            keyboardType="number-pad"
          />
          <View style={[styles.stepper, { flex: 1 }]}>
            <Pressable hitSlop={8} onPress={() => setVisits(Math.max(1, visits - 1))}>
              <Text style={styles.stepBtn}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{visits}x/wk</Text>
            <Pressable hitSlop={8} onPress={() => setVisits(Math.min(14, visits + 1))}>
              <Text style={styles.stepBtn}>+</Text>
            </Pressable>
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Your numbers</Text>
        <View style={styles.inlineRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Production sqft/hr</Text>
            <TextInput
              style={styles.input}
              value={prodRate}
              onChangeText={setProdRate}
              keyboardType="number-pad"
            />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>Loaded $/hr</Text>
            <TextInput
              style={styles.input}
              value={laborRate}
              onChangeText={setLaborRate}
              keyboardType="decimal-pad"
            />
          </View>
        </View>
        {pctStepper('Supplies (% of labor)', suppliesPct, setSuppliesPct, 50)}
        {pctStepper('Margin (% of price)', marginPct, setMarginPct, 90)}
      </View>

      <View style={[styles.card, styles.resultCard]}>
        <Text style={styles.resultLabel}>Suggested monthly price</Text>
        <Text style={styles.resultPrice}>{formatCents(bid.priceCents)}</Text>
        {bid.priceCents > 0 && (
          <>
            <Text style={styles.resultSub}>
              {formatCents(bid.perVisitCents)}/visit ·{' '}
              {intFrom(sqft) > 0
                ? `${((bid.priceCents / intFrom(sqft)) / 100).toFixed(2)} $/sqft/mo`
                : ''}
            </Text>
            <View style={styles.breakRow}>
              <Text style={styles.breakLabel}>Time per visit</Text>
              <Text style={styles.breakValue}>{bid.hoursPerVisit.toFixed(1)} hr</Text>
            </View>
            <View style={styles.breakRow}>
              <Text style={styles.breakLabel}>Monthly hours</Text>
              <Text style={styles.breakValue}>{bid.monthlyHours.toFixed(1)} hr</Text>
            </View>
            <View style={styles.breakRow}>
              <Text style={styles.breakLabel}>Labor</Text>
              <Text style={styles.breakValue}>{formatCents(bid.laborCents)}</Text>
            </View>
            <View style={styles.breakRow}>
              <Text style={styles.breakLabel}>Supplies</Text>
              <Text style={styles.breakValue}>{formatCents(bid.suppliesCents)}</Text>
            </View>
            <View style={styles.breakRow}>
              <Text style={styles.breakLabel}>Your cost</Text>
              <Text style={styles.breakValue}>{formatCents(bid.costCents)}</Text>
            </View>
            <View style={styles.breakRow}>
              <Text style={styles.breakLabel}>Profit</Text>
              <Text style={[styles.breakValue, { color: c.success }]}>
                {formatCents(bid.priceCents - bid.costCents)}
              </Text>
            </View>
          </>
        )}
      </View>

      {clientId != null ? (
        <Pressable style={styles.saveBtn} onPress={save}>
          <Text style={styles.saveText}>Save bid to {client?.name ?? 'client'}</Text>
        </Pressable>
      ) : (
        <Text style={styles.hint}>
          Open a client and tap “New bid” to save a bid to their history.
        </Text>
      )}
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
    title: {
      fontSize: 17,
      fontWeight: '600',
      color: c.textPrimary,
      flexShrink: 1,
      paddingHorizontal: 8,
    },
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
    input: {
      backgroundColor: c.bg,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 9,
      fontSize: 15,
      color: c.textPrimary,
      marginTop: 4,
    },
    inlineRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'flex-end' },
    smallLabel: { fontSize: 12, color: c.textMuted },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
    chip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 13, color: c.textBody },
    chipTextOn: { fontSize: 13, color: c.accentText, fontWeight: '500' },
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginTop: 12,
    },
    label: { fontSize: 14, color: c.textPrimary },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingHorizontal: 10,
      paddingVertical: 8,
      gap: 10,
    },
    stepBtn: { fontSize: 18, color: c.textBody, paddingHorizontal: 4 },
    stepValue: { fontSize: 14, color: c.textPrimary, minWidth: 48, textAlign: 'center' },
    resultCard: { borderColor: c.accent },
    resultLabel: { fontSize: 12, color: c.textMuted, textTransform: 'uppercase' },
    resultPrice: { fontSize: 32, fontWeight: '700', color: c.textPrimary, marginTop: 2 },
    resultSub: { fontSize: 13, color: c.textMuted, marginBottom: 8 },
    breakRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 5,
      borderTopWidth: 1,
      borderTopColor: c.hairline,
    },
    breakLabel: { fontSize: 13, color: c.textBody },
    breakValue: { fontSize: 13, color: c.textPrimary, fontWeight: '500' },
    saveBtn: {
      backgroundColor: c.accent,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
      marginBottom: 24,
    },
    saveText: { color: c.accentText, fontSize: 16, fontWeight: '600' },
    hint: { color: c.textMuted, fontSize: 12, textAlign: 'center', marginBottom: 24 },
  });
