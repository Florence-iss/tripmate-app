import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { StatusBar } from 'expo-status-bar';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';

import { createPlan, saveTrip } from './src/api';
import { AccountBar } from './src/components/Account';
import { SavedTrips } from './src/components/SavedTrips';
import { supabase } from './src/supabase';
import type { Money, TransportMode, TravelStyle, TripPlan } from './src/types';

const STYLES: { value: TravelStyle; label: string }[] = [
  { value: 'BUDGET', label: 'Budget' },
  { value: 'MIDRANGE', label: 'Mid-range' },
  { value: 'COMFORT', label: 'Comfort' },
];

const TRANSPORTS: { value: TransportMode; label: string }[] = [
  { value: 'TRANSIT', label: 'Public transport' },
  { value: 'TAXI', label: 'Taxi' },
  { value: 'CAR_WITH_DRIVER', label: 'Car + driver' },
  { value: 'SELF_DRIVE', label: 'Self-drive' },
];

export default function App() {
  const [country, setCountry] = useState('Japan');
  const [city, setCity] = useState('Kyoto');
  const [startDate, setStartDate] = useState('2026-11-01');
  const [endDate, setEndDate] = useState('2026-11-03');
  const [travelers, setTravelers] = useState(1);
  const [style, setStyle] = useState<TravelStyle>('MIDRANGE');
  const [transport, setTransport] = useState<TransportMode>('TRANSIT');
  const [stayAt, setStayAt] = useState('');
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [session, setSession] = useState<Session | null>(null);
  const [showTrips, setShowTrips] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Keep track of who is logged in (Supabase remembers the login between app launches)
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (!newSession) setShowTrips(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onSaveTrip() {
    if (!plan) return;
    setSaveMessage(null);
    try {
      await saveTrip(plan);
      setSaveMessage('Saved to My trips ✓');
    } catch (e) {
      setSaveMessage(e instanceof Error ? e.message : 'Could not save this trip');
    }
  }

  async function onPlanTrip() {
    setLoading(true);
    setError(null);
    setSaveMessage(null);
    try {
      setPlan(
        await createPlan({
          country: country.trim(),
          city: city.trim(),
          startDate,
          endDate,
          travelers,
          style,
          transport,
          stayAt: stayAt.trim() || undefined,
        }),
      );
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

          <AccountBar session={session} onShowTrips={() => setShowTrips(true)} />
          {showTrips && session ? (
            <SavedTrips
              onOpen={(saved) => {
                setPlan(saved);
                setSaveMessage(null);
                setShowTrips(false);
              }}
              onClose={() => setShowTrips(false)}
            />
          ) : null}

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

          <Text style={styles.label}>Travellers</Text>
          <View style={styles.stepper}>
            <Pressable
              style={[styles.stepButton, travelers <= 1 && styles.choiceDisabled]}
              onPress={() => setTravelers((n) => Math.max(1, n - 1))}
              disabled={travelers <= 1}
              accessibilityLabel="Fewer travellers"
            >
              <Text style={styles.stepButtonText}>−</Text>
            </Pressable>
            <Text style={styles.stepValue}>{travelers}</Text>
            <Pressable
              style={[styles.stepButton, travelers >= 12 && styles.choiceDisabled]}
              onPress={() => setTravelers((n) => Math.min(12, n + 1))}
              disabled={travelers >= 12}
              accessibilityLabel="More travellers"
            >
              <Text style={styles.stepButtonText}>+</Text>
            </Pressable>
          </View>

          <Field label="Staying at (hotel or area, optional)" value={stayAt} onChangeText={setStayAt} />

          <Choice label="Style" options={STYLES} value={style} onChange={setStyle} />
          <Choice label="Getting around" options={TRANSPORTS} value={transport} onChange={setTransport} />

          <Pressable
            style={({ pressed }) => [styles.button, (pressed || loading) && styles.buttonPressed]}
            onPress={onPlanTrip}
            disabled={loading}
          >
            {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Plan my trip</Text>}
          </Pressable>

          {error && <Text style={styles.error}>{error}</Text>}
          {plan && session ? (
            <Pressable style={styles.saveButton} onPress={onSaveTrip} accessibilityRole="button">
              <Text style={styles.saveButtonText}>Save this trip</Text>
            </Pressable>
          ) : null}
          {saveMessage ? <Text style={styles.saveMessage}>{saveMessage}</Text> : null}
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

function Choice<T extends string>(props: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <View style={styles.choices}>
        {props.options.map((option) => {
          const selected = option.value === props.value;
          return (
            <Pressable
              key={option.value}
              style={[styles.choice, selected && styles.choiceSelected]}
              onPress={() => props.onChange(option.value)}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
            >
              <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </View>
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
      {plan.stay ? (
        plan.stay.found ? (
          <Text style={styles.stayLine}>🏨 Staying at {plan.stay.name} · daily trips to and from it are included</Text>
        ) : (
          <Text style={styles.stayWarning}>
            Couldn't find "{plan.stay.requested}", so trips to and from it aren't counted. Try the full hotel name.
          </Text>
        )
      ) : null}

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
              {stop.photoUrl ? (
                <View style={styles.photoBox}>
                  <Image
                    source={{ uri: stop.photoUrl }}
                    style={styles.photo}
                    resizeMode="cover"
                    accessibilityLabel={`Photo of ${stop.name}`}
                  />
                  {stop.photoCredit ? <Text style={styles.photoCredit}>Photo: {stop.photoCredit}</Text> : null}
                </View>
              ) : null}
              <Text style={styles.stopName}>
                {stop.arriveAt.slice(0, 5)} · {stop.name}
              </Text>
              <Text style={styles.muted}>
                {/^(open|closed)\b/i.test(stop.openingHours) ? stop.openingHours : `Open ${stop.openingHours}`} · Entry{' '}
                {stop.entryFee.local === 0 ? 'free' : money(stop.entryFee)}
              </Text>
              {stop.limits.map((limit) => (
                <Text key={limit} style={styles.limit}>
                  ⚠︎ {limit}
                </Text>
              ))}
              {stop.latitude !== null ? (
                <Pressable
                  onPress={() =>
                    Linking.openURL(
                      `https://www.youtube.com/results?search_query=${encodeURIComponent(`${stop.name} ${plan.city}`)}`,
                    )
                  }
                  accessibilityRole="link"
                >
                  <Text style={styles.link}>▶ Watch on YouTube</Text>
                </Pressable>
              ) : null}
            </View>
          ))}

          <Text style={styles.total}>
            Day budget{plan.travelers > 1 ? ` for ${plan.travelers}` : ''}: {money(day.budget.total)}
          </Text>
          <Text style={styles.muted}>
            Entry {money(day.budget.entry)} · Food {money(day.budget.food)} · Transport{' '}
            {money(day.budget.transport)}
          </Text>
          {day.budget.transportNote ? (
            <Text style={styles.muted}>Getting around: {day.budget.transportNote}</Text>
          ) : null}
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
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  stepButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D5D9DE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepButtonText: { fontSize: 22, color: '#0B3B5B' },
  stepValue: { fontSize: 18, fontWeight: '600', minWidth: 24, textAlign: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#D5D9DE',
    backgroundColor: '#fff',
  },
  choiceSelected: { backgroundColor: '#0B7A75', borderColor: '#0B7A75' },
  choiceText: { fontSize: 14, color: '#333' },
  choiceTextSelected: { color: '#fff', fontWeight: '600' },
  choiceDisabled: { opacity: 0.4 },
  photoBox: { marginBottom: 6 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 10, backgroundColor: '#E4E7EB' },
  photoCredit: { fontSize: 11, color: '#888', marginTop: 2 },
  link: { color: '#0B5CAD', fontSize: 13, marginTop: 4, fontWeight: '600' },
  saveButton: {
    borderWidth: 1,
    borderColor: '#0B7A75',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
    marginBottom: 8,
  },
  saveButtonText: { color: '#0B7A75', fontSize: 16, fontWeight: '600' },
  saveMessage: { color: '#0B7A75', fontSize: 13, marginBottom: 12 },
  stayLine: { color: '#333', fontSize: 14, marginTop: -6, marginBottom: 12 },
  stayWarning: {
    color: '#9A5B00',
    backgroundColor: '#FFF4E0',
    fontSize: 13,
    padding: 10,
    borderRadius: 10,
    marginTop: -4,
    marginBottom: 12,
  },
});
