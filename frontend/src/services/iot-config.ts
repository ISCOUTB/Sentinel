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
import { IoTClient, AttachPolicyCommand } from "@aws-sdk/client-iot";
import { CognitoIdentityClient, GetIdCommand } from "@aws-sdk/client-cognito-identity";

// ─── Configuración leída de variables de entorno ──────────────────────────────

const IOT_ENDPOINT = (import.meta.env.VITE_IOT_ENDPOINT as string || '').replace(/^https?:\/\//, '');
const REGION = (import.meta.env.VITE_AWS_REGION as string) ?? 'us-east-1';
const IDENTITY_POOL_ID = import.meta.env.VITE_COGNITO_IDENTITY_POOL_ID as string || '';
const USER_POOL_ID = import.meta.env.VITE_COGNITO_USER_POOL_ID as string || '';
const IOT_POLICY_NAME = import.meta.env.VITE_IOT_POLICY_NAME || "sentinel-hmi-policy";

// ─── Tipos públicos ───────────────────────────────────────────────────────────

export type MqttConnection = mqtt.MqttClientConnection;

// ─── Función principal de conexión ────────────────────────────────────────────

/**
 * Crea, configura y conecta un cliente MQTT a AWS IoT Core.
 * 
 * Flujo detallado del servicio:
 * 1. Utiliza el ID Token del usuario autenticado en Cognito User Pool para realizar un intercambio
 *    con Cognito Identity Pool (mediante `GetIdCommand`), resolviendo el identificador `IdentityId` único.
 * 2. Obtiene credenciales temporales firmadas de AWS (Access Key ID, Secret Access Key y Session Token)
 *    utilizando el proveedor `fromCognitoIdentityPool`.
 * 3. Asocia la política de seguridad requerida de IoT Core al `IdentityId` obtenido en el paso 1 mediante
 *    el SDK de AWS (`AttachPolicyCommand`), asegurando que las credenciales temporales tengan permisos de
 *    suscripción y publicación sobre los tópicos del Thing de IoT Core.
 * 4. Configura el conector MQTT presignado para WebSocket aplicando firmas SigV4 (Signature Version 4)
 *    sobre la URL del WebSocket (`wss://endpoint/mqtt`).
 * 5. Instancia el cliente de MqttClient de aws-iot-device-sdk-v2 e inicia el proceso de conexión
 *    bajo una condición de carrera (`Promise.race`) con un timeout límite de 10 segundos.
 * 
 * @param idToken ID Token firmado provisto tras la autenticación con Cognito User Pool.
 * @returns Promesa que se resuelve con la conexión de MQTT (`MqttConnection`) lista para suscribirse/publicar.
 * @throws Error si faltan variables de entorno esenciales o si ocurre una falla en el aprovisionamiento.
 */
export async function createIoTConnection(idToken: string): Promise<MqttConnection> {
  if (!IOT_ENDPOINT || !IDENTITY_POOL_ID || !USER_POOL_ID) {
    throw new Error(
      '[IoT] Variables de entorno incompletas.'
    );
  }

  const cognitoLoginKey = `cognito-idp.${REGION}.amazonaws.com/${USER_POOL_ID}`;

  // 1. Obtener IdentityId explícitamente
  const cognitoClient = new CognitoIdentityClient({ region: REGION });
  const getIdResponse = await cognitoClient.send(new GetIdCommand({
    IdentityPoolId: IDENTITY_POOL_ID,
    Logins: { [cognitoLoginKey]: idToken }
  }));
  const identityId = getIdResponse.IdentityId;

  if (!identityId) {
    throw new Error('[IoT] Auth focus failed.');
  }

  // 2. Proveedor de credenciales
  const credentialsProvider = fromCognitoIdentityPool({
    identityPoolId: IDENTITY_POOL_ID,
    logins: { [cognitoLoginKey]: idToken },
    clientConfig: { region: REGION },
  });

  const credentials = await credentialsProvider();

  // 3. Vincular política de IoT (Requerido para WebSockets + SigV4)
  try {
    const iotClient = new IoTClient({
      region: REGION,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
        sessionToken: credentials.sessionToken || ""
      }
    });

    await iotClient.send(new AttachPolicyCommand({
      policyName: IOT_POLICY_NAME,
      target: identityId
    }));
  } catch (error: any) {
    if (error.name !== 'ResourceAlreadyExistsException') {
      // Solo reportar errores que no sean "ya existe"
      console.error('[IoT] Security Policy Error:', error.message);
    }
  }

  // 4. Construir la configuración de conexión WebSocket con SigV4
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

  // 5. Crear cliente y conectar
  const client = new mqtt.MqttClient();
  const connection = client.new_connection(config);

  connection.on('error', (error) => {
    console.error('[IoT] Connection Error:', error);
  });

  await Promise.race([
    connection.connect(),
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT_CONEXION_IOT_CORE')), 10000))
  ]);

  return connection;
}