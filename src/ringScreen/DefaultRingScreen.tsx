import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { RingScreenProps } from '../types';

const pad = (n: number) => String(n).padStart(2, '0');

export function DefaultRingScreen({ alarm, stop }: RingScreenProps) {
  const d = new Date(alarm.firedAt);
  return (
    <View style={styles.root}>
      <Text
        style={styles.time}
      >{`${pad(d.getHours())}:${pad(d.getMinutes())}`}</Text>
      <Text style={styles.title}>{alarm.title}</Text>
      {alarm.body ? <Text style={styles.body}>{alarm.body}</Text> : null}
      <Pressable accessibilityRole="button" onPress={stop} style={styles.stop}>
        <Text style={styles.stopLabel}>Stop</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#101418',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  time: {
    color: '#FFFFFF',
    fontSize: 72,
    fontWeight: '200',
    letterSpacing: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '600',
    marginTop: 16,
    textAlign: 'center',
  },
  body: {
    color: '#B8C0CC',
    fontSize: 16,
    marginTop: 8,
    textAlign: 'center',
  },
  stop: {
    marginTop: 48,
    minWidth: 200,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 999,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  stopLabel: {
    color: '#101418',
    fontSize: 18,
    fontWeight: '600',
  },
});
