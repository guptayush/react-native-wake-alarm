import { useEffect, useState } from 'react';
import {
  AppState,
  Button,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import WakeAlarm from 'react-native-wake-alarm';
import type { RingingAlarm } from 'react-native-wake-alarm';
import { CustomRingScreen } from './CustomRingScreen';
import { EventLog } from './EventLog';
import { PermissionsPanel } from './PermissionsPanel';
import { ScheduleForm } from './ScheduleForm';

export default function App() {
  const [lines, setLines] = useState<string[]>([]);
  const [custom, setCustom] = useState(false);
  const [ringing, setRinging] = useState<RingingAlarm | null>(null);
  const log = (l: string) =>
    setLines((prev) =>
      [`${new Date().toLocaleTimeString()} ${l}`, ...prev].slice(0, 100)
    );

  useEffect(() => {
    const pending = WakeAlarm.consumePendingAction();
    if (pending) log(`pending action on launch: ${JSON.stringify(pending)}`);
    const onLaunch = WakeAlarm.getRinging();
    if (onLaunch) log(`ringing on launch: ${onLaunch.id}`);
    setRinging(onLaunch);
    // On iOS the alert's Open button brings the app up while the alarm keeps ringing, so the
    // ringing state is re-read on every foreground as well as on fired/stopped.
    const reread = () => setRinging(WakeAlarm.getRinging());
    const appState = AppState.addEventListener('change', (state) => {
      if (state === 'active') reread();
    });
    const subs = [
      WakeAlarm.addListener('fired', (e) => {
        log(`fired ${JSON.stringify(e)}`);
        reread();
      }),
      WakeAlarm.addListener('stopped', (e) => {
        log(`stopped ${JSON.stringify(e)}`);
        reread();
      }),
      WakeAlarm.addListener('permissionChanged', (e) =>
        log(`permissionChanged ${JSON.stringify(e)}`)
      ),
    ];
    return () => {
      appState.remove();
      subs.forEach((s) => s.remove());
    };
  }, []);

  useEffect(() => {
    if (custom) WakeAlarm.registerRingScreen(CustomRingScreen);
  }, [custom]);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView>
        <PermissionsPanel />
        {ringing && (
          <View style={styles.ringing}>
            <Text style={styles.ringingText}>Ringing now: {ringing.title}</Text>
            <Button
              title="Stop"
              onPress={() => {
                WakeAlarm.stopRinging().then(() => setRinging(null));
              }}
            />
          </View>
        )}
        <ScheduleForm onLog={log} />
        <View style={styles.row}>
          <Text>Use custom ring screen (Android)</Text>
          <Switch value={custom} onValueChange={setCustom} />
        </View>
        <EventLog lines={lines} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 24,
  },
  ringing: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    margin: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: '#ffe8e8',
  },
  ringingText: { fontWeight: '600' },
});
