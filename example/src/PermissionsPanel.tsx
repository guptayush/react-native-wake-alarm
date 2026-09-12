import { useCallback, useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import WakeAlarm, {
  type Gate,
  type PermissionStatus,
  type SettingsKind,
} from 'react-native-wake-alarm';

const ROWS: {
  key: keyof PermissionStatus;
  label: string;
  settings: SettingsKind;
}[] = [
  { key: 'notifications', label: 'Notifications', settings: 'notifications' },
  {
    key: 'exactAlarm',
    label: 'Exact alarms (Android 12+)',
    settings: 'exactAlarm',
  },
  {
    key: 'fullScreenIntent',
    label: 'Full-screen alerts (Android 14+)',
    settings: 'fullScreenIntent',
  },
  {
    key: 'batteryUnrestricted',
    label: 'Battery unrestricted',
    settings: 'battery',
  },
  { key: 'alarmKit', label: 'AlarmKit (iOS 26+)', settings: 'alarmKit' },
];

const color = (g: Gate) =>
  g === 'granted' ? '#2e7d32' : g === 'denied' ? '#c62828' : '#757575';

export function PermissionsPanel() {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const refresh = useCallback(() => {
    WakeAlarm.getPermissionStatus().then(setStatus);
  }, []);
  useEffect(refresh, [refresh]);
  return (
    <View style={styles.card}>
      <Text style={styles.h}>Permissions</Text>
      {status &&
        ROWS.map((r) => (
          <View key={r.key} style={styles.row}>
            <Text style={[styles.gate, { color: color(status[r.key]) }]}>
              {status[r.key]}
            </Text>
            <Text style={styles.label}>{r.label}</Text>
            {status[r.key] !== 'granted' &&
              status[r.key] !== 'not_applicable' && (
                <Button
                  title="Fix"
                  onPress={() => WakeAlarm.openSettings(r.settings)}
                />
              )}
          </View>
        ))}
      <View style={styles.row}>
        <Button
          title="Request prompts"
          onPress={() => WakeAlarm.requestPermissions().then(setStatus)}
        />
        <Button title="Refresh" onPress={refresh} />
        <Button
          title="Autostart (OEM)"
          onPress={() => WakeAlarm.openSettings('autostart')}
        />
      </View>
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
  gate: { width: 110, fontVariant: ['tabular-nums'] },
  label: { flex: 1 },
});
