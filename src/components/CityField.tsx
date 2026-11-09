import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { suggestCities, type CitySuggestion } from '../api';

const WAIT_MS = 300; // ask the server once typing pauses, not on every letter

/** "Region, Country" under the city name, without repeats like "Taiwan, Taiwan" or "Chiang Mai, Chiang Mai". */
function whereText(s: CitySuggestion): string {
  const region = s.region?.trim();
  const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  return region && !same(region, s.city) && !same(region, s.country) ? `${region}, ${s.country}` : s.country;
}

/**
 * The City box, with matching cities listed underneath while typing. Picking one fills in the city and country,
 * so names are spelt the way the planner and weather services expect.
 */
export function CityField(props: {
  city: string;
  onChangeCity: (city: string) => void;
  onPick: (pick: CitySuggestion) => void;
}) {
  const [suggestions, setSuggestions] = useState<CitySuggestion[]>([]);
  const [typing, setTyping] = useState(false); // only suggest after the user types, not for the starting value
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const text = props.city.trim();
    if (!typing || text.length < 2) return; // the list is hidden then (see showList)
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const found = await suggestCities(text, controller.signal);
      if (!controller.signal.aborted) setSuggestions(found);
    }, WAIT_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [props.city, typing]);

  useEffect(() => () => {
    if (blurTimer.current) clearTimeout(blurTimer.current);
  }, []);

  function pick(choice: CitySuggestion) {
    setTyping(false);
    setSuggestions([]);
    props.onPick(choice);
  }

  // The list is hidden when it only repeats exactly what's typed
  const onlyRepeats =
    suggestions.length === 1 && suggestions[0].city.toLowerCase() === props.city.trim().toLowerCase();
  const showList = typing && props.city.trim().length >= 2 && suggestions.length > 0 && !onlyRepeats;

  return (
    <View style={styles.field}>
      <Text style={styles.label}>City</Text>
      <TextInput
        style={styles.input}
        value={props.city}
        onChangeText={(text) => {
          setTyping(true);
          props.onChangeCity(text);
        }}
        // A short delay so a tap on a suggestion still counts after the box loses focus
        onBlur={() => {
          blurTimer.current = setTimeout(() => setTyping(false), 200);
        }}
        placeholder="e.g. Kyoto"
        placeholderTextColor="#AAA"
        autoCorrect={false}
        autoComplete="off"
        textContentType="addressCity"
        accessibilityLabel="City"
      />
      {showList ? (
        <View style={styles.list} accessibilityRole="list">
          {suggestions.map((s, i) => (
            <Pressable
              key={`${s.city}|${s.country}|${s.region ?? ''}`}
              onPress={() => pick(s)}
              style={({ pressed }) => [styles.item, i > 0 && styles.divider, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel={`${s.city}, ${s.country}`}
            >
              <Text style={styles.city}>{s.city}</Text>
              <Text style={styles.where} numberOfLines={1}>
                {whereText(s)}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
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
  list: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#D5D9DE',
    borderRadius: 10,
    marginTop: 4,
    overflow: 'hidden',
  },
  item: { paddingHorizontal: 12, paddingVertical: 10 },
  divider: { borderTopWidth: 1, borderTopColor: '#EEF0F2' },
  pressed: { backgroundColor: '#EEF6F5' },
  city: { fontSize: 16, color: '#111' },
  where: { fontSize: 13, color: '#666', marginTop: 1 },
});
