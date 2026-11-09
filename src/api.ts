import { Platform } from 'react-native';

import { supabase } from './supabase';
import type { ApiError, PlanRequest, SavedTripFull, SavedTripSummary, TripPlan } from './types';

// EXPO_PUBLIC_API_URL picks the backend: your Mac's Wi-Fi IP for local testing (.env.local), or the online
// address (set for test builds in eas.json). The Android emulator reaches the Mac via 10.0.2.2.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

/** Plans a trip. Logged-in users send their login ticket, which lets the backend make a real AI plan. */
export async function createPlan(request: PlanRequest): Promise<TripPlan> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  let response: Response;
  try {
    response = await fetch(`${API_URL}/plan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error(
      `Can't reach the TripMate server. If it has been idle it may be waking up (up to a minute); please try again.`,
    );
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    const details = body?.details?.length ? `\n• ${body.details.join('\n• ')}` : '';
    throw new Error(`${body?.error ?? `Server error (${response.status})`}${details}`);
  }
  return (await response.json()) as TripPlan;
}

export type CitySuggestion = { city: string; country: string; region: string | null };

/** Cities that start with what the user has typed, biggest first. Empty if the server can't be reached. */
export async function suggestCities(text: string, signal?: AbortSignal): Promise<CitySuggestion[]> {
  try {
    const response = await fetch(`${API_URL}/cities?q=${encodeURIComponent(text)}`, { signal });
    return response.ok ? ((await response.json()) as CitySuggestion[]) : [];
  } catch {
    return []; // offline, server asleep, or a newer search replaced this one
  }
}

/** Calls the backend with the user's Supabase login ticket. */
async function authed<T>(path: string, init: RequestInit = {}): Promise<T> {
  const session = supabase ? (await supabase.auth.getSession()).data.session : null;
  if (!session) {
    throw new Error('Please log in first.');
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}`, ...init.headers },
    });
  } catch {
    throw new Error(`Can't reach the TripMate server at ${API_URL}. Is the backend running?`);
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    const details = body?.details?.length ? `\n• ${body.details.join('\n• ')}` : '';
    throw new Error(`${body?.error ?? `Server error (${response.status})`}${details}`);
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

export const saveTrip = (plan: TripPlan) =>
  authed<SavedTripSummary>('/trips', { method: 'POST', body: JSON.stringify(plan) });
export const listTrips = () => authed<SavedTripSummary[]>('/trips');
export const getTrip = (id: number) => authed<SavedTripFull>(`/trips/${id}`);
export const deleteTrip = (id: number) => authed<void>(`/trips/${id}`, { method: 'DELETE' });
/** Deletes the account for good: saved trips and the login. */
export const deleteAccount = () => authed<void>('/account', { method: 'DELETE' });
