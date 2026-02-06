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
    """Write data to InfluxDB using Cookie Authentication"""
    global cached_cookie
    
    # 1. Ensure we have a cookie
    if not cached_cookie:
        cached_cookie = get_influx_cookie(url, username, password)
    
    # 2. Prepare URL
    if url.endswith('/'):
        url = url[:-1]
    
    write_endpoint = f"{url}/api/v2/write"
    
    params = {
        'org': org,
        'bucket': bucket,
        'precision': 'ns'
    }
    
    # 3. Headers (Use Cookie)
    headers = {
        'Content-Type': 'text/plain; charset=utf-8',
        'Accept': 'application/json'
    }
    
    if cached_cookie:
        headers['Cookie'] = cached_cookie
    
    encoded_args = "&".join([f"{k}={v}" for k, v in params.items()])
    full_url = f"{write_endpoint}?{encoded_args}"
    
    try:
        # Attempt Write
        response = http.request(
            'POST',
            full_url,
            body=point_line.encode('utf-8'),
            headers=headers
        )
        
        # If 401, maybe cookie expired? Retry once.
        if response.status == 401:
            print("Write 401 Unauthorized. Retrying with fresh cookie...")
            cached_cookie = get_influx_cookie(url, username, password)
            if cached_cookie:
                headers['Cookie'] = cached_cookie
            
            response = http.request(
                'POST',
                full_url,
                body=point_line.encode('utf-8'),
                headers=headers
            )
        
        if response.status >= 300:
            print(f"FAILED to write. Status: {response.status}. Body: {response.data.decode('utf-8')}")
            raise Exception(f"InfluxDB Write Failed: {response.status} {response.data}")
            
        print(f"Successfully wrote to {bucket}. Status: {response.status}")
        return True
        
    except Exception as e:
        print(f"HTTP Request failed: {str(e)}")
        raise e

def lambda_handler(event, context):
    # Load Config
    influx_url = os.environ.get('INFLUXDB_URL')
    influx_org = os.environ.get('INFLUXDB_ORG')
    username = os.environ.get('INFLUXDB_USERNAME')
    password = os.environ.get('INFLUXDB_PASSWORD')
    
    # Determine bucket
    bucket = event.get('influx_bucket') or os.environ.get('INFLUXDB_BUCKET')
    
    if not all([influx_url, influx_org, username, password, bucket]):
        print("Missing config")
        return {"status": "error", "reason": "missing_config"}

    print(f"Processing event for bucket: {bucket}")

    try:
        # Convert JSON event to Line Protocol
        # Format: measurement,tag1=val1 field1=val1,field2=val2 timestamp
        
        measurement = "iot_telemetry"
        
        # Extract tags
        device_id = event.get('device_id') or event.get('clientId') or event.get('thingname') or 'unknown_device'
        tags_str = f"device_id={device_id}"
        
        # Extract fields
        fields = []
        for key, value in event.items():
            if key not in ['device_id', 'clientId', 'thingname', 'timestamp', 'influx_bucket']:
                if isinstance(value, (int, float)):
                    fields.append(f"{key}={value}")
                elif isinstance(value, str):
                    fields.append(f'{key}="{value}"')
                elif isinstance(value, bool):
                    fields.append(f"{key}={str(value)}")

        if not fields:
            print("No fields to write")
            return {"status": "skipped"}
            
        fields_str = ",".join(fields)
        
        # Line Protocol String
        # If timestamp is missing, InfluxDB adds it server-side.
        line_protocol = f"{measurement},{tags_str} {fields_str}"
        
        # Send
        write_to_influxdb(influx_url, influx_org, bucket, username, password, line_protocol)
        
        return {
            'statusCode': 200,
            'body': json.dumps('Data written to InfluxDB')
        }

    except Exception as e:
        print(f"Handler Error: {str(e)}")
        raise e
