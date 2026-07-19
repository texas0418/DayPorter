// src/screens/PipelineScreen.tsx
// Home: follow-ups due now, MRR headline, and every client grouped by
// pipeline stage. Adding a client is one inline field — everything else
// happens on the client screen.

import { useCallback, useMemo, useState } from 'react';
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
  countClients,
  createClient,
  listActiveContracts,
  listClients,
  listOpenFollowUps,
  OpenFollowUp,
} from '../db';
import {
  Client,
  STAGES,
  STAGE_LABELS,
  Stage,
  bucketFollowUps,
  formatCents,
  mrrCents,
} from '../models';
import { useProAccess } from '../proAccess';
import { FREE_CLIENTS } from '../revenuecat';
import { Palette, useTheme } from '../theme';

interface Props {
  onOpenClient: (clientId: number) => void;
  onCalculator: () => void;
  onSettings: () => void;
}

export default function PipelineScreen({ onOpenClient, onCalculator, onSettings }: Props) {
  const pro = useProAccess();
  const { colors: c, stage, statusBarStyle } = useTheme();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [clients, setClients] = useState<Client[]>(() => listClients());
  const [followUps, setFollowUps] = useState<OpenFollowUp[]>(() => listOpenFollowUps());
  const [mrr, setMrr] = useState<number>(() => mrrCents(listActiveContracts()));
  const [newName, setNewName] = useState('');

  const reload = useCallback(() => {
    setClients(listClients());
    setFollowUps(listOpenFollowUps());
    setMrr(mrrCents(listActiveContracts()));
  }, []);

  const addClient = () => {
    const name = newName.trim();
    if (!name) return;
    if (!pro && countClients() >= FREE_CLIENTS) {
      Alert.alert(
        'Client limit reached',
        `The free version tracks ${FREE_CLIENTS} clients. Unlock DayPorter Pro in Settings for unlimited clients — everything else stays free.`,
      );
      return;
    }
    const id = createClient({
      name,
      contactName: '',
      phone: '',
      email: '',
      stage: 'lead',
      notes: '',
      createdMs: Date.now(),
    });
    setNewName('');
    reload();
    onOpenClient(id);
  };

  const due = bucketFollowUps(followUps, Date.now());
  const dueNow = [...due.overdue, ...due.today];
  const byStage = new Map<Stage, Client[]>(STAGES.map((s) => [s, []]));
  for (const cl of clients) byStage.get(cl.stage)!.push(cl);

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.scroll}>
      <StatusBar style={statusBarStyle} />
      <View style={styles.topBar}>
        <Text style={styles.appName}>DayPorter</Text>
        <View style={styles.topActions}>
          <Pressable onPress={onCalculator} hitSlop={8}>
            <Text style={styles.topLink}>Bid calc</Text>
          </Pressable>
          <Pressable onPress={onSettings} hitSlop={8}>
            <Text style={styles.topLink}>Settings</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.mrrCard}>
        <Text style={styles.mrrLabel}>Monthly recurring</Text>
        <Text style={styles.mrrValue}>{formatCents(mrr)}</Text>
        <Text style={styles.hint}>
          {byStage.get('active')!.length} active client(s) · updates as contracts change
        </Text>
      </View>

      {dueNow.length > 0 && (
        <View style={styles.dueCard}>
          <Text style={styles.dueTitle}>
            Follow up {due.overdue.length > 0 ? `— ${due.overdue.length} overdue` : 'today'}
          </Text>
          {dueNow.slice(0, 5).map((f) => (
            <Pressable
              key={f.id}
              style={styles.dueRow}
              onPress={() => onOpenClient(f.clientId)}
            >
              <Text style={styles.dueClient} numberOfLines={1}>
                {f.clientName}
              </Text>
              <Text style={styles.dueWhat} numberOfLines={1}>
                {f.body || f.kind}
              </Text>
            </Pressable>
          ))}
          {dueNow.length > 5 && (
            <Text style={styles.hint}>…and {dueNow.length - 5} more</Text>
          )}
        </View>
      )}

      <View style={styles.addRow}>
        <TextInput
          style={styles.addInput}
          placeholder="New client or lead…"
          placeholderTextColor={c.textMuted}
          value={newName}
          onChangeText={setNewName}
          onSubmitEditing={addClient}
          returnKeyType="done"
        />
        <Pressable style={styles.addBtn} onPress={addClient}>
          <Text style={styles.addBtnText}>Add</Text>
        </Pressable>
      </View>

      {clients.length === 0 && (
        <Text style={styles.empty}>
          Add your first lead above. Walk the building, run a bid, win the contract.
        </Text>
      )}

      {STAGES.map((st) => {
        const group = byStage.get(st)!;
        if (group.length === 0) return null;
        const sc = stage(st);
        return (
          <View key={st} style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={[styles.dot, { backgroundColor: sc.main }]} />
              <Text style={styles.sectionTitle}>{STAGE_LABELS[st]}</Text>
              <Text style={styles.sectionCount}>{group.length}</Text>
            </View>
            {group.map((cl) => (
              <Pressable
                key={cl.id}
                style={[styles.clientCard, { borderLeftColor: sc.main }]}
                onPress={() => onOpenClient(cl.id!)}
              >
                <Text style={styles.clientName} numberOfLines={1}>
                  {cl.name}
                </Text>
                {(cl.contactName || cl.phone) !== '' && (
                  <Text style={styles.clientSub} numberOfLines={1}>
                    {[cl.contactName, cl.phone].filter(Boolean).join(' · ')}
                  </Text>
                )}
              </Pressable>
            ))}
          </View>
        );
      })}
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
    appName: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
    topActions: { flexDirection: 'row', gap: 16 },
    topLink: { color: c.accent, fontSize: 14, fontWeight: '500' },
    mrrCard: {
      backgroundColor: c.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.cardBorder,
      padding: 14,
      marginBottom: 14,
    },
    mrrLabel: { fontSize: 12, color: c.textMuted, textTransform: 'uppercase' },
    mrrValue: { fontSize: 28, fontWeight: '700', color: c.textPrimary, marginTop: 2 },
    dueCard: {
      backgroundColor: c.dueBg,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: c.dueBorder,
      padding: 14,
      marginBottom: 14,
    },
    dueTitle: { fontSize: 14, fontWeight: '600', color: c.dueText, marginBottom: 6 },
    dueRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingVertical: 6,
      borderTopWidth: 1,
      borderTopColor: c.dueBorder,
      gap: 8,
    },
    dueClient: { fontSize: 14, fontWeight: '600', color: c.textPrimary, flexShrink: 1 },
    dueWhat: { fontSize: 13, color: c.textBody, flexShrink: 1 },
    addRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
    addInput: {
      flex: 1,
      backgroundColor: c.card,
      borderRadius: 10,
      borderWidth: 1,
      borderColor: c.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontSize: 15,
      color: c.textPrimary,
    },
    addBtn: {
      backgroundColor: c.accent,
      borderRadius: 10,
      paddingHorizontal: 18,
      justifyContent: 'center',
    },
    addBtnText: { color: c.accentText, fontSize: 15, fontWeight: '600' },
    empty: { color: c.textMuted, fontSize: 14, textAlign: 'center', marginTop: 24 },
    section: { marginBottom: 14 },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginBottom: 8,
      paddingHorizontal: 2,
    },
    dot: { width: 8, height: 8, borderRadius: 4 },
    sectionTitle: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
    sectionCount: { fontSize: 13, color: c.textMuted },
    clientCard: {
      backgroundColor: c.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: c.cardBorder,
      borderLeftWidth: 3,
      padding: 12,
      marginBottom: 8,
    },
    clientName: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
    clientSub: { fontSize: 13, color: c.textMuted, marginTop: 2 },
    hint: { color: c.textMuted, fontSize: 12, marginTop: 4 },
  });
