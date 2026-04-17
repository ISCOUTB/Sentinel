require('dotenv').config();
const awsIot = require('aws-iot-device-sdk');
const fs = require('fs');
const path = require('path');

console.log('<==== Emulador USV iniciado ====>');

// ===== Cargar JSON =====
const jsonPath = path.join(__dirname, 'usv_simulation.json');
const jsonData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

// ===== AWS IoT =====
const keyPath = path.join(__dirname, process.env.AWS_IOT_PRIVATE_KEY_PATH || 'certs/private.pem.key');
const certPath = path.join(__dirname, process.env.AWS_IOT_CERT_PATH || 'certs/device.pem.crt');
const caPath = path.join(__dirname, process.env.AWS_IOT_CA_PATH || 'certs/AmazonRootCA1.pem');


const device = awsIot.device({
  keyPath,
  certPath,
  caPath,
  clientId: process.env.AWS_IOT_CLIENT_ID || 'usv-barquito-emulator',
  host: process.env.AWS_IOT_ENDPOINT,
  keepalive: 30,
  protocol: 'mqtts'
});

device.on("connect", () => {
  console.log("[CONNECT]: Conectado a AWS IoT Core <====");

  setInterval(() => {
    const timestamp_utc = new Date().toISOString();

    // Enviar USV Status
    device.publish(
      'usv/status/data',
      JSON.stringify({ 
        ...jsonData.general_usv_status, 
        timestamp_utc
      })
    );
    console.log('[SEND]: general_usv_status enviado a usv/status/data <====');

    // Enviar Mission Data
    device.publish(
      'usv/mission/data',
      JSON.stringify({
        ...jsonData.mision,
        timestamp_utc
      })
    );
    console.log('[SEND]: mission enviado a usv/mission/data <====');

    // Enviar Logs
    device.publish(
      'usv/logs/data',
      JSON.stringify({ 
        ...jsonData.logs, 
        timestamp_utc
      })
    );
    console.log('[SEND]: logs enviado a usv/logs/data <====');
  }, 5000);
});

device.on("close", () => {
  console.log("[CLOSE]: CONEXIÓN CERRADA <====");
});

device.on("reconnect", () => {
  console.log("[RECONNECT]: Reintentando conexión... <====");
});

device.on("error", (err) => {
  console.error("[ERROR]:", err);
});