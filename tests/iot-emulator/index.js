require('dotenv').config();
const awsIot = require('aws-iot-device-sdk');
const fs = require('fs');
const path = require('path');
const toml = require('@iarna/toml');

console.log('<==== Emulador USV iniciado ====>');

// ===== Cargar TOML =====
const tomlPath = path.join(__dirname, 'usv_simulation.toml');
const tomlData = toml.parse(fs.readFileSync(tomlPath, 'utf8'));
const combinationCode = tomlData.simulation.active_combination_code;

// ===== AWS IoT =====
const device = awsIot.device({
  keyPath: path.join(__dirname, process.env.AWS_IOT_PRIVATE_KEY_PATH || 'certs/private.pem.key'),
  certPath: path.join(__dirname, process.env.AWS_IOT_CERT_PATH || 'certs/device.pem.crt'),
  caPath: path.join(__dirname, process.env.AWS_IOT_CA_PATH || 'certs/AmazonRootCA1.pem'),
  clientId: process.env.AWS_IOT_CLIENT_ID || 'usv-barquito-emulator',
  host: process.env.AWS_IOT_ENDPOINT,
  keepalive: 30,
  protocol: 'mqtts'
});

device.on("connect", () => {
  console.log("[CONNECT]: Conectado a AWS IoT Core <====");

  setInterval(() => {
    const timestamp = new Date().toISOString();

    if ([1, 3, 5, 7].includes(combinationCode)) {
      device.publish(
        'usv/status/data',
        JSON.stringify({ ...tomlData.general_usv_status, timestamp })
      );
      console.log('[SEND]: general_usv_status enviado <====');
    }

    if ([2, 3, 6, 7].includes(combinationCode)) {
      device.publish(
        'usv/mission/data',
        JSON.stringify({ ...tomlData.mision, timestamp })
      );
      console.log('[SEND]: mission enviado <====');
    }

    if ([4, 5, 6, 7].includes(combinationCode)) {
      device.publish(
        'usv/logs/data',
        JSON.stringify({ ...tomlData.logs, timestamp })
      );
      console.log('[SEND]: logs enviado <====');
    }
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