import { Platform } from 'react-native';

import type { ApiError, PlanRequest, TripPlan } from './types';

// Set EXPO_PUBLIC_API_URL in .env to point at another backend (e.g. your Mac's Wi-Fi IP
// for a real phone, or the AWS address later). The Android emulator reaches the Mac via 10.0.2.2.
const API_URL =
  process.env.EXPO_PUBLIC_API_URL ??
  (Platform.OS === 'android' ? 'http://10.0.2.2:8080' : 'http://localhost:8080');

export async function createPlan(request: PlanRequest): Promise<TripPlan> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/plan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch {
    throw new Error(`Can't reach the TripMate server at ${API_URL}. Is the backend running?`);
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ApiError | null;
    const details = body?.details?.length ? `\n• ${body.details.join('\n• ')}` : '';
    throw new Error(`${body?.error ?? `Server error (${response.status})`}${details}`);
  }
  return (await response.json()) as TripPlan;
}
