// Same shape as the backend's TripPlan (tripmate_backend: model/TripPlan.java).

export type PlanRequest = {
  country: string;
  city: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
};

export type Money = { local: number; sgd: number };

export type Stop = {
  order: number;
  name: string;
  arriveAt: string; // HH:mm:ss
  openingHours: string;
  entryFee: Money;
  limits: string[];
};

export type Day = {
  dayNumber: number;
  date: string;
  weather: { summary: string; minTempC: number; maxTempC: number };
  stops: Stop[];
  budget: { entry: Money; food: Money; transport: Money; total: Money };
};

export type TripPlan = {
  country: string;
  city: string;
  startDate: string;
  endDate: string;
  localCurrency: string;
  thingsToBring: string[];
  mustTryFood: { name: string; description: string }[];
  carRental: { type: string; pricePerDay: Money }[];
  days: Day[];
};

export type ApiError = { error: string; details?: string[] };
