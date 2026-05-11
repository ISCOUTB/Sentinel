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
 * Realiza una solicitud HTTP a través del API Gateway
 * Incluye automáticamente el token de autenticación si está disponible
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
 * API para operaciones de autenticación a través del API Gateway
 */
export const authAPI = {
  /**
   * Registra un nuevo usuario
   */
  register: async (userData: UserCreate): Promise<UserResponse> => {
    return apiRequest<UserResponse>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  },

  /**
   * Inicia sesión (para usuarios que usan autenticación del backend)
   * Note: Con Cognito, usarás cognitoAuthService.login() en su lugar
   */
  login: async (credentials: UserLogin): Promise<TokenResponse> => {
    return apiRequest<TokenResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
  },

  /**
   * Refresca el access token
   */
  refresh: async (refreshToken: string): Promise<TokenResponse> => {
    return apiRequest<TokenResponse>('/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  /**
   * Cierra sesión
   */
  logout: async (refreshToken: string): Promise<{ message: string }> => {
    return apiRequest<{ message: string }>('/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  },

  /**
   * Obtiene los datos del usuario actual
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
 * API para operaciones de datos
 */
export const dataAPI = {
  /**
   * Obtiene todos los sensores
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
   * Obtiene datos de un sensor específico
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
   * Obtiene datos de ubicación
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
   * Obtiene la lista de misiones
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
   * Crea una nueva misión
   */
  createMission: async (name: string, accessToken: string) => {
    return apiRequest<any>(
      '/data/missions',
      {
        method: 'POST',
        body: JSON.stringify({ name }),
      },
      accessToken
    );
  },

  /**
   * Finaliza una misión
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
   * Genera un reporte PDF con IA
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
};
