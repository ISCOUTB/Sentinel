import paho.mqtt.client as mqtt
import ssl
import logging

logging.basicConfig(level=logging.DEBUG)

client = mqtt.Client(client_id='test-debug', clean_session=True)

client.tls_set(
    ca_certs='/certs/AmazonRootCA1.pem',
    certfile='/certs/device.pem.crt',
    keyfile='/certs/private.pem.key',
    cert_reqs=ssl.CERT_REQUIRED,
    tls_version=ssl.PROTOCOL_TLSv1_2,
    ciphers=None
)

try:
    result = client.connect('a3399dxn78u8zv-ats.iot.us-east-1.amazonaws.com', 8883, keepalive=30)
    print(f'Connect result: {result}')
    client.loop_start()
    import time
    time.sleep(3)
    client.loop_stop()
except Exception as e:
    print(f'Error: {type(e).__name__}: {e}')
    import traceback
    traceback.print_exc()
