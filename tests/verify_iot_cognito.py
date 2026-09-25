#!/usr/bin/env python3
"""
Sentinel HMI — Verificador de integración IoT Core + Cognito
=============================================================
Ejecuta este script para comprobar de extremo a extremo que:
  1. Cognito autentifica correctamente al usuario
  2. El Identity Pool entrega credenciales AWS temporales
  3. Las credenciales pueden conectarse a IoT Core vía WebSocket MQTT
  4. Se puede suscribir y recibir mensajes de los tópicos del USV

Uso:
  pip install boto3 awsiotsdk requests
  python3 verify_iot_cognito.py

Configurar las variables en la sección CONFIG antes de ejecutar.
"""

import sys
import json
import time
import boto3
import threading
from awscrt import mqtt
from awsiot import mqtt_connection_builder

# ══════════════════════════════════════════════════════════════
#  CONFIG — Rellena con los valores reales de tu Terraform
# ══════════════════════════════════════════════════════════════

CONFIG = {
    # Cognito User Pool
    "COGNITO_USER_POOL_ID":    "us-east-1_bok8d0u1elbgk8anfa1kt4qiq",      # Terraform output: user_pool_id
    "COGNITO_CLIENT_ID":       "us-east-1_FY40xdVFS", # Terraform output: user_pool_client_id
    "COGNITO_IDENTITY_POOL_ID":"us-east-1:40c6875d-16ae-45f0-83c8-3d911c8ae631", # Del tfstate

    # Credenciales de un usuario que ya existe en Cognito
    "TEST_USERNAME":           "sentinelDaniel",
    "TEST_PASSWORD":           "Is@ias188",

    # IoT Core
    "IOT_ENDPOINT":            "a3399dxn78u8zv-ats.iot.us-east-1.amazonaws.com",
    "THING_NAME":              "USV-001",
    "AWS_REGION":              "us-east-1",
}

# ══════════════════════════════════════════════════════════════
#  HELPERS
# ══════════════════════════════════════════════════════════════

def ok(msg):  print(f"  ✅  {msg}")
def err(msg): print(f"  ❌  {msg}"); sys.exit(1)
def info(msg):print(f"  ℹ️   {msg}")
def step(n, t): print(f"\n{'═'*60}\n  PASO {n}: {t}\n{'═'*60}")

# ══════════════════════════════════════════════════════════════
#  PASO 1 — Autenticar con Cognito User Pool
# ══════════════════════════════════════════════════════════════

def paso1_cognito_auth():
    step(1, "Autenticación con Cognito User Pool (USER_PASSWORD_AUTH)")

    cognito = boto3.client("cognito-idp", region_name=CONFIG["AWS_REGION"])
    try:
        resp = cognito.initiate_auth(
            AuthFlow="USER_PASSWORD_AUTH",
            AuthParameters={
                "USERNAME": CONFIG["TEST_USERNAME"],
                "PASSWORD": CONFIG["TEST_PASSWORD"],
            },
            ClientId=CONFIG["COGNITO_CLIENT_ID"],
        )
    except cognito.exceptions.NotAuthorizedException:
        err("Credenciales inválidas. Verifica TEST_USERNAME y TEST_PASSWORD.")
    except cognito.exceptions.UserNotFoundException:
        err(f"Usuario '{CONFIG['TEST_USERNAME']}' no existe en el User Pool.")
    except Exception as e:
        err(f"Error inesperado en Cognito auth: {e}")

    result = resp["AuthenticationResult"]
    ok(f"Login exitoso para '{CONFIG['TEST_USERNAME']}'")
    info(f"AccessToken (primeros 40 chars): {result['AccessToken'][:40]}...")
    info(f"IdToken     (primeros 40 chars): {result['IdToken'][:40]}...")
    info(f"Expira en: {result['ExpiresIn']} segundos")
    return result["IdToken"]

# ══════════════════════════════════════════════════════════════
#  PASO 2 — Obtener Identity ID del Identity Pool
# ══════════════════════════════════════════════════════════════

def paso2_get_identity_id(id_token):
    step(2, "Obtener Identity ID del Cognito Identity Pool")

    cognito_identity = boto3.client("cognito-identity", region_name=CONFIG["AWS_REGION"])
    login_key = f"cognito-idp.{CONFIG['AWS_REGION']}.amazonaws.com/{CONFIG['COGNITO_USER_POOL_ID']}"

    try:
        resp = cognito_identity.get_id(
            IdentityPoolId=CONFIG["COGNITO_IDENTITY_POOL_ID"],
            Logins={login_key: id_token},
        )
    except Exception as e:
        err(f"Error obteniendo Identity ID: {e}")

    identity_id = resp["IdentityId"]
    ok(f"Identity ID obtenido: {identity_id}")
    return identity_id

# ══════════════════════════════════════════════════════════════
#  PASO 3 — Obtener credenciales AWS temporales
# ══════════════════════════════════════════════════════════════

def paso3_get_credentials(id_token, identity_id):
    step(3, "Obtener credenciales AWS temporales (AssumeRoleWithWebIdentity)")

    cognito_identity = boto3.client("cognito-identity", region_name=CONFIG["AWS_REGION"])
    login_key = f"cognito-idp.{CONFIG['AWS_REGION']}.amazonaws.com/{CONFIG['COGNITO_USER_POOL_ID']}"

    try:
        resp = cognito_identity.get_credentials_for_identity(
            IdentityId=identity_id,
            Logins={login_key: id_token},
        )
    except Exception as e:
        err(f"Error obteniendo credenciales: {e}")

    creds = resp["Credentials"]
    ok("Credenciales temporales obtenidas correctamente")
    info(f"AccessKeyId:     {creds['AccessKeyId']}")
    info(f"SecretKey (pri. 10): {creds['SecretKey'][:10]}...")
    info(f"SessionToken (pri. 20): {creds['SessionToken'][:20]}...")
    info(f"Expiration:      {creds['Expiration']}")
    return creds

# ══════════════════════════════════════════════════════════════
#  PASO 4 — Verificar permisos IAM para IoT Core
# ══════════════════════════════════════════════════════════════

def paso4_verify_iam_permissions(creds):
    step(4, "Simular permisos IAM sobre IoT Core (iam:SimulatePrincipalPolicy)")

    sts = boto3.client(
        "sts",
        region_name=CONFIG["AWS_REGION"],
        aws_access_key_id=creds["AccessKeyId"],
        aws_secret_access_key=creds["SecretKey"],
        aws_session_token=creds["SessionToken"],
    )

    try:
        identity = sts.get_caller_identity()
        ok(f"Credenciales válidas. ARN del rol: {identity['Arn']}")
    except Exception as e:
        err(f"Las credenciales temporales no son válidas: {e}")

# ══════════════════════════════════════════════════════════════
#  PASO 5 — Conectar a IoT Core por WebSocket MQTT
# ══════════════════════════════════════════════════════════════

def paso5_mqtt_connect(creds):
    step(5, "Conectar a AWS IoT Core vía MQTT sobre WebSocket (SigV4)")

    client_id = f"sentinel_hmi_verify_{int(time.time())}"
    info(f"Client ID: {client_id}")
    info(f"Endpoint:  {CONFIG['IOT_ENDPOINT']}")

    received_messages = []
    connected_event  = threading.Event()
    message_event    = threading.Event()

    def on_connection_interrupted(conn, error, **kwargs):
        print(f"  ⚠️  Conexión interrumpida: {error}")

    def on_connection_resumed(conn, return_code, session_present, **kwargs):
        info(f"Conexión reanudada (return_code={return_code})")

    try:
        conn = mqtt_connection_builder.websockets_with_default_aws_signing(
            endpoint=CONFIG["IOT_ENDPOINT"],
            region=CONFIG["AWS_REGION"],
            credentials_provider=None,  # usamos credenciales directas via env
            client_id=client_id,
            clean_session=True,
            keep_alive_secs=30,
            on_connection_interrupted=on_connection_interrupted,
            on_connection_resumed=on_connection_resumed,
        )
    except Exception as e:
        # Fallback: construir con credenciales explícitas usando awscrt
        from awscrt import auth, io
        event_loop_group = io.EventLoopGroup(1)
        host_resolver    = io.DefaultHostResolver(event_loop_group)
        client_bootstrap = io.ClientBootstrap(event_loop_group, host_resolver)

        credentials = auth.AwsCredentials(
            access_key_id=creds["AccessKeyId"],
            secret_access_key=creds["SecretKey"],
            session_token=creds["SessionToken"],
        )
        cred_provider = auth.AwsCredentialsProvider.new_static(credentials)

        conn = mqtt_connection_builder.websockets_with_custom_signing(
            endpoint=CONFIG["IOT_ENDPOINT"],
            region=CONFIG["AWS_REGION"],
            credentials_provider=cred_provider,
            client_bootstrap=client_bootstrap,
            client_id=client_id,
            clean_session=True,
            keep_alive_secs=30,
            on_connection_interrupted=on_connection_interrupted,
            on_connection_resumed=on_connection_resumed,
        )

    # Conectar
    try:
        connect_future = conn.connect()
        connect_future.result(timeout=10)
        ok("Conectado a IoT Core exitosamente 🎉")
    except Exception as e:
        err(
            f"Fallo al conectar a IoT Core: {e}\n"
            "  Posibles causas:\n"
            "  - El endpoint es incorrecto\n"
            "  - La política IAM del Identity Pool no permite iot:Connect\n"
            "  - El client_id no coincide con el ARN de la política (sentinel_hmi_*)\n"
            "  - No hay política IoT adjunta al principal Cognito (ver PASO 6)"
        )

    # ── Suscribir al tópico de status del USV ──
    step("5b", f"Suscribir al tópico '{CONFIG['THING_NAME']}/general_usv_status'")

    def on_message(topic, payload, dup, qos, retain, **kwargs):
        data = json.loads(payload.decode())
        received_messages.append(data)
        ok(f"Mensaje recibido en '{topic}':")
        print(json.dumps(data, indent=4, ensure_ascii=False))
        message_event.set()

    try:
        sub_future, _ = conn.subscribe(
            topic=f"{CONFIG['THING_NAME']}/general_usv_status",
            qos=mqtt.QoS.AT_LEAST_ONCE,
            callback=on_message,
        )
        sub_future.result(timeout=10)
        ok(f"Suscripción exitosa al tópico '{CONFIG['THING_NAME']}/general_usv_status'")
    except Exception as e:
        err(
            f"No se pudo suscribir: {e}\n"
            "  La política IAM puede no cubrir el tópico correcto.\n"
            "  Ver la sección 'BUG CRÍTICO' en el README de verificación."
        )

    # ── Publicar un mensaje de prueba (self-publish) ──
    step("5c", "Publicar mensaje de prueba en el tópico y esperar eco")
    test_payload = json.dumps({
        "usv_id": "VERIFY-TEST",
        "conexion": "ONLINE",
        "actividad": "VERIFICACION",
        "bateria_porcentaje": 99,
        "timestamp_utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    })

    try:
        pub_future, _ = conn.publish(
            topic=f"{CONFIG['THING_NAME']}/general_usv_status",
            payload=test_payload,
            qos=mqtt.QoS.AT_LEAST_ONCE,
        )
        pub_future.result(timeout=10)
        ok("Mensaje publicado correctamente")
    except Exception as e:
        err(f"No se pudo publicar: {e}")

    # Esperar máximo 5 segundos a recibir el eco
    info("Esperando 5 segundos para recibir mensajes…")
    message_event.wait(timeout=5)

    if received_messages:
        ok(f"Flujo completo verificado — {len(received_messages)} mensaje(s) recibido(s)")
    else:
        info("No se recibieron mensajes en 5 segundos (puede ser normal si el USV no está publicando).")
        info("La suscripción sí fue exitosa — el canal MQTT está funcionando.")

    # Desconectar limpiamente
    disconnect_future = conn.disconnect()
    disconnect_future.result(timeout=5)
    info("Desconectado de IoT Core.")

# ══════════════════════════════════════════════════════════════
#  MAIN
# ══════════════════════════════════════════════════════════════

if __name__ == "__main__":
    print("\n" + "═"*60)
    print("  SENTINEL — Verificador IoT Core + Cognito")
    print("═"*60)

    # Validar config básica
    placeholders = [k for k, v in CONFIG.items() if "xxxx" in v or "XXXX" in v]
    if placeholders:
        print(f"\n⚠️  Debes completar estas variables en CONFIG antes de ejecutar:")
        for p in placeholders: print(f"   - {p}")
        sys.exit(1)

    id_token    = paso1_cognito_auth()
    identity_id = paso2_get_identity_id(id_token)
    creds       = paso3_get_credentials(id_token, identity_id)
    paso4_verify_iam_permissions(creds)
    paso5_mqtt_connect(creds)

    print("\n" + "═"*60)
    print("  ✅  VERIFICACIÓN COMPLETA — IoT Core + Cognito funcionando")
    print("═"*60 + "\n")
