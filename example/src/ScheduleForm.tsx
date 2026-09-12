import { useState } from 'react';
import { Button, StyleSheet, Text, TextInput, View } from 'react-native';
import WakeAlarm, {
  type ScheduleResult,
  type ScheduledAlarm,
} from 'react-native-wake-alarm';

export function ScheduleForm({ onLog }: { onLog: (line: string) => void }) {
  const [minutes, setMinutes] = useState('1');
  const [scheduled, setScheduled] = useState<ScheduledAlarm[]>([]);
  const [last, setLast] = useState<ScheduleResult | null>(null);

  const refresh = () => WakeAlarm.getScheduled().then(setScheduled);

  const fireIn = async () => {
    const t = new Date(Date.now() + Math.max(1, Number(minutes) || 1) * 60_000);
    const res = await WakeAlarm.schedule({
      id: 'demo',
      hour: t.getHours(),
      minute: t.getMinutes(),
      title: 'Wake alarm demo',
      body: `Scheduled for ${t.getHours()}:${String(t.getMinutes()).padStart(2, '0')}`,
      sound: 'chime',
      payload: { source: 'example' },
    });
    setLast(res);
    onLog(`schedule -> ${JSON.stringify(res)}`);
    refresh();
  };

  const weekly = async () => {
    const res = await WakeAlarm.schedule({
      id: 'weekly',
      hour: 6,
      minute: 30,
      days: [1, 2, 3, 4, 5],
      title: 'Weekday 06:30',
      sound: 'chime',
    });
    setLast(res);
    onLog(`schedule weekly -> ${JSON.stringify(res)}`);
    refresh();
  };

  return (
    <View style={styles.card}>
      <Text style={styles.h}>Schedule</Text>
      <View style={styles.row}>
        <Text>Fire in</Text>
        <TextInput
          style={styles.input}
          keyboardType="number-pad"
          value={minutes}
          onChangeText={setMinutes}
        />
        <Text>min</Text>
        <Button title="Go" onPress={fireIn} />
        <Button title="Weekday 06:30" onPress={weekly} />
      </View>
      <View style={styles.row}>
        <Button title="List" onPress={refresh} />
        <Button
          title="Cancel demo"
          onPress={() => WakeAlarm.cancel('demo').then(refresh)}
        />
        <Button
          title="Cancel all"
          onPress={() => WakeAlarm.cancelAll().then(refresh)}
        />
      </View>
      {last && <Text style={styles.mono}>{JSON.stringify(last)}</Text>}
      {scheduled.map((a) => (
        <Text key={a.id} style={styles.mono}>{`${a.id} ${a.hour}:${String(
          a.minute
        ).padStart(
          2,
          '0'
        )} days=${a.days?.join(',') || 'once'} ${a.backend} next=${new Date(
          a.nextFireAt
        ).toLocaleString()}`}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    margin: 12,
    borderRadius: 12,
    backgroundColor: '#f4f6f8',
  },
  h: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginVertical: 4,
    flexWrap: 'wrap',
  },
  input: {
    borderWidth: 1,
    borderColor: '#bbb',
    borderRadius: 6,
    paddingHorizontal: 8,
    minWidth: 48,
    textAlign: 'center',
  },
  mono: { fontFamily: 'Menlo', fontSize: 12, marginTop: 4 },
});
