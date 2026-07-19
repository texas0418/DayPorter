// src/screens/ClientScreen.tsx
// One client, everything about them: stage, contact card, sites, contracts
// (with monthly value), saved bids, and the activity log with follow-ups.
// All editing is inline — no modals, no nav lib (house style).

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  addActivity,
  addContract,
  addSite,
  deleteBid,
  deleteClient,
  deleteContract,
  deleteSite,
  getClient,
  listActivities,
  listBids,
  listContractsByClient,
  listSites,
  setActivityDone,
  setClientStage,
  setContractActive,
  updateClient,
} from '../db';
import {
  ACTIVITY_KINDS,
  ACTIVITY_LABELS,
  Activity,
  ActivityKind,
  Bid,
  Client,
  Contract,
  RatePeriod,
  STAGES,
  STAGE_LABELS,
  Site,
  formatCents,
  monthlyValueCents,
  parseMoneyToCents,
} from '../models';
import { Palette, useTheme } from '../theme';

interface Props {
  clientId: number;
  onBack: () => void;
  onNewBid: (clientId: number) => void;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const FOLLOW_UP_CHOICES: { label: string; days: number }[] = [
  { label: '1d', days: 1 },
  { label: '3d', days: 3 },
  { label: '1w', days: 7 },
  { label: '2w', days: 14 },
];

const shortDate = (ms: number): string => {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
};

export default function ClientScreen({ clientId, onBack, onNewBid }: Props) {
  const { colors: c, stage, statusBarStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [client, setClient] = useState<Client | null>(() => getClient(clientId));
  const [sites, setSites] = useState<Site[]>(() => listSites(clientId));
  const [contracts, setContracts] = useState<Contract[]>(() =>
    listContractsByClient(clientId),
  );
  const [activities, setActivities] = useState<Activity[]>(() =>
    listActivities(clientId),
  );
  const [bids, setBids] = useState<Bid[]>(() => listBids(clientId));

  // contact edit buffer
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');

  // new-site buffer
  const [siteLabel, setSiteLabel] = useState('');
  const [siteAddress, setSiteAddress] = useState('');
  const [siteSqft, setSiteSqft] = useState('');

  // new-contract buffer
  const [ctSiteId, setCtSiteId] = useState<number | null>(null);
  const [ctVisits, setCtVisits] = useState(3);
  const [ctPeriod, setCtPeriod] = useState<RatePeriod>('monthly');
  const [ctRate, setCtRate] = useState('');
  const [ctScope, setCtScope] = useState('');

  // new-activity buffer
  const [actKind, setActKind] = useState<ActivityKind>('note');
  const [actBody, setActBody] = useState('');
  const [actFollowUpDays, setActFollowUpDays] = useState<number | null>(null);

  useEffect(() => {
    const cl = getClient(clientId);
    setClient(cl);
    if (cl) {
      setContactName(cl.contactName);
      setPhone(cl.phone);
      setEmail(cl.email);
      setNotes(cl.notes);
    }
  }, [clientId]);

  const reload = useCallback(() => {
    setSites(listSites(clientId));
    setContracts(listContractsByClient(clientId));
    setActivities(listActivities(clientId));
    setBids(listBids(clientId));
  }, [clientId]);

  if (!client) return null;

  const saveContact = () => {
    const next: Client = { ...client, contactName, phone, email, notes };
    updateClient(next);
    setClient(next);
  };

  const changeStage = (st: Client['stage']) => {
    setClientStage(clientId, st);
    setClient({ ...client, stage: st });
  };

  const removeClient = () => {
    Alert.alert(
      'Delete client?',
      `Removes ${client.name} with all sites, contracts, bids, and history. There is no undo.`,
      [
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            deleteClient(clientId);
            onBack();
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const submitSite = () => {
    const label = siteLabel.trim();
    if (!label) return;
    addSite({
      clientId,
      label,
      address: siteAddress.trim(),
      sqft: Number(siteSqft.replace(/[^0-9]/g, '')) || 0,
      notes: '',
    });
    setSiteLabel('');
    setSiteAddress('');
    setSiteSqft('');
    reload();
  };

  const submitContract = () => {
    const rateCents = parseMoneyToCents(ctRate);
    const siteId = ctSiteId ?? sites[0]?.id;
    if (siteId == null) {
      Alert.alert('Add a site first', 'Contracts belong to a building.');
      return;
    }
    if (rateCents == null || rateCents === 0) {
      Alert.alert('Rate needed', 'Enter the contract rate in dollars.');
      return;
    }
    addContract({
      siteId,
      visitsPerWeek: ctVisits,
      ratePeriod: ctPeriod,
      rateCents,
      scope: ctScope.trim(),
      active: true,
      startMs: Date.now(),
    });
    setCtRate('');
    setCtScope('');
    reload();
  };

  const submitActivity = () => {
    const body = actBody.trim();
    if (!body && actFollowUpDays == null) return;
    addActivity({
      clientId,
      kind: actKind,
      body,
      whenMs: Date.now(),
      followUpMs: actFollowUpDays == null ? null : Date.now() + actFollowUpDays * DAY_MS,
      done: false,
    });
    setActBody('');
    setActFollowUpDays(null);
    setActKind('note');
    reload();
  };

  const siteName = (id: number | null): string =>
    sites.find((s) => s.id === id)?.label ?? '—';

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
        <Text style={styles.title} numberOfLines={1}>
          {client.name}
        </Text>
        <View style={{ width: 44 }} />
      </View>

      {/* stage */}
      <View style={styles.stageRow}>
        {STAGES.map((st) => {
          const on = st === client.stage;
          const sc = stage(st);
          return (
            <Pressable
              key={st}
              style={[styles.stageChip, on && { backgroundColor: sc.bg, borderColor: sc.main }]}
              onPress={() => changeStage(st)}
            >
              <Text style={[styles.stageChipText, on && { color: sc.text, fontWeight: '600' }]}>
                {STAGE_LABELS[st]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* contact */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contact</Text>
        <TextInput
          style={styles.input}
          placeholder="Contact name"
          placeholderTextColor={c.textMuted}
          value={contactName}
          onChangeText={setContactName}
          onEndEditing={saveContact}
        />
        <TextInput
          style={styles.input}
          placeholder="Phone"
          placeholderTextColor={c.textMuted}
          value={phone}
          onChangeText={setPhone}
          onEndEditing={saveContact}
          keyboardType="phone-pad"
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={c.textMuted}
          value={email}
          onChangeText={setEmail}
          onEndEditing={saveContact}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={[styles.input, styles.multiline]}
          placeholder="Notes (gate codes, alarm, decision maker…)"
          placeholderTextColor={c.textMuted}
          value={notes}
          onChangeText={setNotes}
          onEndEditing={saveContact}
          multiline
        />
      </View>

      {/* sites */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Sites</Text>
        {sites.map((s) => (
          <View key={s.id} style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{s.label}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {[s.address, s.sqft > 0 ? `${s.sqft.toLocaleString()} sqft` : '']
                  .filter(Boolean)
                  .join(' · ') || 'no address'}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() =>
                Alert.alert('Remove site?', `${s.label} and its contracts will be removed.`, [
                  {
                    text: 'Remove',
                    style: 'destructive',
                    onPress: () => {
                      deleteSite(s.id!);
                      reload();
                    },
                  },
                  { text: 'Cancel', style: 'cancel' },
                ])
              }
            >
              <Text style={styles.removeX}>✕</Text>
            </Pressable>
          </View>
        ))}
        <TextInput
          style={styles.input}
          placeholder="Site label (e.g. Main office)"
          placeholderTextColor={c.textMuted}
          value={siteLabel}
          onChangeText={setSiteLabel}
        />
        <View style={styles.inlineRow}>
          <TextInput
            style={[styles.input, { flex: 2, marginTop: 0 }]}
            placeholder="Address"
            placeholderTextColor={c.textMuted}
            value={siteAddress}
            onChangeText={setSiteAddress}
          />
          <TextInput
            style={[styles.input, { flex: 1, marginTop: 0 }]}
            placeholder="sqft"
            placeholderTextColor={c.textMuted}
            value={siteSqft}
            onChangeText={setSiteSqft}
            keyboardType="number-pad"
          />
        </View>
        <Pressable style={styles.btn} onPress={submitSite}>
          <Text style={styles.btnText}>Add site</Text>
        </Pressable>
      </View>

      {/* contracts */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Contracts</Text>
        {contracts.map((ct) => (
          <View key={ct.id} style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowTitle, !ct.active && styles.inactive]}>
                {siteName(ct.siteId)} · {ct.visitsPerWeek}x/wk ·{' '}
                {formatCents(ct.rateCents)}
                {ct.ratePeriod === 'visit' ? '/visit' : '/mo'}
              </Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {ct.active
                  ? `${formatCents(monthlyValueCents(ct))}/mo${ct.scope ? ` · ${ct.scope}` : ''}`
                  : 'paused'}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                setContractActive(ct.id!, !ct.active);
                reload();
              }}
            >
              <Text style={styles.rowAction}>{ct.active ? 'Pause' : 'Resume'}</Text>
            </Pressable>
            <Pressable
              hitSlop={8}
              onPress={() => {
                deleteContract(ct.id!);
                reload();
              }}
            >
              <Text style={styles.removeX}>✕</Text>
            </Pressable>
          </View>
        ))}
        {sites.length === 0 ? (
          <Text style={styles.hint}>Add a site above, then log the contract here.</Text>
        ) : (
          <>
            {sites.length > 1 && (
              <View style={styles.chipRow}>
                {sites.map((s) => {
                  const on = (ctSiteId ?? sites[0].id) === s.id;
                  return (
                    <Pressable
                      key={s.id}
                      style={[styles.chip, on && styles.chipOn]}
                      onPress={() => setCtSiteId(s.id!)}
                    >
                      <Text style={[styles.chipText, on && styles.chipTextOn]}>
                        {s.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <View style={styles.inlineRow}>
              <View style={[styles.stepper, { flex: 1 }]}>
                <Pressable hitSlop={8} onPress={() => setCtVisits(Math.max(1, ctVisits - 1))}>
                  <Text style={styles.stepBtn}>−</Text>
                </Pressable>
                <Text style={styles.stepValue}>{ctVisits}x/wk</Text>
                <Pressable hitSlop={8} onPress={() => setCtVisits(Math.min(14, ctVisits + 1))}>
                  <Text style={styles.stepBtn}>+</Text>
                </Pressable>
              </View>
              <TextInput
                style={[styles.input, { flex: 1, marginTop: 0 }]}
                placeholder="$ rate"
                placeholderTextColor={c.textMuted}
                value={ctRate}
                onChangeText={setCtRate}
                keyboardType="decimal-pad"
              />
              <Pressable
                style={[styles.chip, styles.chipOn]}
                onPress={() => setCtPeriod(ctPeriod === 'monthly' ? 'visit' : 'monthly')}
              >
                <Text style={styles.chipTextOn}>
                  {ctPeriod === 'monthly' ? '/mo' : '/visit'}
                </Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.input}
              placeholder="Scope (e.g. 3x office clean + restrooms)"
              placeholderTextColor={c.textMuted}
              value={ctScope}
              onChangeText={setCtScope}
            />
            <Pressable style={styles.btn} onPress={submitContract}>
              <Text style={styles.btnText}>Add contract</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* bids */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Bids</Text>
        {bids.map((b) => (
          <View key={b.id} style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {formatCents(b.priceCents)}/mo · {b.sqft.toLocaleString()} sqft ·{' '}
                {b.visitsPerWeek}x/wk
              </Text>
              <Text style={styles.rowSub}>
                {shortDate(b.createdMs)} · {b.marginPct}% margin
                {b.siteId != null ? ` · ${siteName(b.siteId)}` : ''}
              </Text>
            </View>
            <Pressable
              hitSlop={8}
              onPress={() => {
                deleteBid(b.id!);
                reload();
              }}
            >
              <Text style={styles.removeX}>✕</Text>
            </Pressable>
          </View>
        ))}
        <Pressable style={styles.btn} onPress={() => onNewBid(clientId)}>
          <Text style={styles.btnText}>New bid</Text>
        </Pressable>
      </View>

      {/* activity log */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Log</Text>
        <View style={styles.chipRow}>
          {ACTIVITY_KINDS.map((k) => {
            const on = k === actKind;
            return (
              <Pressable
                key={k}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setActKind(k)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>
                  {ACTIVITY_LABELS[k]}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={styles.input}
          placeholder="What happened?"
          placeholderTextColor={c.textMuted}
          value={actBody}
          onChangeText={setActBody}
        />
        <View style={styles.chipRow}>
          <Text style={styles.hint}>Follow up:</Text>
          {FOLLOW_UP_CHOICES.map((f) => {
            const on = actFollowUpDays === f.days;
            return (
              <Pressable
                key={f.days}
                style={[styles.chip, on && styles.chipOn]}
                onPress={() => setActFollowUpDays(on ? null : f.days)}
              >
                <Text style={[styles.chipText, on && styles.chipTextOn]}>{f.label}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable style={styles.btn} onPress={submitActivity}>
          <Text style={styles.btnText}>Log it</Text>
        </Pressable>

        {activities.map((a) => (
          <View key={a.id} style={styles.rowItem}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>
                {ACTIVITY_LABELS[a.kind]}
                {a.body ? ` — ${a.body}` : ''}
              </Text>
              <Text style={styles.rowSub}>
                {shortDate(a.whenMs)}
                {a.followUpMs != null &&
                  ` · follow up ${shortDate(a.followUpMs)}${a.done ? ' ✓' : ''}`}
              </Text>
            </View>
            {a.followUpMs != null && !a.done && (
              <Pressable
                hitSlop={8}
                onPress={() => {
                  setActivityDone(a.id!, true);
                  reload();
                }}
              >
                <Text style={styles.rowAction}>Done</Text>
              </Pressable>
            )}
          </View>
        ))}
      </View>

      <Pressable style={styles.deleteBtn} onPress={removeClient}>
        <Text style={styles.deleteText}>Delete client</Text>
      </Pressable>
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
    stageRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
    stageChip: {
      borderRadius: 999,
      borderWidth: 1,
      borderColor: c.cardBorder,
      backgroundColor: c.card,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    stageChipText: { fontSize: 13, color: c.textBody },
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
      marginTop: 8,
    },
    multiline: { minHeight: 60, textAlignVertical: 'top' },
    inlineRow: { flexDirection: 'row', gap: 8, marginTop: 8, alignItems: 'center' },
    rowItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 8,
      borderBottomWidth: 1,
      borderBottomColor: c.hairline,
    },
    rowTitle: { fontSize: 14, color: c.textPrimary },
    rowSub: { fontSize: 12, color: c.textMuted, marginTop: 1 },
    rowAction: { fontSize: 13, color: c.accent, fontWeight: '500' },
    removeX: { fontSize: 14, color: c.textMuted, paddingHorizontal: 2 },
    inactive: { color: c.textMuted, textDecorationLine: 'line-through' },
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
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    chipOn: { backgroundColor: c.accent, borderColor: c.accent },
    chipText: { fontSize: 13, color: c.textBody },
    chipTextOn: { fontSize: 13, color: c.accentText, fontWeight: '500' },
    stepper: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingHorizontal: 10,
      paddingVertical: 8,
    },
    stepBtn: { fontSize: 18, color: c.textBody, paddingHorizontal: 4 },
    stepValue: { fontSize: 14, color: c.textPrimary },
    btn: {
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingVertical: 10,
      alignItems: 'center',
      marginTop: 10,
    },
    btnText: { color: c.textBody, fontSize: 15, fontWeight: '500' },
    hint: { color: c.textMuted, fontSize: 12, marginTop: 4 },
    deleteBtn: { alignItems: 'center', paddingVertical: 12, marginBottom: 24 },
    deleteText: { color: c.danger, fontSize: 14, fontWeight: '500' },
  });
