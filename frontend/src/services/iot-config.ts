// ─────────────────────────────────────────────────────────────────────────────
// Sentinel HMI — AWS IoT Core connection service
//
// Estrategia de conexión:
//   1. El usuario se autentica con Cognito y obtenemos su idToken.
//   2. Usamos ese idToken para obtener credenciales AWS temporales del
//      Identity Pool de Cognito (STS AssumeRoleWithWebIdentity).
//   3. Con esas credenciales firmamos una URL presignada de WebSocket
//      usando el protocolo AWS SigV4 (wss://endpoint/mqtt).
//   4. Conectamos con el cliente MQTT nativo del SDK v2.
//
// Variables de entorno requeridas (prefijo VITE_):
//   VITE_IOT_ENDPOINT          — p.ej. xxxxxxxxxxxxxx-ats.iot.us-east-1.amazonaws.com
//   VITE_AWS_REGION            — p.ej. us-east-1
//   VITE_COGNITO_IDENTITY_POOL_ID — p.ej. us-east-1:xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
//   VITE_COGNITO_USER_POOL_ID  — p.ej. us-east-1_XXXXXXXXX
// ─────────────────────────────────────────────────────────────────────────────

import { mqtt, iot } from 'aws-iot-device-sdk-v2';
import { fromCognitoIdentityPool } from '@aws-sdk/credential-providers';

// ─── Configuración leída de variables de entorno ──────────────────────────────

const IOT_ENDPOINT = import.meta.env.VITE_IOT_ENDPOINT as string;
const REGION = (import.meta.env.VITE_AWS_REGION as string) ?? 'us-east-1';
const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID as string;
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID as string;

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type MqttConnection = mqtt.MqttClientConnection;

// ─── Función principal de conexión ────────────────────────────────────────────

/**
 * Crea y conecta un cliente MQTT a AWS IoT Core usando credenciales
 * temporales de Cognito Identity Pool.
 *
 * @param idToken - Token ID de Cognito obtenido tras la autenticación del usuario.
 * @returns Conexión MQTT lista para publicar/suscribir.
 *
 * @example
 * const conn = await createIoTConnection(idToken);
 * await conn.subscribe('USV-001/general_usv_status', mqtt.QoS.AtLeastOnce, onMessage);
 */
export async function createIoTConnection(idToken: string): Promise<MqttConnection> {
  if (!IOT_ENDPOINT || !IDENTITY_POOL_ID || !USER_POOL_ID) {
    throw new Error(
      '[IoT] Variables de entorno incompletas. Verifica VITE_IOT_ENDPOINT, ' +
        'VITE_COGNITO_IDENTITY_POOL_ID y VITE_COGNITO_USER_POOL_ID en tu archivo .env'
    );
  }

  // 1. Proveedor de credenciales AWS temporales a partir del idToken de Cognito
  const cognitoLoginKey = `cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

  const credentialsProvider = fromCognitoIdentityPool({
    identityPoolId: IDENTITY_POOL_ID,
    logins: { [cognitoLoginKey]: idToken },
    clientConfig: { region: REGION },
  });

  // 2. Resolver credenciales (necesario para firmar la URL del WebSocket)
  const credentials = await credentialsProvider();

  // 3. Construir la configuración de conexión WebSocket con SigV4
  //    El client_id `sentinel_hmi_*` debe coincidir con la política IoT de tu TF.
  const clientId = `sentinel_hmi_${Math.random().toString(36).substring(2, 9)}`;

  const config = iot.AwsIotMqttConnectionConfigBuilder.new_websocket_builder()
    .with_clean_session(true)
    .with_client_id(clientId)
    .with_endpoint(IOT_ENDPOINT)
    .with_credentials(
      REGION,
      credentials.accessKeyId,
      credentials.secretAccessKey,
      credentials.sessionToken
    )
    .with_keep_alive_seconds(30)
    .build();

  // 4. Crear cliente y conectar
  const client = new mqtt.MqttClient();
  const connection = client.new_connection(config);

  await connection.connect();
  console.log(`[IoT] Conectado a ${IOT_ENDPOINT} con clientId=${clientId}`);

  return connection;
}