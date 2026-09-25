import { cognitoConfig } from '@/config/cognito';

const API_GATEWAY_URL = cognitoConfig.apiGatewayUrl || '/api/v1';

// Interfaces
export interface UserCreate {
  username: string;
  email: string;
  password: string;
  role?: string;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserLogin {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

/**
 * Realiza una solicitud HTTP estructurada hacia la API del backend.
 * 
 * Configura de forma transparente las cabeceras requeridas, el modo CORS y
 * la cabecera `Authorization: Bearer <token>` si se suministra un token de acceso activo.
 * 
 * @template T Estructura de tipo esperada en la respuesta JSON.
 * @param endpoint Ruta relativa del recurso (p. ej. `/auth/me`).
 * @param options Parámetros de configuración nativos del `fetch` API.
 * @param accessToken Token JWT de acceso (opcional).
 * @returns Promesa que se resuelve con la respuesta tipada del servidor.
 * @throws Error conteniendo el detalle del mensaje de fallo si la respuesta no es exitosa (ok = false).
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  accessToken?: string
): Promise<T> {
  // Construir URL del endpoint
  const url = endpoint.startsWith('http')
    ? endpoint
    : `${API_GATEWAY_URL}${endpoint}`;

  // Preparar headers
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  // Agregar token de autorización si está disponible
  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const config: RequestInit = {
    mode: 'cors',
    ...options,
    headers,
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail ||
        errorData.message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return await response.json();
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

/**
 * Agrupación de operaciones REST para la autenticación y perfiles de usuario.
 */
export const authAPI = {
  /**
   * Registra un nuevo usuario local en el backend.
   * 
   * @param userData Atributos del nuevo usuario.
   */
  register: async (userData: UserCreate): Promise<UserResponse> => {
    return apiRequest<UserResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  /**
   * Valida credenciales e inicia sesión local (Desarrollo).
   * 
   * Nota: Si se utiliza el modo de producción con AWS Cognito,
   * se debe usar la instancia `cognitoAuthService` en su lugar.
   * 
   * @param credentials Nombre de usuario y contraseña local.
   */
  login: async (credentials: UserLogin): Promise<TokenResponse> => {
    return apiRequest<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Obtiene un nuevo token de acceso a partir del refresh token local.
   * 
   * @param refreshToken Token JWT de refresco local.
   */
  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    return apiRequest<TokenResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  /**
   * Notifica al servidor backend la revocación de la sesión actual.
   * 
   * @param refreshToken Token JWT de refresco a invalidar.
   */
  logout: async (refreshToken: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  /**
   * Recupera el perfil completo del usuario autenticado en la solicitud actual.
   * 
   * @param accessToken Token de acceso del portador.
   */
  getMe: async (accessToken: string): Promise<UserResponse> => {
    return apiRequest<UserResponse>(
      '/auth/me',
      {
        method: 'GET',
      },
      accessToken
    );
  },
};

/**
 * Agrupación de operaciones REST para la consulta de sensores, mapas, control de misiones y descargas de reportes.
 */
export const dataAPI = {
  /**
   * Obtiene la lectura agregada actual de sensores (Simulado).
   * 
   * @param accessToken Token de acceso del portador.
   */
  getSensors: async (accessToken: string) => {
    return apiRequest(
      '/data/sensors',
      {
        method: 'GET',
      },
      accessToken
    );
  },

  /**
   * Obtiene la lectura histórica de un sensor específico.
   * 
   * @param sensorId Identificador del sensor.
   * @param accessToken Token de acceso del portador.
   */
  getSensorData: async (sensorId: string, accessToken: string) => {
    return apiRequest(
      `/data/sensors/${sensorId}`,
      {
        method: 'GET',
      },
      accessToken
    );
  },

  /**
   * Obtiene la ubicación GPS actual y modo de renderizado (Simulado).
   * 
   * @param accessToken Token de acceso.
   */
  getMapData: async (accessToken: string) => {
    return apiRequest(
      '/data/location',
      {
        method: 'GET',
      },
      accessToken
    );
  },

  /**
   * Obtiene el listado histórico de misiones registradas.
   * 
   * @param accessToken Token de acceso.
   */
  getMissions: async (accessToken: string) => {
    return apiRequest<any[]>(
      '/data/missions',
      {
        method: 'GET',
      },
      accessToken
    );
  },

  /**
   * Registra e inicia una nueva misión enviando la colección de waypoints al backend.
   * 
   * @param name Nombre personalizado para identificar la misión.
   * @param points Colección de coordenadas (latitud, longitud) del recorrido.
   * @param accessToken Token de acceso del portador.
   */
  createMission: async (name: string, points: {lat: number, lng: number}[], accessToken: string) => {
    return apiRequest<any>(
      '/data/missions',
      {
        method: 'POST',
        body: JSON.stringify({ name, points }),
      },
      accessToken
    );
  },

  /**
   * Solicita al backend finalizar una misión activa.
   * 
   * @param missionId Identificador único de la misión.
   * @param accessToken Token de acceso.
   */
  finishMission: async (missionId: string, accessToken: string) => {
    return apiRequest<any>(
      `/data/missions/${missionId}/finish`,
      {
        method: 'PATCH',
      },
      accessToken
    );
  },

  /**
   * Envía la orden para pausar una misión activa.
   * 
   * @param missionId Identificador único de la misión.
   * @param accessToken Token de acceso.
   */
  pauseMission: async (missionId: string, accessToken: string) => {
    return apiRequest<any>(
      `/data/missions/${missionId}/pause`,
      {
        method: 'PATCH',
      },
      accessToken
    );
  },

  /**
   * Envía la orden para reanudar una misión pausada.
   * 
   * @param missionId Identificador único de la misión.
   * @param accessToken Token de acceso.
   */
  resumeMission: async (missionId: string, accessToken: string) => {
    return apiRequest<any>(
      `/data/missions/${missionId}/resume`,
      {
        method: 'PATCH',
      },
      accessToken
    );
  },

  /**
   * Solicita la compilación y descarga del reporte ejecutivo PDF estructurado con IA (Gemini).
   * 
   * Abre la conexión de red y recupera la respuesta HTTP directa como un objeto `Blob` binario.
   * 
   * @param missionId Identificador único de la misión finalizada.
   * @param accessToken Token de acceso.
   * @returns El archivo binario PDF resultante en formato Blob.
   */
  generateReport: async (missionId: string, accessToken: string) => {
    const url = `/reports/generate?mission_id=${encodeURIComponent(missionId)}`;
    const endpoint = url.startsWith('http') ? url : `${cognitoConfig.apiGatewayUrl || '/api/v1'}${url}`;
    
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail ||
        errorData.message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return response.blob();
  },

  /**
   * Descarga el reporte histórico consolidado de lecturas en formato CSV.
   * 
   * @param missionId Identificador único de la misión.
   * @param accessToken Token de acceso.
   * @returns El archivo plano de texto en formato Blob.
   */
  generateCsvReport: async (missionId: string, accessToken: string) => {
    const url = `/reports/generate_csv?mission_id=${encodeURIComponent(missionId)}`;
    const endpoint = url.startsWith('http') ? url : `${cognitoConfig.apiGatewayUrl || '/api/v1'}${url}`;
    
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage =
        errorData.detail ||
        errorData.message ||
        `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(errorMessage);
    }

    return response.blob();
  },
};
