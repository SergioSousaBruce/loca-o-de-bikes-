// Mathematical and Geolocation Utilities for PEDALAÊ Live Tracking

export interface LatLng {
  lat: number;
  lng: number;
  timestamp?: number;
  speed?: number | null; // in m/s
  accuracy?: number;
}

// Parintins-AM Official Pedalaê Station Point (Praça da Catedral / Orla de Parintins)
export const PEDALAE_STATION_COORDS: LatLng = {
  lat: -2.628854,
  lng: -56.732890,
};

// Earth radius in kilometers
const EARTH_RADIUS_KM = 6371;

/**
 * Calculates great-circle distance between two points in kilometers using Haversine formula
 */
export function calculateDistanceKm(point1: LatLng, point2: LatLng): number {
  const dLat = degreesToRadians(point2.lat - point1.lat);
  const dLon = degreesToRadians(point2.lng - point1.lng);

  const lat1Rad = degreesToRadians(point1.lat);
  const lat2Rad = degreesToRadians(point2.lat);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1Rad) * Math.cos(lat2Rad);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Filters GPS jitter: ignore movement under minDistanceMeters to save battery and avoid false odometer increments
 */
export function isSignificantMovement(
  lastPoint: LatLng | null,
  newPoint: LatLng,
  minDistanceMeters: number = 8
): boolean {
  if (!lastPoint) return true;
  const distKm = calculateDistanceKm(lastPoint, newPoint);
  return distKm * 1000 >= minDistanceMeters;
}

/**
 * Filters GPS speed: clamps absurd jumps and computes smoothed km/h
 */
export function formatSpeedKmH(speedMps?: number | null): number {
  if (speedMps === null || speedMps === undefined || speedMps < 0) return 0;
  const kmh = speedMps * 3.6;
  // Bicycles rarely exceed 45 km/h in urban strolls; filter absurd sensor noise
  if (kmh > 45) return 22.0;
  return Math.round(kmh * 10) / 10;
}

/**
 * Estimates bicycle return time in minutes based on distance
 * Average urban bicycle touring speed in Parintins: ~12 km/h (0.2 km per min)
 */
export function estimateBikeReturnMinutes(distanceKm: number, avgSpeedKmH: number = 12): number {
  const speed = Math.max(8, avgSpeedKmH || 12);
  const hours = distanceKm / speed;
  const minutes = Math.ceil(hours * 60);
  return Math.max(1, minutes);
}

/**
 * Formats seconds into HH:MM:SS format
 */
export function formatDurationHMS(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSec / 3600);
  const minutes = Math.floor((safeSec % 3600) / 60);
  const seconds = safeSec % 60;

  return [
    String(hours).padStart(2, '0'),
    String(minutes).padStart(2, '0'),
    String(seconds).padStart(2, '0'),
  ].join(':');
}

/**
 * Parses a date (YYYY-MM-DD) and time (HH:mm) into epoch milliseconds
 */
export function parseDateTimeToEpoch(dateStr: string, timeStr: string): number {
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dt = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0, 0);
  return dt.getTime();
}
