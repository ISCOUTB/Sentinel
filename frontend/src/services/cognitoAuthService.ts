import {
  CognitoUserPool,
  CognitoUser,
  AuthenticationDetails,
  CognitoUserAttribute,
} from 'amazon-cognito-identity-js';
import { cognitoConfig } from '@/config/cognito';

class CognitoAuthService {
  private userPool: CognitoUserPool;

  constructor() {
    this.userPool = new CognitoUserPool({
      UserPoolId: cognitoConfig.userPoolId,
      ClientId: cognitoConfig.userPoolWebClientId,
    });
  }

  /**
   * Registra un nuevo usuario en Cognito
   */
  async register(username: string, email: string, password: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const attributeList = [
        new CognitoUserAttribute({
          Name: 'email',
          Value: email,
        }),
      ];

      this.userPool.signUp(username, password, attributeList, [], (err, result) => {
        if (err) {
          reject(new Error(err.message || 'Error durante el registro'));
        } else {
          // Usuario creado pero necesita confirmar email
          resolve();
        }
      });
    });
  }

  /**
   * Confirma el registro del usuario con el código enviado al email
   */
  async confirmSignUp(username: string, confirmationCode: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: this.userPool,
      });

      cognitoUser.confirmRegistration(confirmationCode, true, (err, result) => {
        if (err) {
          reject(new Error(err.message || 'Error confirmando la cuenta'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Reenvía el código de confirmación al email del usuario
   */
  async resendConfirmationCode(username: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: this.userPool,
      });

      cognitoUser.resendConfirmationCode((err, result) => {
        if (err) {
          reject(new Error(err.message || 'Error reenviando código de confirmación'));
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Inicia sesión con username y contraseña
   */
  async login(username: string, password: string): Promise<{
    accessToken: string;
    idToken: string;
    refreshToken: string;
  }> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: this.userPool,
      });

      const authenticationDetails = new AuthenticationDetails({
        Username: username,
        Password: password,
      });

      cognitoUser.authenticateUser(authenticationDetails, {
        onSuccess: (result) => {
          const accessToken = result.getAccessToken().getJwtToken();
          const idToken = result.getIdToken().getJwtToken();
          const refreshToken = result.getRefreshToken().getToken();

          resolve({
            accessToken,
            idToken,
            refreshToken,
          });
        },
        onFailure: (err) => {
          reject(new Error(err.message || 'Error al iniciar sesión'));
        },
      });
    });
  }

  /**
   * Refresca el access token usando el refresh token
   */
  async refreshToken(username: string, refreshToken: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const cognitoUser = new CognitoUser({
        Username: username,
        Pool: this.userPool,
      });

      const RefreshToken = {
        getToken: () => refreshToken,
      };

      cognitoUser.refreshSession(RefreshToken, (err, session) => {
        if (err) {
          reject(new Error(err.message || 'Error al refrescar el token'));
        } else {
          const newAccessToken = session.getAccessToken().getJwtToken();
          resolve(newAccessToken);
        }
      });
    });
  }

  /**
   * Obtiene el usuario activo
   */
  async getCurrentUser(): Promise<CognitoUser | null> {
    const user = this.userPool.getCurrentUser();
    if (!user) {
      return null;
    }

    return new Promise((resolve, reject) => {
      user.getSession((err, session) => {
        if (err || !session || !session.isValid()) {
          reject(new Error('Sesión inválida'));
        } else {
          resolve(user);
        }
      });
    });
  }

  /**
   * Obtiene los atributos del usuario actual
   */
  async getUserAttributes(username: string): Promise<Record<string, string>> {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.getUserAttributes((err, attributes) => {
        if (err) {
          reject(new Error(err.message || 'Error al obtener atributos del usuario'));
        } else {
          const userAttributes: Record<string, string> = {};
          if (attributes) {
            attributes.forEach((attr) => {
              userAttributes[attr.Name] = attr.Value;
            });
          }
          resolve(userAttributes);
        }
      });
    });
  }

  /**
   * Cierra sesión
   */
  async logout(username: string): Promise<void> {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: this.userPool,
    });

    return new Promise((resolve) => {
      cognitoUser.signOut(() => {
        resolve();
      });
    });
  }

  /**
   * Obtiene el access token del usuario actual
   */
  async getAccessToken(username: string): Promise<string> {
    const cognitoUser = new CognitoUser({
      Username: username,
      Pool: this.userPool,
    });

    return new Promise((resolve, reject) => {
      cognitoUser.getSession((err, session) => {
        if (err || !session) {
          reject(new Error('No hay sesión activa'));
        } else {
          resolve(session.getAccessToken().getJwtToken());
        }
      });
    });
  }
}

export const cognitoAuthService = new CognitoAuthService();
