/**
 * Sentinel HMI — Telemetry Validators
 * 
 * Centralized logic to handle messy IoT data and prevent UI crashes.
 */

/** 
 * Verifica si un valor provisto corresponde a un número finito válido.
 * 
 * @param n Valor a evaluar.
 * @returns True si el valor es numérico y finito.
 */
export const isValidCoord = (n: any): n is number => {
  return typeof n === 'number' && Number.isFinite(n);
};

/** 
 * Convierte un valor de forma segura a una representación textual con decimales configurados.
 * 
 * Si el valor no es numérico o es inválido, retorna el equivalente formateado de cero.
 * 
 * @param n Valor a formatear.
 * @param decimals Cantidad de decimales requeridos.
 * @returns Representación de cadena del número decimal.
 */
export const safeVal = (n: any, decimals = 1): string => {
  if (typeof n === 'number' && Number.isFinite(n)) {
    return n.toFixed(decimals);
  }
  return (0).toFixed(decimals);
};

/**
 * Valida si un par de coordenadas (latitud y longitud) se encuentran dentro de los rangos reales de la Tierra.
 * 
 * Latitud: [-90, 90] grados. Longitud: [-180, 180] grados.
 * 
 * @param lat Latitud.
 * @param lng Longitud.
 * @returns True si la coordenada es válida.
 */
export const isLatLngValid = (lat: any, lng: any): boolean => {
  return isValidCoord(lat) && isValidCoord(lng) && 
         lat >= -90 && lat <= 90 && 
         lng >= -180 && lng <= 180;
};
