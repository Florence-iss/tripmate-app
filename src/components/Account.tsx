import { useEffect, useRef, useState, type ComponentRef, type Ref } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { AuthError, Session } from '@supabase/supabase-js';

import { deleteAccount } from '../api';
import { emailLink, emailLinkTarget, supabase } from '../supabase';

const DELETE_WARNING = 'This deletes your login and all your saved trips. It can’t be undone.';
const PRIVACY_URL = 'https://florence-iss.github.io/tripmate-app/privacy.html';
const MIN_PASSWORD = 6;
const RESEND_WAIT_SECONDS = 60;

/** Asks before deleting. Native apps get a system dialog; the browser gets its own confirm box. */
function confirmDelete(onConfirm: () => void) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(`Delete your account?\n\n${DELETE_WARNING}`)) onConfirm();
    return;
  }
  Alert.alert('Delete your account?', DELETE_WARNING, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete account', style: 'destructive', onPress: onConfirm },
  ]);
}

function tell(title: string, message?: string) {
  if (Platform.OS === 'web') {
    globalThis.alert?.(message ? `${title}\n\n${message}` : title);
  } else {
    Alert.alert(title, message);
  }
}

/** Supabase's error messages, in plain words. */
function friendly(error: AuthError | Error): string {
  const code = 'code' in error ? error.code : undefined;
  switch (code) {
    case 'invalid_credentials':
      return 'Wrong email or password.';
    case 'email_not_confirmed':
      return 'Please confirm your email first: tap the link we emailed you.';
    case 'user_already_exists':
    case 'email_exists':
      return 'There’s already an account with this email. Log in instead.';
    case 'weak_password':
      return `Please choose a longer password (at least ${MIN_PASSWORD} characters).`;
    case 'same_password':
      return 'Please choose a password different from your old one.';
    case 'email_address_invalid':
    case 'validation_failed':
      return 'Please check your email address.';
    case 'over_email_send_rate_limit':
    case 'over_request_rate_limit':
      return 'Too many tries. Please wait a few minutes and try again.';
  }
  if ('status' in error && error.status === 0) return 'Can’t reach the login service. Check your internet connection.';
  return error.message || 'Something went wrong. Please try again.';
}

/** Where an email link sent the user (website only), as a note to show once. */
function noteFromEmailLink(): string | null {
  if (emailLink?.kind === 'signup') {
    return 'Your email is confirmed and you’re logged in. If you signed up in the TripMate app, you can log in there now too.';
  }
  if (emailLink?.kind === 'error') return emailLink.message;
  return null;
}

/**
 * Top bar: "Log in" when signed out (opens the login card), or the user's email + My trips + Log out,
 * with "Delete account" underneath (Apple requires apps with sign-up to offer it in the app).
 * After a "reset password" email link, it asks for the new password instead.
 */
export function AccountBar(props: { session: Session | null; onShowTrips: () => void }) {
  const [formOpen, setFormOpen] = useState(emailLink?.kind === 'error');
  const [recovering, setRecovering] = useState(emailLink?.kind === 'recovery');
  const [note, setNote] = useState<string | null>(noteFromEmailLink);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) return;
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setRecovering(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function onDeleteAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteAccount();
      // The login no longer exists on Supabase, so only clear it from this phone
      await supabase?.auth.signOut({ scope: 'local' });
      tell('Your account has been deleted', 'Your login and saved trips are gone.');
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : 'Could not delete your account');
    } finally {
      setDeleting(false);
    }
  }

  if (!supabase) {
    return <Text style={styles.muted}>Login isn’t set up yet (Supabase settings missing).</Text>;
  }

  const noteBox = note ? <Note text={note} onClose={() => setNote(null)} /> : null;

  if (props.session && recovering) {
    return (
      <NewPasswordCard
        onDone={() => {
          setRecovering(false);
          setNote('Your new password is saved. You’re logged in.');
        }}
      />
    );
  }
  if (props.session) {
    return (
      <View style={styles.account}>
        {noteBox}
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
        {deleting ? (
          <View style={styles.deleteRow}>
            <ActivityIndicator size="small" />
            <Text style={styles.muted}>Deleting your account…</Text>
          </View>
        ) : (
          <Pressable
            onPress={() => confirmDelete(onDeleteAccount)}
            accessibilityRole="button"
            style={styles.deleteRow}
          >
            <Text style={styles.deleteLink}>Delete account</Text>
          </Pressable>
        )}
        {deleteError ? <Text style={styles.error}>{deleteError}</Text> : null}
      </View>
    );
  }
  return (
    <View style={styles.account}>
      {noteBox}
      {formOpen ? (
        <LoginCard onClose={() => setFormOpen(false)} />
      ) : (
        <Pressable onPress={() => setFormOpen(true)} accessibilityRole="button">
          <Text style={styles.link}>Log in or sign up to save trips</Text>
        </Pressable>
      )}
    </View>
  );
}

function Note(props: { text: string; onClose: () => void }) {
  return (
    <View style={styles.note}>
      <Text style={styles.noteText}>{props.text}</Text>
      <Pressable onPress={props.onClose} accessibilityRole="button" accessibilityLabel="Close message" hitSlop={8}>
        <Text style={styles.noteClose}>✕</Text>
      </Pressable>
    </View>
  );
}

type Mode = 'login' | 'signup' | 'forgot' | 'sentConfirm' | 'sentReset';

const TITLES: Record<Mode, string> = {
  login: 'Log in',
  signup: 'Create your account',
  forgot: 'Reset your password',
  sentConfirm: 'Check your email',
  sentReset: 'Check your email',
};

/** Log in, create an account, or get a reset-password email. */
function LoginCard(props: { onClose: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [canResend, setCanResend] = useState(false); // after "please confirm your email first"
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  function switchTo(next: Mode) {
    setMode(next);
    setError(null);
    setCanResend(false);
    setPassword('');
    setConfirm('');
  }

  async function submit() {
    if (!supabase || busy) return;
    const address = email.trim();
    setError(null);
    setCanResend(false);
    if (!address.includes('@')) return setError('Please enter your email address.');
    if (mode !== 'forgot' && password.length < MIN_PASSWORD) {
      return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
    }
    if (mode === 'signup' && password !== confirm) return setError('The two passwords don’t match.');

    setBusy(true);
    try {
      if (mode === 'login') {
        const { error: e } = await supabase.auth.signInWithPassword({ email: address, password });
        if (e) {
          setError(friendly(e));
          setCanResend(e.code === 'email_not_confirmed');
        }
        // Success: the session arrives through onAuthStateChange and this card closes
      } else if (mode === 'signup') {
        const { data, error: e } = await supabase.auth.signUp({
          email: address,
          password,
          options: { emailRedirectTo: emailLinkTarget() },
        });
        if (e) {
          setError(friendly(e));
        } else if (data.user && data.user.identities?.length === 0) {
          // Supabase hides whether an email is taken; an empty identity list means it is
          switchTo('login');
          setError('There’s already an account with this email. Log in instead.');
        } else if (!data.session) {
          switchTo('sentConfirm');
        }
      } else if (mode === 'forgot') {
        const { error: e } = await supabase.auth.resetPasswordForEmail(address, { redirectTo: emailLinkTarget() });
        if (e) setError(friendly(e));
        else switchTo('sentReset');
      }
    } catch (e) {
      setError(friendly(e instanceof Error ? e : new Error(String(e))));
    } finally {
      setBusy(false);
    }
  }

  if (mode === 'sentConfirm' || mode === 'sentReset') {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>{TITLES[mode]}</Text>
        <Text style={styles.body}>
          We sent a link to <Text style={styles.bold}>{email.trim()}</Text>.{' '}
          {mode === 'sentConfirm'
            ? 'Tap it to confirm your email, and you’re ready to go.'
            : 'Tap it to choose a new password.'}
        </Text>
        <Text style={styles.muted}>No email after a few minutes? Check your spam folder.</Text>
        {mode === 'sentConfirm' ? <ResendButton email={email.trim()} /> : null}
        <Pressable onPress={() => switchTo('login')} accessibilityRole="button">
          <Text style={styles.link}>Back to log in</Text>
        </Pressable>
      </View>
    );
  }

  const isSignup = mode === 'signup';
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.cardTitle}>{TITLES[mode]}</Text>
        <Pressable onPress={props.onClose} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.link}>Not now</Text>
        </Pressable>
      </View>
      <Text style={styles.muted}>
        {mode === 'forgot'
          ? 'Enter your email and we’ll send you a link to choose a new password.'
          : 'Save your trips and get real plans made by AI.'}
      </Text>

      <Text style={styles.label}>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        placeholderTextColor="#AAA"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        returnKeyType={mode === 'forgot' ? 'send' : 'next'}
        onSubmitEditing={() => (mode === 'forgot' ? submit() : passwordRef.current?.focus())}
        submitBehavior={mode === 'forgot' ? 'blurAndSubmit' : 'submit'}
        accessibilityLabel="Email"
      />

      {mode !== 'forgot' ? (
        <>
          <Text style={styles.label}>Password</Text>
          <PasswordInput
            ref={passwordRef}
            value={password}
            onChangeText={setPassword}
            isNew={isSignup}
            returnKeyType={isSignup ? 'next' : 'go'}
            onSubmitEditing={() => (isSignup ? confirmRef.current?.focus() : submit())}
            accessibilityLabel="Password"
          />
          {isSignup ? (
            <>
              <Text style={styles.label}>Confirm password</Text>
              <PasswordInput
                ref={confirmRef}
                value={confirm}
                onChangeText={setConfirm}
                isNew
                returnKeyType="go"
                onSubmitEditing={submit}
                accessibilityLabel="Confirm password"
              />
              <Text style={styles.muted}>At least {MIN_PASSWORD} characters.</Text>
            </>
          ) : null}
        </>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}
      {canResend ? <ResendButton email={email.trim()} /> : null}

      <Pressable
        style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}
        onPress={submit}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.primaryText}>
            {mode === 'login' ? 'Log in' : isSignup ? 'Create account' : 'Send reset link'}
          </Text>
        )}
      </Pressable>

      {mode === 'login' ? (
        <Pressable onPress={() => switchTo('forgot')} accessibilityRole="button" style={styles.center}>
          <Text style={styles.link}>Forgot password?</Text>
        </Pressable>
      ) : null}

      {isSignup ? (
        <Text style={styles.small}>
          By creating an account you agree to our{' '}
          <Text style={styles.inlineLink} onPress={() => Linking.openURL(PRIVACY_URL)}>
            Privacy Policy
          </Text>
          .
        </Text>
      ) : null}

      <View style={styles.divider} />
      <View style={styles.switchRow}>
        <Text style={styles.body}>
          {mode === 'login' ? 'New to TripMate?' : isSignup ? 'Already have an account?' : 'Remembered it?'}
        </Text>
        <Pressable onPress={() => switchTo(mode === 'login' ? 'signup' : 'login')} accessibilityRole="button">
          <Text style={styles.link}>{mode === 'login' ? 'Create an account' : 'Log in'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Sends the confirmation email again, at most once a minute. */
function ResendButton(props: { email: string }) {
  const [wait, setWait] = useState(0);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  async function resend() {
    if (!supabase || wait > 0) return;
    setWait(RESEND_WAIT_SECONDS);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: props.email,
      options: { emailRedirectTo: emailLinkTarget() },
    });
    setMessage(error ? friendly(error) : 'Sent. Check your inbox.');
  }

  return (
    <View>
      <Pressable onPress={resend} disabled={wait > 0} accessibilityRole="button">
        <Text style={[styles.link, wait > 0 && styles.disabled]}>
          {wait > 0 ? `Resend email (wait ${wait}s)` : 'Resend confirmation email'}
        </Text>
      </Pressable>
      {message ? <Text style={styles.muted}>{message}</Text> : null}
    </View>
  );
}

/** Shown after a reset-password email link: the link logged the user in, now they pick a new password. */
function NewPasswordCard(props: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirmRef = useRef<ComponentRef<typeof TextInput>>(null);

  async function save() {
    if (!supabase || busy) return;
    setError(null);
    if (password.length < MIN_PASSWORD) return setError(`Your password needs at least ${MIN_PASSWORD} characters.`);
    if (password !== confirm) return setError('The two passwords don’t match.');
    setBusy(true);
    const { error: e } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (e) setError(friendly(e));
    else props.onDone();
  }

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Choose a new password</Text>
      <Text style={styles.label}>New password</Text>
      <PasswordInput
        value={password}
        onChangeText={setPassword}
        isNew
        returnKeyType="next"
        onSubmitEditing={() => confirmRef.current?.focus()}
        accessibilityLabel="New password"
      />
      <Text style={styles.label}>Confirm new password</Text>
      <PasswordInput
        ref={confirmRef}
        value={confirm}
        onChangeText={setConfirm}
        isNew
        returnKeyType="go"
        onSubmitEditing={save}
        accessibilityLabel="Confirm new password"
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        style={({ pressed }) => [styles.primary, (pressed || busy) && styles.pressed]}
        onPress={save}
        disabled={busy}
        accessibilityRole="button"
      >
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>Save new password</Text>}
      </Pressable>
    </View>
  );
}

/** A password box with Show / Hide. */
function PasswordInput({
  ref,
  ...props
}: {
  value: string;
  onChangeText: (text: string) => void;
  isNew: boolean;
  returnKeyType: 'next' | 'go';
  onSubmitEditing: () => void;
  accessibilityLabel: string;
  ref?: Ref<ComponentRef<typeof TextInput>>;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <View style={styles.passwordRow}>
      <TextInput
        ref={ref}
        style={[styles.input, styles.passwordInput]}
        value={props.value}
        onChangeText={props.onChangeText}
        secureTextEntry={!visible}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete={props.isNew ? 'new-password' : 'current-password'}
        textContentType={props.isNew ? 'newPassword' : 'password'}
        returnKeyType={props.returnKeyType}
        onSubmitEditing={props.onSubmitEditing}
        submitBehavior={props.returnKeyType === 'next' ? 'submit' : 'blurAndSubmit'}
        accessibilityLabel={props.accessibilityLabel}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        style={styles.showButton}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Hide password' : 'Show password'}
      >
        <Text style={styles.showText}>{visible ? 'Hide' : 'Show'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  account: { marginBottom: 12 },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start' },
  deleteLink: { color: '#B00020', fontSize: 13 },
  email: { flex: 1, color: '#555', fontSize: 13 },
  link: { color: '#0B5CAD', fontWeight: '600', fontSize: 14, marginBottom: 12 },
  inlineLink: { color: '#0B5CAD', fontWeight: '600' },
  disabled: { color: '#999' },
  muted: { color: '#777', fontSize: 13, marginBottom: 8 },
  small: { color: '#777', fontSize: 12, textAlign: 'center', marginTop: 4 },
  body: { color: '#333', fontSize: 14, marginBottom: 8 },
  bold: { fontWeight: '700' },
  error: { color: '#B00020', backgroundColor: '#FDECEE', fontSize: 13, padding: 10, borderRadius: 10, marginBottom: 8 },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: '#E8F5F3',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  noteText: { flex: 1, color: '#0B4F4C', fontSize: 14 },
  noteClose: { color: '#0B4F4C', fontSize: 14 },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E3E7EB',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  cardTitle: { fontSize: 20, fontWeight: '700', color: '#0B3B5B', marginBottom: 6 },
  label: { fontSize: 13, color: '#555', marginBottom: 4, marginTop: 6 },
  input: {
    borderWidth: 1,
    borderColor: '#D5D9DE',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, paddingRight: 64 },
  showButton: { position: 'absolute', right: 0, paddingHorizontal: 12, paddingVertical: 10 },
  showText: { color: '#0B7A75', fontWeight: '600', fontSize: 14 },
  primary: {
    backgroundColor: '#0B7A75',
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 10,
  },
  pressed: { opacity: 0.7 },
  primaryText: { color: '#fff', fontWeight: '600', fontSize: 16 },
  center: { alignItems: 'center' },
  divider: { height: 1, backgroundColor: '#EEF0F2', marginVertical: 10 },
  switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'baseline', gap: 6 },
});
