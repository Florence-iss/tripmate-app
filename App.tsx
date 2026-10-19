import { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { createPlan } from './src/api';
import type { Money, TripPlan } from './src/types';

export default function App() {
  const [country, setCountry] = useState('Japan');
  const [city, setCity] = useState('Kyoto');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-03');
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onPlanTrip() {
    setLoading(true);
    setError(null);
    try {
      setPlan(await createPlan({ country: country.trim(), city: city.trim(), startDate, endDate }));
    } catch (e) {
      setPlan(null);
      setError(e instanceof Error ? e.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>TripMate</Text>
          <Text style={styles.subtitle}>Where and when are you going?</Text>

          <Field label="Country" value={country} onChangeText={setCountry} />
          <Field label="City" value={city} onChangeText={setCity} />
          <View style={styles.row}>
            <View style={styles.flex}>
              <Field label="Start (YYYY-MM-DD)" value={startDate} onChangeText={setStartDate} />
            </View>
            <View style={styles.flex}>
              <Field label="End (YYYY-MM-DD)" value={endDate} onChangeText={setEndDate} />
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed]}
            onPress={onPlanTrip}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Plan my trip</Text>}
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}
          {plan && <PlanView plan={plan} />}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Field(props: { label: string; value: string; onChangeText: (text: string) => void }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        autoCorrect={false}
      />
    </View>
  );
}

function PlanView({ plan }: { plan: TripPlan }) {
  const money = (m: Money) => `${m.local.toLocaleString()} ${plan.localCurrency} (S$${m.sgd.toFixed(2)})`;

  return (
    <View>
      <Text style={styles.heading}>
        {plan.city}, {plan.country} · {plan.days.length} {plan.days.length === 1 ? 'day' : 'days'}
      </Text>

      {plan.days.map((day) => (
        <View key={day.dayNumber} style={styles.card}>
          <Text style={styles.cardTitle}>
            Day {day.dayNumber} · {day.date}
          </Text>
          <Text style={styles.muted}>
            {day.weather.summary}, {day.weather.minTempC}–{day.weather.maxTempC}°C
          </Text>

          {day.stops.map((stop) => (
            <View key={stop.order} style={styles.stop}>
              <Text style={styles.stopName}>
                {stop.arriveAt.slice(0, 5)} · {stop.name}
              </Text>
              <Text style={styles.muted}>
                Open {stop.openingHours} · Entry {stop.entryFee.local === 0 ? 'free' : money(stop.entryFee)}
              </Text>
              {stop.limits.map((limit) => (
                <Text key={limit} style={styles.limit}>
                  ⚠︎ {limit}
                </Text>
              ))}
            </View>
          ))}

          <Text style={styles.total}>Day budget: {money(day.budget.total)}</Text>
          <Text style={styles.muted}>
            Entry {money(day.budget.entry)} · Food {money(day.budget.food)} · Transport{' '}
            {money(day.budget.transport)}
          </Text>
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Things to bring</Text>
        {plan.thingsToBring.map((item) => (
          <Text key={item}>• {item}</Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Must-try food</Text>
        {plan.mustTryFood.map((food) => (
          <Text key={food.name}>
            • <Text style={styles.bold}>{food.name}</Text> — {food.description}
          </Text>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Car rental</Text>
        {plan.carRental.map((car) => (
          <Text key={car.type}>
            • {car.type}: {money(car.pricePerDay)} per day
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F6F7F9' },
  content: { padding: 16, paddingBottom: 48 },
  title: { fontSize: 32, fontWeight: '700', color: '#0B3B5B' },
  subtitle: { fontSize: 16, color: '#555', marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
  field: { marginBottom: 12 },
  label: { fontSize: 13, color: '#555', marginBottom: 4 },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D5D9DE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#0B7A75',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  buttonPressed: { opacity: 0.7 },
  buttonText: { color: '#fff', fontSize: 17, fontWeight: '600' },
  error: { color: '#B00020', backgroundColor: '#FDECEE', padding: 12, borderRadius: 10, marginBottom: 16 },
  heading: { fontSize: 20, fontWeight: '700', marginBottom: 12 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 12, gap: 4 },
  cardTitle: { fontSize: 17, fontWeight: '700' },
  muted: { color: '#666', fontSize: 13 },
  stop: { borderLeftWidth: 3, borderLeftColor: '#0B7A75', paddingLeft: 10, marginVertical: 6 },
  stopName: { fontSize: 15, fontWeight: '600' },
  limit: { color: '#9A5B00', fontSize: 13 },
  total: { fontWeight: '700', marginTop: 6 },
  bold: { fontWeight: '600' },
});
