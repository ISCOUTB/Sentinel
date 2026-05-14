/**
 * Sentinel HMI — Telemetry Validators
 * 
 * Centralized logic to handle messy IoT data and prevent UI crashes.
 */

/** Verifies if a value is a finite number */
export const isValidCoord = (n: any): n is number => {
  return typeof n === 'number' && Number.isFinite(n);
};

/** 
 * Safely formats a numeric value to a string with decimals.
 * Returns '0.0' or equivalent if the value is invalid.
 */
export const safeVal = (n: any, decimals = 1): string => {
  if (typeof n === 'number' && Number.isFinite(n)) {
    return n.toFixed(decimals);
  }
  return (0).toFixed(decimals);
};

/**
 * Ensures a latitude/longitude pair is valid for Leaflet.
 */
export const isLatLngValid = (lat: any, lng: any): boolean => {
  return isValidCoord(lat) && isValidCoord(lng) && 
         lat >= -90 && lat <= 90 && 
         lng >= -180 && lng <= 180;
};
