// Same shape as the backend's TripPlan (tripmate_backend: model/TripPlan.java).

export type TravelStyle = 'BUDGET' | 'MIDRANGE' | 'COMFORT';
export type TransportMode = 'TRANSIT' | 'TAXI' | 'CAR_WITH_DRIVER' | 'SELF_DRIVE';

export type PlanRequest = {
  country: string;
  city: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  travelers?: number; // 1–12, default 1
  style?: TravelStyle; // default MIDRANGE
  transport?: TransportMode; // default TRANSIT
  stayAt?: string; // hotel name or area; each day starts and ends there
};

// Where the traveller stays; found=false means it couldn't be located (hotel trips not counted)
export type Stay = {
  requested: string;
  found: boolean;
  name: string | null;
  latitude: number | null;
  longitude: number | null;
};

export type Money = { local: number; sgd: number };

export type Stop = {
  order: number;
  name: string;
  arriveAt: string; // HH:mm:ss
  openingHours: string;
  entryFee: Money;
  limits: string[];
  latitude: number | null; // from Google Places; null for the sample plan
  longitude: number | null;
  photoUrl: string | null; // temporary Google image link; null if none
  photoCredit: string | null; // photographer's name, must be shown with the photo
};

export type Day = {
  dayNumber: number;
  date: string;
  weather: { summary: string; minTempC: number; maxTempC: number };
  stops: Stop[];
  // Whole group's cost for the day; transportNote explains it, e.g. "3 taxi rides, about 13 km"
  budget: { entry: Money; food: Money; transport: Money; total: Money; transportNote: string };
};

export type TripPlan = {
  country: string;
  city: string;
  startDate: string;
  endDate: string;
  travelers: number;
  style: TravelStyle;
  transport: TransportMode;
  stay: Stay | null;
  localCurrency: string;
  thingsToBring: string[];
  mustTryFood: { name: string; description: string }[];
  carRental: { type: string; pricePerDay: Money }[];
  days: Day[];
};

export type ApiError = { error: string; details?: string[] };
