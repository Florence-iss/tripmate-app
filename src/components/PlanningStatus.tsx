import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Shown under the button while a plan is being made, so a long wait doesn't look stuck.
 * AI plans (logged in) can take up to a minute; the online server can also need about a minute
 * to wake up after being idle. Mount it only while loading: the timer starts from zero each time.
 */
export function PlanningStatus(props: { aiPlan: boolean }) {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  const message = props.aiPlan
    ? 'Writing your day-by-day plan with AI. This usually takes under a minute.'
    : 'Getting your sample plan…';
  const stillWorking =
    seconds >= 60
      ? 'Still working. If the server was asleep, it can take an extra minute to wake up.'
      : null;

  return (
    <View style={styles.box} accessibilityLiveRegion="polite">
      <Text style={styles.message}>{message}</Text>
      {stillWorking ? <Text style={styles.message}>{stillWorking}</Text> : null}
      <Text style={styles.elapsed}>{seconds}s</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { backgroundColor: '#E8F4F3', borderRadius: 10, padding: 12, marginBottom: 16, gap: 4 },
  message: { color: '#0B4F4C', fontSize: 14 },
  elapsed: { color: '#5B7F7D', fontSize: 13, fontVariant: ['tabular-nums'] },
});
