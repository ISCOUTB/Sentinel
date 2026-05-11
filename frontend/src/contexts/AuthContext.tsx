import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { cognitoAuthService } from '@/services/cognitoAuthService';
import { authAPI, UserResponse } from '@/api/gateway';
import { cognitoConfig } from '@/config/cognito';

// Helper para decodificar JWT y obtener el nombre completo
const parseJwt = (token: string) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
};

const getFullNameFromToken = (idToken: string | null): string | null => {
  if (!idToken) return null;
  const payload = parseJwt(idToken);
  if (!payload) return null;
  
  const givenName = payload.given_name || '';
  const familyName = payload.family_name || '';
  
  if (givenName || familyName) {
    return `${givenName} ${familyName}`.trim();
  }
  
  return payload.name || null;
};

// Obtiene el email del JWT payload
const getEmailFromToken = (idToken: string | null): string | null => {
  if (!idToken) return null;
  const payload = parseJwt(idToken);
  if (!payload) return null;
  return payload.email || null;
};

// Interfaces
interface AuthState {
  user: UserResponse | null;
  username: string | null;
  fullName: string | null;
  accessToken: string | null;
  idToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  useCognito: boolean; // Determina si usamos Cognito o autenticación backend
}

interface AuthContextType extends AuthState {
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string, name?: string, lastName?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

// Contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Detectar si Cognito está disponible
  const useCognito = !!(cognitoConfig.userPoolId && cognitoConfig.userPoolWebClientId);

  const [state, setState] = useState<AuthState>({
    user: null,
    username: null,
    fullName: null,
    accessToken: null,
    idToken: null,
    refreshToken: null,
    isLoading: true,
    isAuthenticated: false,
    useCognito,
  });

  // Cargar sesión al iniciar si existe
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (useCognito) {
          // Cognito: intentar recuperar sesión completa
          const sessionData = await cognitoAuthService.getSessionData();
          if (sessionData) {
            let fullName = getFullNameFromToken(sessionData.idToken);
            let displayUsername = getEmailFromToken(sessionData.idToken) || sessionData.username;
            
            // Intentar obtener atributos completos de Cognito si faltan en el token
            try {
              const attrs = await cognitoAuthService.getUserAttributes(sessionData.username);
              if (!fullName && (attrs['given_name'] || attrs['family_name'])) {
                fullName = `${attrs['given_name'] || ''} ${attrs['family_name'] || ''}`.trim();
              }
              if (attrs['email']) {
                displayUsername = attrs['email'];
              }
            } catch (err) {
              console.warn("No se pudieron obtener atributos extra", err);
            }

            setState((prev) => ({
              ...prev,
              username: displayUsername,
              fullName: fullName,
              accessToken: sessionData.accessToken,
              idToken: sessionData.idToken,
              refreshToken: sessionData.refreshToken,
              isAuthenticated: true,
              useCognito: true,
            }));
          }
        } else {
          // Backend local: recuperar del localStorage
          const accessToken = localStorage.getItem('accessToken');
          const refreshToken = localStorage.getItem('refreshToken');

          if (accessToken && refreshToken) {
            setState((prev) => ({
              ...prev,
              accessToken,
              refreshToken,
              isAuthenticated: true,
              useCognito: false,
            }));

            try {
              const user = await authAPI.getMe(accessToken);
              setState((prev) => ({
                ...prev,
                user,
              }));
            } catch {
              // Si falla, intentar refrescar el token
              try {
                const tokenResponse = await authAPI.refresh(refreshToken);
                localStorage.setItem('accessToken', tokenResponse.access_token);
                localStorage.setItem('refreshToken', tokenResponse.refresh_token);
                setState((prev) => ({
                  ...prev,
                  accessToken: tokenResponse.access_token,
                  refreshToken: tokenResponse.refresh_token,
                }));
              } catch {
                // Si todo falla, limpiar
                localStorage.removeItem('accessToken');
                localStorage.removeItem('refreshToken');
              }
            }
          }
        }
      } catch (error) {
        console.error('Error inicializando autenticación:', error);
      } finally {
        setState((prev) => ({
          ...prev,
          isLoading: false,
        }));
      }
    };

    initializeAuth();
  }, [useCognito]);

  const login = async (username: string, password: string) => {
    try {
      if (useCognito) {
        // Usar Cognito
        const { accessToken, idToken, refreshToken } = await cognitoAuthService.login(
          username,
          password
        );

        // Guardar tokens en localStorage
        localStorage.setItem('accessToken', accessToken);
        localStorage.setItem('idToken', idToken);
        localStorage.setItem('refreshToken', refreshToken);
        localStorage.setItem('username', username);

        let fullName = getFullNameFromToken(idToken);
        let displayUsername = getEmailFromToken(idToken) || username;

        try {
          // Aunque tenemos username de login, obtenemos los atributos por si el idToken no trae el nombre
          const attrs = await cognitoAuthService.getUserAttributes(username);
          if (!fullName && (attrs['given_name'] || attrs['family_name'])) {
             fullName = `${attrs['given_name'] || ''} ${attrs['family_name'] || ''}`.trim();
          }
        } catch (err) {
          console.warn("No se pudieron obtener atributos extra al login", err);
        }

        setState((prev) => ({
          ...prev,
          username: displayUsername,
          fullName: fullName,
          accessToken,
          idToken,
          refreshToken,
          isAuthenticated: true,
          useCognito: true,
        }));

        // Opcionalmente, obtener datos adicionales del backend
        try {
          const user = await authAPI.getMe(accessToken);
          setState((prev) => ({
            ...prev,
            user,
          }));
        } catch (error) {
          // El usuario autenticado en Cognito pero no existe en el backend
          // Esto es normal y se puede manejar según tus requerimientos
          console.warn(
            'Usuario autenticado en Cognito pero no encontrado en el backend:',
            error
          );
        }
      } else {
        throw new Error('Backend authentication not available');
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        isAuthenticated: false,
      }));
      throw error;
    }
  };

  const register = async (username: string, email: string, password: string, name?: string, lastName?: string) => {
    try {
      if (useCognito) {
        // Registrarse en Cognito
        await cognitoAuthService.register(username, email, password, name, lastName);
        // El usuario necesitará confirmar su email antes de poder hacer login
      } else {
        throw new Error('Backend registration not available');
      }
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (useCognito && state.username) {
        // Logout de Cognito
        await cognitoAuthService.logout(state.username);
      } else if (!useCognito && state.refreshToken) {
        // Logout del backend
        try {
          await authAPI.logout(state.refreshToken);
        } catch {
          // Ignorar errores de logout en el servidor
        }
      }

      // Limpiar localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('idToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('username');

      setState({
        user: null,
        username: null,
        fullName: null,
        accessToken: null,
        idToken: null,
        refreshToken: null,
        isLoading: false,
        isAuthenticated: false,
        useCognito,
      });
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
      throw error;
    }
  };

  const refreshAccessToken = async () => {
    try {
      if (useCognito && state.username && state.refreshToken) {
        // Refrescar token en Cognito
        const newAccessToken = await cognitoAuthService.refreshToken(
          state.username,
          state.refreshToken
        );

        localStorage.setItem('accessToken', newAccessToken);

        setState((prev) => ({
          ...prev,
          accessToken: newAccessToken,
        }));
      } else if (!useCognito && state.refreshToken) {
        // Refrescar token en el backend
        const tokenResponse = await authAPI.refresh(state.refreshToken);

        localStorage.setItem('accessToken', tokenResponse.access_token);
        localStorage.setItem('refreshToken', tokenResponse.refresh_token);

        setState((prev) => ({
          ...prev,
          accessToken: tokenResponse.access_token,
          refreshToken: tokenResponse.refresh_token,
        }));
      }
    } catch (error) {
      // Si el refresh falla, hacer logout
      await logout();
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        refreshAccessToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar el contexto
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
};