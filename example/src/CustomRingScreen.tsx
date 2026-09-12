import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RingScreenProps } from 'react-native-wake-alarm';

export function CustomRingScreen({ alarm, stop }: RingScreenProps) {
  return (
    <View style={styles.root}>
      <Text style={styles.title}>{alarm.title}</Text>
      <Text style={styles.body}>{alarm.body ?? ''}</Text>
      <Text style={styles.body}>{`scheduled ${new Date(
        alarm.scheduledFor
      ).toLocaleTimeString()} · fired ${new Date(alarm.firedAt).toLocaleTimeString()} · Δ ${
        alarm.firedAt - alarm.scheduledFor
      } ms`}</Text>
      <Pressable style={styles.btn} onPress={stop}>
        <Text style={styles.btnLabel}>Stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#0b3d91',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { color: 'white', fontSize: 32, fontWeight: '700' },
  body: { color: '#cfe0ff', fontSize: 16, marginTop: 8, textAlign: 'center' },
  btn: {
    marginTop: 40,
    backgroundColor: 'white',
    borderRadius: 999,
    paddingVertical: 14,
    paddingHorizontal: 40,
  },
  btnLabel: { color: '#0b3d91', fontSize: 18, fontWeight: '600' },
});
