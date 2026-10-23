import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '../supabase';

/** Top bar: "Log in" when signed out (opens the form), or the user's email + My trips + Log out. */
export function AccountBar(props: { session: Session | null; onShowTrips: () => void }) {
  const [formOpen, setFormOpen] = useState(false);

  if (!supabase) {
    return <Text style={styles.note}>Login isn't set up yet (Supabase settings missing).</Text>;
  }
  if (props.session) {
    return (
      <View style={styles.bar}>
        <Text style={styles.email} numberOfLines={1}>
          {props.session.user.email}
        </Text>
        <Pressable onPress={props.onShowTrips} accessibilityRole="button">
          <Text style={styles.link}>My trips</Text>
        </Pressable>
        <Pressable onPress={() => supabase?.auth.signOut()} accessibilityRole="button">
          <Text style={styles.link}>Log out</Text>
        </Pressable>
      </View>
    );
  }
  return formOpen ? (
    <LoginForm onClose={() => setFormOpen(false)} />
  ) : (
    <Pressable onPress={() => setFormOpen(true)} accessibilityRole="button">
      <Text style={styles.link}>Log in or sign up to save trips</Text>
    </Pressable>
  );
}

function LoginForm(props: { onClose: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function run(action: 'login' | 'signup') {
    if (!supabase) return;
    setBusy(true);
    setMessage(null);
    const credentials = { email: email.trim(), password };
    const { data, error } =
      action === 'login'
        ? await supabase.auth.signInWithPassword(credentials)
        : await supabase.auth.signUp(credentials);
    setBusy(false);
    if (error) {
      setMessage(error.message);
    } else if (action === 'signup' && !data.session) {
      setMessage('Account created. Check your email to confirm it, then log in.');
    }
  }

  return (
    <View style={styles.form}>
      <Text style={styles.formTitle}>Log in to save your trips</Text>
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <TextInput
        style={styles.input}
        placeholder="Password (at least 6 characters)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />
      {message ? <Text style={styles.message}>{message}</Text> : null}
      <View style={styles.row}>
        <Pressable style={styles.primary} onPress={() => run('login')} disabled={busy}>
          {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Log in</Text>}
        </Pressable>
        <Pressable style={styles.secondary} onPress={() => run('signup')} disabled={busy}>
          <Text style={styles.secondaryText}>Sign up</Text>
        </Pressable>
        <Pressable onPress={props.onClose}>
          <Text style={styles.link}>Cancel</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 12 },
  email: { flex: 1, color: '#555', fontSize: 13 },
  link: { color: '#0B5CAD', fontWeight: '600', fontSize: 14, marginBottom: 12 },
  note: { color: '#888', fontSize: 12, marginBottom: 12 },
  form: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 16, gap: 8 },
  formTitle: { fontSize: 16, fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderColor: '#D5D9DE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  message: { color: '#9A5B00', fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  primary: { backgroundColor: '#0B7A75', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  primaryText: { color: '#fff', fontWeight: '600' },
  secondary: { borderWidth: 1, borderColor: '#0B7A75', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 18 },
  secondaryText: { color: '#0B7A75', fontWeight: '600' },
});
