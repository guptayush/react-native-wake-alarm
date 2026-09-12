import { ScrollView, StyleSheet, Text, View } from 'react-native';

export function EventLog({ lines }: { lines: string[] }) {
  return (
    <View style={styles.card}>
      <Text style={styles.h}>Events</Text>
      <ScrollView style={styles.log}>
        {lines.map((l, i) => (
          <Text key={i} style={styles.mono}>
            {l}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    margin: 12,
    borderRadius: 12,
    backgroundColor: '#f4f6f8',
    flex: 1,
  },
  h: { fontSize: 18, fontWeight: '600', marginBottom: 8 },
  log: { maxHeight: 220 },
  mono: { fontFamily: 'Menlo', fontSize: 12 },
});
