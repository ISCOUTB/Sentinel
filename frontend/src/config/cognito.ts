
export interface CognitoConfig {
  identityPoolId?: string; // Opcional - solo necesario si accedes a recursos AWS
  userPoolId: string;
  userPoolWebClientId: string;
  awsRegion: string;
  apiGatewayUrl: string;
}

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
