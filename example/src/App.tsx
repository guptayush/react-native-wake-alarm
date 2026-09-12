import { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import WakeAlarm from 'react-native-wake-alarm';
import { CustomRingScreen } from './CustomRingScreen';
import { EventLog } from './EventLog';
import { PermissionsPanel } from './PermissionsPanel';
import { ScheduleForm } from './ScheduleForm';

export default function App() {
  const [lines, setLines] = useState<string[]>([]);
  const [custom, setCustom] = useState(false);
  const log = (l: string) =>
    setLines((prev) =>
      [`${new Date().toLocaleTimeString()} ${l}`, ...prev].slice(0, 100)
    );

  useEffect(() => {
    const pending = WakeAlarm.consumePendingAction();
    if (pending) log(`pending action on launch: ${JSON.stringify(pending)}`);
    const ringing = WakeAlarm.getRinging();
    if (ringing) log(`ringing on launch: ${ringing.id}`);
    const subs = [
      WakeAlarm.addListener('fired', (e) => log(`fired ${JSON.stringify(e)}`)),
      WakeAlarm.addListener('stopped', (e) =>
        log(`stopped ${JSON.stringify(e)}`)
      ),
      WakeAlarm.addListener('permissionChanged', (e) =>
        log(`permissionChanged ${JSON.stringify(e)}`)
      ),
    ];
    return () => subs.forEach((s) => s.remove());
  }, []);

  useEffect(() => {
    if (custom) WakeAlarm.registerRingScreen(CustomRingScreen);
  }, [custom]);

  return (
    <SafeAreaView style={styles.root}>
      <ScrollView>
        <PermissionsPanel />
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
});
