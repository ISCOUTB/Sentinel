import paho.mqtt.client as mqtt
import ssl
import logging

import os

logging.basicConfig(level=logging.DEBUG)

# Configuration from environment variables
AWS_IOT_ENDPOINT = os.getenv('AWS_IOT_ENDPOINT', 'your-endpoint-ats.iot.us-east-1.amazonaws.com')
AWS_IOT_CLIENT_ID = os.getenv('AWS_IOT_CLIENT_ID', 'test-debug')
AWS_IOT_PORT = int(os.getenv('AWS_IOT_PORT', 8883))
MQTT_KEEPALIVE = int(os.getenv('MQTT_KEEPALIVE', 30))
AWS_IOT_CA_PATH = os.getenv('AWS_IOT_CA_PATH', '/certs/AmazonRootCA1.pem')
AWS_IOT_CERT_PATH = os.getenv('AWS_IOT_CERT_PATH', '/certs/device.pem.crt')
AWS_IOT_PRIVATE_KEY_PATH = os.getenv('AWS_IOT_PRIVATE_KEY_PATH', '/certs/private.pem.key')

client = mqtt.Client(client_id=AWS_IOT_CLIENT_ID, clean_session=True)

client.tls_set(
    ca_certs=AWS_IOT_CA_PATH,
    certfile=AWS_IOT_CERT_PATH,
    keyfile=AWS_IOT_PRIVATE_KEY_PATH,
    cert_reqs=ssl.CERT_REQUIRED,
    tls_version=ssl.PROTOCOL_TLSv1_2,
    ciphers=None
)

try:
    result = client.connect(AWS_IOT_ENDPOINT, AWS_IOT_PORT, keepalive=MQTT_KEEPALIVE)
    print(f'Connect result: {result}')
    client.loop_start()
    import time
    time.sleep(3)
    client.loop_stop()
except Exception as e:
    print(f'Error: {type(e).__name__}: {e}')
    import traceback
    traceback.print_exc()
