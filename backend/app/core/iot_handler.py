import json
import logging
from typing import Dict, Any
import boto3
from influxdb_client import InfluxDBClient, Point
from influxdb_client.client.write_api import SYNCHRONOUS
from app.config import settings

logger = logging.getLogger(__name__)

class IoTHandler:
    def __init__(self):
        self.iot_client = boto3.client('iot-data', region_name=settings.AWS_REGION, endpoint_url=f"https://{settings.AWS_IOT_ENDPOINT}" if settings.AWS_IOT_ENDPOINT else None)
        
        # Initialize InfluxDB Client
        try:
            self.influx_client = InfluxDBClient(
                url=settings.INFLUXDB_URL,
                token=settings.INFLUXDB_TOKEN,
                org=settings.INFLUXDB_ORG
            )
            self.write_api = self.influx_client.write_api(write_options=SYNCHRONOUS)
            logger.info("Successfully connected to InfluxDB")
        except Exception as e:
            logger.error(f"Failed to connect to InfluxDB: {e}")
            self.write_api = None


    def publish_message(self, topic: str, payload: Dict[str, Any]):
        """Publish a message to an AWS IoT Core topic."""
        if not settings.AWS_IOT_ENDPOINT:
            logger.warning(f"AWS_IOT_ENDPOINT not set, skipping publish to {topic}")
            return False

        try:
            response = self.iot_client.publish(
                topic=topic,
                qos=1,
                payload=json.dumps(payload)
            )
            logger.info(f"Published to {topic}: {response}")
            return True
        except Exception as e:
            logger.error(f"Failed to publish to {topic}: {e}")
            return False

    def save_telemetry(self, usv_id: int, data: Dict[str, Any]):
        """
        Save high-frequency telemetry to InfluxDB.
        Expected data format: {'temperature': 25.5, 'humidity': 60, 'lat': 10.1, 'lng': -75.4, ...}
        """
        if not self.write_api:
            logger.warning(f"InfluxDB write_api not initialized, skipping telemetry for USV {usv_id}")
            return

        try:
            point = Point("telemetry").tag("usv_id", str(usv_id))
            
            # Add fields dynamically from data
            for key, value in data.items():
                if isinstance(value, (int, float, bool)):
                     point = point.field(key, value)
                elif isinstance(value, str):
                     point = point.field(key, value)
            
            self.write_api.write(bucket=settings.INFLUXDB_BUCKET, record=point)
            logger.debug(f"Saved telemetry for USV {usv_id} to InfluxDB")
            
        except Exception as e:
            logger.error(f"Error saving telemetry to InfluxDB: {e}")

    def get_latest_telemetry(self, usv_id: int) -> Dict[str, Any]:
        """Query latest telemetry from InfluxDB to validate Safe_Point, etc."""
        if not self.influx_client:
            return {}
        
        try:
            query_api = self.influx_client.query_api()
            query = f'from(bucket:"{settings.INFLUXDB_BUCKET}") |> range(start: -5m) |> filter(fn: (r) => r["_measurement"] == "telemetry") |> filter(fn: (r) => r["usv_id"] == "{usv_id}") |> last()'
            tables = query_api.query(query, org=settings.INFLUXDB_ORG)
            
            latest_data = {}
            for table in tables:
                for record in table.records:
                    latest_data[record.get_field()] = record.get_value()
            
            return latest_data
        except Exception as e:
            logger.error(f"Error querying InfluxDB: {e}")
            return {}

    def check_connection_loss(self, usv_id: int) -> bool:
        """
        Detección de pérdida de conexión (5s).
        Returns True if the USV has not sent telemetry in the last 5 seconds.
        """
        if not self.influx_client:
            return False
            
        try:
            query_api = self.influx_client.query_api()
            # Verify if any telemetry point exists in the last 5 seconds
            query = f'from(bucket:"{settings.INFLUXDB_BUCKET}") |> range(start: -5s) |> filter(fn: (r) => r["_measurement"] == "telemetry") |> filter(fn: (r) => r["usv_id"] == "{usv_id}") |> count()'
            tables = query_api.query(query, org=settings.INFLUXDB_ORG)
            
            # If tables is empty or count is 0, connection is lost
            if not tables:
                logger.warning(f"Connection lost detected for USV {usv_id} (No telemetry in last 5s)")
                return True
            
            # Additional logic can be added here if the count returns 0 records
            record_count = 0
            for table in tables:
                for record in table.records:
                    record_count += record.get_value()
            
            if record_count == 0:
                logger.warning(f"Connection lost detected for USV {usv_id} (Telemetry count 0 in last 5s)")
                return True
                
            return False
            
        except Exception as e:
            logger.error(f"Error checking connection loss in InfluxDB: {e}")
            return False

    def request_buffer_recovery(self, usv_id: int):
        """
        Subrutina de recuperación de buffer desde el firmware del USV.
        Sends an MQTT message commanding the USV to resend buffered telemetry.
        """
        topic = f"usv/{usv_id}/command"
        payload = {
            "type": "RECOVER_BUFFER",
            "timestamp": "now" # Replace with specific timestamp logic if needed
        }
        logger.info(f"Requesting buffer recovery for USV {usv_id}")
        self.publish_message(topic, payload)

iot_handler = IoTHandler()
