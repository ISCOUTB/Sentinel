
/** Estructura que define los parámetros de conexión para el ecosistema de AWS Cognito y API Gateway */
export interface CognitoConfig {
  /** Identificador del Cognito Identity Pool */
  identityPoolId?: string;
  /** Identificador del Cognito User Pool */
  userPoolId: string;
  /** Identificador del cliente de aplicación web de Cognito */
  userPoolWebClientId: string;
  /** Región geográfica de AWS donde residen los recursos */
  awsRegion: string;
  /** URL base del API Gateway de AWS */
  apiGatewayUrl: string;
}

/**
 * Lee y estructura la configuración de AWS Cognito a partir de variables de entorno de Vite.
 * 
 * Imprime una advertencia preventiva por consola si la configuración requerida es incompleta.
 * 
 * @returns La configuración validada de Cognito.
 */
const getCognitoConfig = (): CognitoConfig => {
  const config: CognitoConfig = {
    identityPoolId: import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID || '',
    userPoolId: import.meta.env.VITE_COGNITO_USER_POOL_ID || '',
    userPoolWebClientId: import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID || '',
    awsRegion: import.meta.env.VITE_AWS_REGION || 'us-east-1',
    apiGatewayUrl: import.meta.env.VITE_API_GATEWAY_URL || '',
  };

  // Validar que tenemos todas las configuraciones necesarias
  if (!config.userPoolId || !config.userPoolWebClientId) {
    console.warn('Cognito no está completamente configurado. Verifica las variables de entorno.');
  }

  return config;
};

export const cognitoConfig = getCognitoConfig();
