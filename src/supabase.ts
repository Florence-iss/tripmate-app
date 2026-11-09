import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

// Supabase project URL and publishable (anon) key: both are public by design and live in .env.local.
const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

/** The TripMate website. Links in TripMate emails (confirm email, reset password) open here. */
export const WEB_URL = 'https://tripmate-app.expo.app';

/** Where email links should land: this website when running in a browser, otherwise the live website. */
export function emailLinkTarget(): string {
  return Platform.OS === 'web' && typeof window !== 'undefined' ? window.location.origin : WEB_URL;
}

/**
 * Why an email link brought the user to the website, read from the address before Supabase uses it:
 * 'signup' = email confirmed, 'recovery' = reset password, or an error such as an expired link.
 */
export type EmailLink = { kind: 'signup' | 'recovery' | 'other' } | { kind: 'error'; message: string } | null;

function readEmailLink(): EmailLink {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const query = new URLSearchParams(window.location.search);
  const errorCode = params.get('error_code') ?? query.get('error_code');
  const errorText = params.get('error_description') ?? query.get('error_description');
  if (errorCode || errorText) {
    clearAddress(); // nothing for Supabase to use; just tidy the address bar
    return {
      kind: 'error',
      message:
        errorCode === 'otp_expired'
          ? 'That email link has expired or was already used. Log in, or ask for a new link.'
          : (errorText ?? 'That email link did not work. Please try again.').replace(/\+/g, ' '),
    };
  }
  const type = params.get('type');
  if (!type) return null;
  return { kind: type === 'signup' || type === 'recovery' ? type : 'other' };
}

/** Removes the login details an email link put in the address bar, so they aren't bookmarked or shared. */
export function clearAddress() {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && (window.location.hash || window.location.search)) {
    window.history.replaceState(null, '', window.location.pathname);
  }
}

export const emailLink: EmailLink = readEmailLink();

/** null until the Supabase settings are added; the app then works without login. */
export const supabase: SupabaseClient | null =
  url && key
    ? createClient(url, key, {
        auth: {
          storage: AsyncStorage,
          autoRefreshToken: true,
          persistSession: true,
          // On the website, log in from the email link's address; phone apps never open those links
          detectSessionInUrl: Platform.OS === 'web',
        },
      })
    : null;

// Only refresh the login in the background while the app is open (Supabase's advice for mobile apps).
if (supabase) {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
