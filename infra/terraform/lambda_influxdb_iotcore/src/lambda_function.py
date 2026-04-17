import json
import os
import boto3
import base64
import urllib3
from urllib.parse import urlparse

# Initialize clients outside handler for reuse
secrets_client = boto3.client('secretsmanager')
http = urllib3.PoolManager()

# Global variable to cache cookie across warm starts (optional optimization)
cached_cookie = None

def get_secret(secret_arn):
    """Retrieve secret value from AWS Secrets Manager"""
    try:
        response = secrets_client.get_secret_value(SecretId=secret_arn)
        if 'SecretString' in response:
            return response['SecretString']
    except Exception as e:
        print(f"Error retrieving secret: {e}")
        return None

def get_influx_cookie(url, username, password):
    """authenticate via /api/v2/signin and return session cookie"""
    if url.endswith('/'):
        url = url[:-1]
    
    signin_url = f"{url}/api/v2/signin"
    
    # Basic Auth just for Signin
    credentials = f"{username}:{password}".encode("utf-8")
    b64_credentials = base64.b64encode(credentials).decode("utf-8")
    
    headers = {
        'Authorization': f"Basic {b64_credentials}"
    }
    
    try:
        response = http.request('POST', signin_url, headers=headers)
        
        if response.status not in [200, 204]:
             print(f"Signin Failed: {response.status} {response.data}")
             raise Exception(f"InfluxDB Signin Failed: {response.status}")
        
        # Extract Cookie
        cookie = response.headers.get('set-cookie')
        if not cookie:
            # Fallback: maybe it's Set-Cookie or similar (urllib3 headers are usually case-insensitive)
            # If no cookie returned, maybe auth failed silently or instance behaves differently
            print("Warning: No Set-Cookie header in signin response")
            
        print("Successfully authenticated via /signin")
        return cookie

    except Exception as e:
        print(f"Signin Request Error: {e}")
        raise e

def write_to_influxdb(url, org, bucket, username, password, point_line):
    """
    Authenticate via /api/v2/signin using username/password
    then write using returned session cookie
    """

    if url.endswith('/'):
        url = url[:-1]

    signin_url = f"{url}/api/v2/signin"
    write_url = f"{url}/api/v2/write?org={org}&bucket={bucket}&precision=ns"

    # Basic Auth header
    credentials = f"{username}:{password}".encode("utf-8")
    b64_credentials = base64.b64encode(credentials).decode("utf-8")

    signin_headers = {
        "Authorization": f"Basic {b64_credentials}"
    }

    try:
        # Step 1: Sign in
        signin_response = http.request(
            "POST",
            signin_url,
            headers=signin_headers
        )

        if signin_response.status not in [200, 204]:
            print(f"Signin failed: {signin_response.status} {signin_response.data}")
            raise Exception("InfluxDB Signin Failed")

        cookie = signin_response.headers.get("set-cookie")

        if not cookie:
            raise Exception("No session cookie returned from InfluxDB")

        print("Authenticated successfully")

        # Step 2: Write data
        write_headers = {
            "Content-Type": "text/plain; charset=utf-8",
            "Cookie": cookie
        }

        write_response = http.request(
            "POST",
            write_url,
            body=point_line.encode("utf-8"),
            headers=write_headers
        )

        if write_response.status >= 300:
            print(f"Write failed: {write_response.status} {write_response.data}")
            raise Exception("InfluxDB Write Failed")

        print(f"Write successful. Status: {write_response.status}")
        return True

    except Exception as e:
        print(f"Error writing to InfluxDB: {str(e)}")
        raise e

def flatten_dict(d, parent_key='', sep='_'):
    """Recursively flatten nested dictionaries"""
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        elif isinstance(v, list):
            # Skip lists for now (will handle separately if needed)
            continue
        else:
            items.append((new_key, v))
    return dict(items)

def parse_timestamp(timestamp_str):
    """Convert ISO 8601 timestamp to nanoseconds since epoch"""
    from datetime import datetime, timezone

    if not timestamp_str:
        # Si no viene timestamp, usar tiempo actual
        return int(datetime.now(timezone.utc).timestamp() * 1_000_000_000)

    try:
        if timestamp_str.endswith('Z'):
            dt = datetime.fromisoformat(timestamp_str.replace('Z', '+00:00'))
        else:
            dt = datetime.fromisoformat(timestamp_str)
        return int(dt.timestamp() * 1_000_000_000)
    except Exception as e:
        print(f"Failed to parse timestamp '{timestamp_str}': {e}")
        return int(datetime.now(timezone.utc).timestamp() * 1_000_000_000)

def build_line_protocol(measurement, tags, fields, timestamp=None):
    """Build InfluxDB Line Protocol string"""
    if not fields:
        return None
    
    tags_str = ",".join([f"{k}={v}" for k, v in tags.items()])
    fields_list = []
    
    for k, v in fields.items():
        if isinstance(v, (int, float)):
            fields_list.append(f"{k}={v}")
        elif isinstance(v, bool):
            fields_list.append(f"{k}={str(v).lower()}")
        elif isinstance(v, str):
            # Escape quotes in string values
            escaped = v.replace('"', '\\"')
            fields_list.append(f'{k}="{escaped}"')
    
    fields_str = ",".join(fields_list)
    
    if timestamp:
        return f"{measurement},{tags_str} {fields_str} {timestamp}"
    else:
        return f"{measurement},{tags_str} {fields_str}"

def lambda_handler(event, context):
    
    influx_url = os.environ.get('INFLUXDB_URL')
    influx_org = os.environ.get('INFLUXDB_ORG')
    username   = os.environ.get('INFLUXDB_USERNAME')
    password   = os.environ.get('INFLUXDB_PASSWORD')
    
    if not all([influx_url, influx_org, username, password]):
        return {
            "status": "error",
            "reason": "missing_influx_config"
        }

    bucket = event.get("influx_bucket")
    
    
    if not bucket:
        return {"status": "error", "reason": "missing_bucket"}

    timestamp = parse_timestamp(event.get("timestamp_utc"))

    if bucket == "general_status":

        tags = {
            "usv_id": event.get("usv_id"),
            "conexion": event.get("conexion"),
            "actividad": event.get("actividad")
        }

        fields = {
            k: v for k, v in event.items()
            if k not in ["usv_id", "conexion", "actividad", "timestamp_utc", "influx_bucket"]
            and isinstance(v, (int, float))
        }

        measurement = "general_usv_status"

    elif bucket == "mission":
        
        tags = {
            "mission_id": event.get("mission_id"),
            "usv_id": event.get("usv_id"),
            "tipo_mision": event.get("tipo_mision"),
            "estado_mision": event.get("estado_mision")
        }

        fields = {
            k: v for k, v in event.items()
            if k not in [
                "mission_id","usv_id","tipo_mision",
                "estado_mision","timestamp_utc","influx_bucket"
            ]
            and isinstance(v,(int,float))
        }

        measurement = "mission_data"

    elif bucket == "logs":
        
        tags = {
            "log_id": event.get("log_id"),
            "usv_id": event.get("usv_id"),
            "mission_id": event.get("mission_id")
        }

        fields = {
            "codigo": event.get("codigo", 0)
        }

        measurement = "logs"

    else:
        return {"status": "skipped", "reason": "unknown_bucket"}


    line = build_line_protocol(measurement, tags, fields, timestamp)

    if not line:
        return {"status": "skipped", "reason": "no_fields"}

    write_to_influxdb(
        influx_url,
        influx_org,
        bucket,
        username,
        password,
        line
    )  