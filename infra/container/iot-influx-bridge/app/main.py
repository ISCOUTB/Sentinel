"""
Puente IoT (AWS IoT Core MQTT -> InfluxDB v2 TSDB).

Suscribe al broker MQTT de AWS IoT Core para recibir datos de telemetría en tiempo real,
los analiza, los transforma en Line Protocol de InfluxDB y los escribe en la base de datos de
series temporales, creando dinámicamente los buckets necesarios si no existen.
"""

import base64
import json
import os
import signal
import sys
import time
from dataclasses import dataclass
from typing import Dict, Optional, Tuple

import paho.mqtt.client as mqtt
import urllib3

http = urllib3.PoolManager()
cached_cookie: Optional[str] = None
cached_org_id: Optional[str] = None
known_buckets = set()
running = True


@dataclass
class BridgeConfig:
    aws_iot_endpoint: str
    aws_iot_client_id: str
    aws_iot_cert_path: str
    aws_iot_key_path: str
    aws_iot_ca_path: str
    mqtt_port: int
    mqtt_keepalive: int
    mqtt_topic_filter: str
    influxdb_url: str
    influxdb_org: str
    influxdb_username: str
    influxdb_password: str
    default_bucket: str
    topic_bucket_map: Dict[str, str]


def env_required(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise ValueError(f"Missing required env var: {name}")
    return value


def parse_topic_bucket_map(raw: str) -> Dict[str, str]:
    raw = raw.strip()
    if not raw:
        return {}

    try:
        data = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError("TOPIC_BUCKET_MAP must be valid JSON") from exc

    if not isinstance(data, dict):
        raise ValueError("TOPIC_BUCKET_MAP must be a JSON object")

    result: Dict[str, str] = {}
    for topic, bucket in data.items():
        if not isinstance(topic, str) or not isinstance(bucket, str):
            raise ValueError("TOPIC_BUCKET_MAP keys and values must be strings")
        result[topic] = bucket
    return result


def load_config() -> BridgeConfig:
    return BridgeConfig(
        aws_iot_endpoint=env_required("AWS_IOT_ENDPOINT"),
        aws_iot_client_id=os.getenv("AWS_IOT_CLIENT_ID", "sentinel-influx-bridge"),
        aws_iot_cert_path=env_required("AWS_IOT_CERT_PATH"),
        aws_iot_key_path=env_required("AWS_IOT_PRIVATE_KEY_PATH"),
        aws_iot_ca_path=env_required("AWS_IOT_CA_PATH"),
        mqtt_port=int(os.getenv("AWS_IOT_PORT", "8883")),
        mqtt_keepalive=int(os.getenv("MQTT_KEEPALIVE", "30")),
        mqtt_topic_filter=os.getenv("MQTT_TOPIC_FILTER", "usv/+/data"),
        influxdb_url=env_required("INFLUXDB_URL"),
        influxdb_org=env_required("INFLUXDB_ORG"),
        influxdb_username=env_required("INFLUXDB_USERNAME"),
        influxdb_password=env_required("INFLUXDB_PASSWORD"),
        default_bucket=env_required("INFLUXDB_BUCKET"),
        topic_bucket_map=parse_topic_bucket_map(os.getenv("TOPIC_BUCKET_MAP", "")),
    )


def get_influx_cookie(url: str, username: str, password: str) -> Optional[str]:
    """
    Autentica contra InfluxDB v2 mediante Basic Auth y obtiene una cookie de sesión activa.
    
    Args:
        url (str): URL base de InfluxDB.
        username (str): Nombre del administrador local de InfluxDB.
        password (str): Contraseña.
        
    Returns:
        Optional[str]: La cookie de sesión (Set-Cookie) obtenida, o None.
    """
    if url.endswith("/"):
        url = url[:-1]

    signin_url = f"{url}/api/v2/signin"
    credentials = f"{username}:{password}".encode("utf-8")
    b64_credentials = base64.b64encode(credentials).decode("utf-8")

    headers = {"Authorization": f"Basic {b64_credentials}"}
    response = http.request("POST", signin_url, headers=headers)

    if response.status not in (200, 204):
        body = response.data.decode("utf-8", errors="replace")
        raise RuntimeError(f"InfluxDB signin failed ({response.status}): {body}")

    cookie = response.headers.get("set-cookie")
    if not cookie:
        print("[WARN] Signin succeeded but no Set-Cookie was returned")
    return cookie


def write_to_influxdb(
    url: str,
    org: str,
    bucket: str,
    username: str,
    password: str,
    point_line: str,
) -> None:
    """
    Escribe una lectura formateada en Line Protocol en InfluxDB v2 usando cookies de sesión.
    
    Args:
        url (str): URL base de InfluxDB.
        org (str): Organización de InfluxDB.
        bucket (str): Nombre del bucket de destino.
        username (str): Usuario.
        password (str): Contraseña.
        point_line (str): Lectura formateada en Influx Line Protocol.
    """
    global cached_cookie

    if not cached_cookie:
        cached_cookie = get_influx_cookie(url, username, password)

    if url.endswith("/"):
        url = url[:-1]

    write_endpoint = f"{url}/api/v2/write"
    params = f"org={org}&bucket={bucket}&precision=ns"
    full_url = f"{write_endpoint}?{params}"

    headers = {
        "Content-Type": "text/plain; charset=utf-8",
        "Accept": "application/json",
    }
    if cached_cookie:
        headers["Cookie"] = cached_cookie

    response = http.request(
        "POST",
        full_url,
        body=point_line.encode("utf-8"),
        headers=headers,
    )

    if response.status == 401:
        print("[WARN] Influx cookie expired, refreshing...")
        cached_cookie = get_influx_cookie(url, username, password)
        if cached_cookie:
            headers["Cookie"] = cached_cookie
        response = http.request(
            "POST",
            full_url,
            body=point_line.encode("utf-8"),
            headers=headers,
        )

    if response.status >= 300:
        body = response.data.decode("utf-8", errors="replace")
        raise RuntimeError(f"Influx write failed ({response.status}): {body}")


def get_org_id(url: str, username: str, password: str, org_name: str) -> str:
    global cached_cookie
    global cached_org_id

    if cached_org_id:
        return cached_org_id

    if not cached_cookie:
        cached_cookie = get_influx_cookie(url, username, password)

    orgs_url = f"{url.rstrip('/')}/api/v2/orgs"
    headers = {"Accept": "application/json"}
    if cached_cookie:
        headers["Cookie"] = cached_cookie

    response = http.request("GET", orgs_url, headers=headers)

    if response.status == 401:
        cached_cookie = get_influx_cookie(url, username, password)
        if cached_cookie:
            headers["Cookie"] = cached_cookie
        response = http.request("GET", orgs_url, headers=headers)

    if response.status >= 300:
        body = response.data.decode("utf-8", errors="replace")
        raise RuntimeError(f"Unable to list orgs ({response.status}): {body}")

    data = json.loads(response.data.decode("utf-8"))
    for org in data.get("orgs", []):
        if org.get("name") == org_name and org.get("id"):
            cached_org_id = str(org["id"])
            return cached_org_id

    raise RuntimeError(f"Org not found in InfluxDB: {org_name}")


def ensure_bucket_exists(url: str, org: str, bucket: str, username: str, password: str) -> None:
    """
    Verifica la existencia del bucket en InfluxDB v2.
    
    Si el bucket no existe en la organización, realiza una petición POST
    al API de InfluxDB para crearlo automáticamente sin intervención manual.
    """
    global cached_cookie

    if bucket in known_buckets:
        return

    if not cached_cookie:
        cached_cookie = get_influx_cookie(url, username, password)

    headers = {
        "Accept": "application/json",
        "Content-Type": "application/json",
    }
    if cached_cookie:
        headers["Cookie"] = cached_cookie

    bucket_url = f"{url.rstrip('/')}/api/v2/buckets?name={bucket}"
    response = http.request("GET", bucket_url, headers=headers)

    if response.status == 401:
        cached_cookie = get_influx_cookie(url, username, password)
        if cached_cookie:
            headers["Cookie"] = cached_cookie
        response = http.request("GET", bucket_url, headers=headers)

    if response.status >= 300:
        body = response.data.decode("utf-8", errors="replace")
        raise RuntimeError(f"Unable to query bucket {bucket} ({response.status}): {body}")

    data = json.loads(response.data.decode("utf-8"))
    if data.get("buckets"):
        known_buckets.add(bucket)
        return

    org_id = get_org_id(url, username, password, org)
    create_url = f"{url.rstrip('/')}/api/v2/buckets"
    payload = json.dumps({"name": bucket, "orgID": org_id, "retentionRules": []})
    create_response = http.request("POST", create_url, body=payload.encode("utf-8"), headers=headers)

    if create_response.status not in (200, 201):
        body = create_response.data.decode("utf-8", errors="replace")
        raise RuntimeError(f"Unable to create bucket {bucket} ({create_response.status}): {body}")

    print(f"[INFO] Created bucket: {bucket}")
    known_buckets.add(bucket)


def infer_bucket(topic: str, payload: Dict[str, object], config: BridgeConfig) -> str:
    if "influx_bucket" in payload and isinstance(payload["influx_bucket"], str):
        return payload["influx_bucket"]

    if topic in config.topic_bucket_map:
        return config.topic_bucket_map[topic]

    return config.default_bucket


def escape_tag_value(value: str) -> str:
    return value.replace("\\", "\\\\").replace(" ", "\\ ").replace(",", "\\,").replace("=", "\\=")


def collect_scalar_fields(prefix: str, value: object, fields: list[str]) -> None:
    if isinstance(value, bool):
        fields.append(f"{prefix}={'true' if value else 'false'}")
        return

    # Forzar todos los números a float para evitar conflictos de tipos en InfluxDB
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        fields.append(f"{prefix}={float(value)}")
        return

    if isinstance(value, str):
        sanitized = value.replace('"', '\\"')
        fields.append(f'{prefix}="{sanitized}"')
        return

    if isinstance(value, dict):
        for nested_key, nested_value in value.items():
            field_key = f"{prefix}_{nested_key}" if prefix else str(nested_key)
            collect_scalar_fields(field_key, nested_value, fields)
        return

    if isinstance(value, list):
        for idx, item in enumerate(value):
            field_key = f"{prefix}_{idx}" if prefix else str(idx)
            collect_scalar_fields(field_key, item, fields)
        return


def build_line_protocol(payload: Dict[str, object]) -> Optional[str]:
    """
    Transforma un payload JSON plano o anidado del USV en una línea compatible con InfluxDB Line Protocol.
    
    Establece la medición como 'usv_telemetry', añade 'device_id' y opcionalmente
    'mission_id' como etiquetas indexadas (tags), e itera recursivamente las lecturas numéricas
    y strings para mapearlas como campos (fields).
    
    Returns:
        Optional[str]: La línea de protocolo construida, o None si no hay campos legibles.
    """
    measurement = "usv_telemetry"
    device_id = str(
        payload.get("device_id")
        or payload.get("usv_id")
        or payload.get("clientId")
        or payload.get("thingname")
        or "unknown_device"
    )

    tags = [f"device_id={escape_tag_value(device_id)}"]
    
    # Si viene mission_id, lo ponemos como tag para búsquedas rápidas
    mission_id = payload.get("mission_id")
    if mission_id:
        tags.append(f"mission_id={escape_tag_value(str(mission_id))}")

    tags_str = ",".join(tags)

    fields = []
    for key, value in payload.items():
        if key in {"device_id", "clientId", "thingname", "timestamp", "influx_bucket", "mission_id"}:
            continue

        collect_scalar_fields(key, value, fields)

    if not fields:
        return None

    fields_str = ",".join(fields)
    return f"{measurement},{tags_str} {fields_str}"


def try_parse_payload(raw_payload: bytes) -> Tuple[Optional[Dict[str, object]], Optional[str]]:
    try:
        decoded = raw_payload.decode("utf-8")
    except UnicodeDecodeError:
        return None, "Payload is not valid UTF-8"

    try:
        data = json.loads(decoded)
    except json.JSONDecodeError:
        return None, "Payload is not valid JSON"

    if not isinstance(data, dict):
        return None, "Payload JSON must be an object"

    return data, None


def on_connect(client: mqtt.Client, _userdata, _flags, rc: int) -> None:
    if rc != 0:
        print(f"[ERROR] MQTT connect failed with code {rc}")
        return

    cfg: BridgeConfig = client._bridge_config  # type: ignore[attr-defined]
    print(f"[MQTT] Connected to AWS IoT Core. Subscribing to: {cfg.mqtt_topic_filter}")
    client.subscribe(cfg.mqtt_topic_filter, qos=1)


def on_message(client: mqtt.Client, _userdata, msg: mqtt.MQTTMessage) -> None:
    cfg: BridgeConfig = client._bridge_config  # type: ignore[attr-defined]

    payload, error = try_parse_payload(msg.payload)
    if error:
        print(f"[WARN] Ignoring message from {msg.topic}: {error}")
        return

    bucket = infer_bucket(msg.topic, payload, cfg)
    line_protocol = build_line_protocol(payload)
    if not line_protocol:
        print(f"[WARN] No writable fields in message from {msg.topic}. Keys: {list(payload.keys())}")
        return

    try:
        write_to_influxdb(
            cfg.influxdb_url,
            cfg.influxdb_org,
            bucket,
            cfg.influxdb_username,
            cfg.influxdb_password,
            line_protocol,
        )
        print(f"[DEBUG] Writing to Influx: {line_protocol}")
        print(f"[OK] {msg.topic} -> bucket={bucket}")
    except Exception as exc:
        print(f"[ERROR] Failed to write message from {msg.topic}: {exc}")


def on_disconnect(_client: mqtt.Client, _userdata, rc: int) -> None:
    if rc != 0:
        print(f"[WARN] Unexpected MQTT disconnect (rc={rc}). Auto-reconnect enabled.")


def handle_shutdown(signum, _frame) -> None:
    global running
    print(f"[INFO] Received signal {signum}. Shutting down...")
    running = False


def main() -> int:
    try:
        config = load_config()
    except Exception as exc:
        print(f"[FATAL] Invalid configuration: {exc}")
        return 1

    print("[INFO] Starting MQTT -> Influx bridge")
    print(f"[INFO] MQTT endpoint: {config.aws_iot_endpoint}:{config.mqtt_port}")
    print(f"[INFO] Influx URL: {config.influxdb_url}")

    configured_buckets = set(config.topic_bucket_map.values())
    configured_buckets.add(config.default_bucket)
    for bucket in configured_buckets:
        try:
            ensure_bucket_exists(
                config.influxdb_url,
                config.influxdb_org,
                bucket,
                config.influxdb_username,
                config.influxdb_password,
            )
        except Exception as exc:
            print(f"[FATAL] Bucket setup failed for {bucket}: {exc}")
            return 1

    client = mqtt.Client(client_id=config.aws_iot_client_id, clean_session=True)
    client._bridge_config = config  # type: ignore[attr-defined]

    client.tls_set(
        ca_certs=config.aws_iot_ca_path,
        certfile=config.aws_iot_cert_path,
        keyfile=config.aws_iot_key_path,
    )

    client.on_connect = on_connect
    client.on_message = on_message
    client.on_disconnect = on_disconnect

    client.reconnect_delay_set(min_delay=1, max_delay=30)

    signal.signal(signal.SIGINT, handle_shutdown)
    signal.signal(signal.SIGTERM, handle_shutdown)

    try:
        client.connect(config.aws_iot_endpoint, port=config.mqtt_port, keepalive=config.mqtt_keepalive)
    except Exception as exc:
        print(f"[FATAL] Could not connect to AWS IoT Core: {exc}")
        return 1

    client.loop_start()
    try:
        while running:
            time.sleep(1)
    finally:
        client.loop_stop()
        client.disconnect()
        print("[INFO] Bridge stopped")

    return 0


if __name__ == "__main__":
    sys.exit(main())
