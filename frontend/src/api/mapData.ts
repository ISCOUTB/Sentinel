import { apiRequest } from './auth';

export interface MapCoordinates {
    lat: number;
    lng: number;
}

export interface MapDataResponse {
    location: string;
    mode: string;
    coordinates: MapCoordinates;
}

export async function fetchMapData(): Promise<MapDataResponse> {
  const token = localStorage.getItem('accessToken');
  if (!token) {
      throw new Error("No authorization token found");
  }

  return apiRequest<MapDataResponse>('/data/map', {
     headers: { Authorization: `Bearer ${token}` }
  });
}
