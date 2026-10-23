import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { deleteTrip, getTrip, listTrips } from '../api';
import type { SavedTripSummary, TripPlan } from '../types';

/** The logged-in user's saved trips: open one, or delete it. */
export function SavedTrips(props: { onOpen: (plan: TripPlan) => void; onClose: () => void }) {
  const [trips, setTrips] = useState<SavedTripSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setTrips(await listTrips());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your trips');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function open(id: number) {
    try {
      props.onOpen((await getTrip(id)).plan);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open this trip');
    }
  }

  async function remove(id: number) {
    try {
      await deleteTrip(id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete this trip');
    }
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>My trips</Text>
        <Pressable onPress={props.onClose}>
          <Text style={styles.link}>Close</Text>
        </Pressable>
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {trips === null && !error ? <ActivityIndicator /> : null}
      {trips?.length === 0 ? <Text style={styles.muted}>No saved trips yet. Plan one and tap "Save this trip".</Text> : null}
      {trips?.map((trip) => (
        <View key={trip.id} style={styles.trip}>
          <Pressable style={styles.tripText} onPress={() => open(trip.id)} accessibilityRole="button">
            <Text style={styles.tripName}>
              {trip.city}, {trip.country}
            </Text>
            <Text style={styles.muted}>
              {trip.startDate} → {trip.endDate} · {trip.days} {trip.days === 1 ? 'day' : 'days'}
            </Text>
          </Pressable>
          <Pressable onPress={() => remove(trip.id)} accessibilityLabel={`Delete ${trip.city} trip`}>
            <Text style={styles.delete}>Delete</Text>
          </Pressable>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, gap: 6 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  link: { color: '#0B5CAD', fontWeight: '600' },
  error: { color: '#B00020' },
  muted: { color: '#666', fontSize: 13 },
  trip: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#EEF0F2' },
  tripText: { flex: 1 },
  tripName: { fontSize: 15, fontWeight: '600' },
  delete: { color: '#B00020', fontWeight: '600', paddingLeft: 12 },
});
