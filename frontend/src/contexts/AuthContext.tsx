import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authAPI, UserResponse, UserLogin, UserCreate, TokenResponse } from '@/api/auth';

// Interfaces
interface AuthState {
  user: UserResponse | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (credentials: UserLogin) => Promise<void>;
  register: (userData: UserCreate) => Promise<void>;
  logout: () => Promise<void>;
  refreshAccessToken: () => Promise<void>;
}

// Contexto
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    accessToken: null,
    refreshToken: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Cargar tokens del localStorage al iniciar
  useEffect(() => {
    const accessToken = localStorage.getItem('accessToken');
    const refreshToken = localStorage.getItem('refreshToken');

    if (accessToken && refreshToken) {
      setState(prev => ({
        ...prev,
        accessToken,
        refreshToken,
        isAuthenticated: true,
      }));

      // Intentar obtener el usuario actual
      authAPI.getMe(accessToken)
        .then(user => {
          setState(prev => ({
            ...prev,
            user,
            isLoading: false,
          }));
        })
        .catch(() => {
          // Si falla, intentar refresh
          refreshAccessToken();
        });
    } else {
      setState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = async (credentials: UserLogin) => {
    try {
      const tokenResponse: TokenResponse = await authAPI.login(credentials);

      localStorage.setItem('accessToken', tokenResponse.access_token);
      localStorage.setItem('refreshToken', tokenResponse.refresh_token);

      setState(prev => ({
        ...prev,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
        isAuthenticated: true,
      }));

      // Obtener datos del usuario
      const user = await authAPI.getMe(tokenResponse.access_token);
      setState(prev => ({
        ...prev,
        user,
      }));
    } catch (error) {
      throw error;
    }
  };

  const register = async (userData: UserCreate) => {
    try {
      await authAPI.register(userData);
      // Después del registro, el usuario debe hacer login
    } catch (error) {
      throw error;
    }
  };

  const logout = async () => {
    try {
      if (state.refreshToken) {
        await authAPI.logout(state.refreshToken);
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Limpiar estado y localStorage
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  const refreshAccessToken = async () => {
    if (!state.refreshToken) {
      throw new Error('No refresh token available');
    }

    try {
      const tokenResponse: TokenResponse = await authAPI.refresh(state.refreshToken);

      localStorage.setItem('accessToken', tokenResponse.access_token);
      localStorage.setItem('refreshToken', tokenResponse.refresh_token);

      setState(prev => ({
        ...prev,
        accessToken: tokenResponse.access_token,
        refreshToken: tokenResponse.refresh_token,
      }));

      // Actualizar usuario si es necesario
      const user = await authAPI.getMe(tokenResponse.access_token);
      setState(prev => ({
        ...prev,
        user,
      }));
    } catch (error) {
      // Si refresh falla, logout
      await logout();
      throw error;
    }
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    refreshAccessToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook para usar el contexto
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};