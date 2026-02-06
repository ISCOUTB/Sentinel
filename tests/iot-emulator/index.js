const awsIot = require('aws-iot-device-sdk');
const fs = require('fs');
const path = require('path');
const toml = require('@iarna/toml');

console.log('🚀 Emulador USV iniciado');

// ===== Cargar TOML =====
const tomlPath = path.join(__dirname, 'usv_simulation.toml');
const tomlData = toml.parse(fs.readFileSync(tomlPath, 'utf8'));
const combinationCode = tomlData.active_combination_code;

// ===== AWS IoT =====
const device = awsIot.device({
  keyPath: path.join(__dirname, 'certs/private.pem.key'),
  certPath: path.join(__dirname, 'certs/device.pem.crt'),
  caPath: path.join(__dirname, 'certs/AmazonRootCA1.pem'),
  clientId: 'usv-barquito-emulator',
  host: 'a3399dxn78u8zv-ats.iot.us-east-1.amazonaws.com',
  keepalive: 30,
  protocol: 'mqtts'
});

device.on("connect", () => {
  console.log("✅ Conectado a AWS IoT Core");

  setInterval(() => {
    const timestamp = new Date().toISOString();

    if ([1, 3, 5, 7].includes(combinationCode)) {
      device.publish(
        'general_usv_status',
        JSON.stringify({ ...tomlData.general_usv_status, timestamp })
      );
      console.log('📤 general_usv_status enviado');
    }

    if ([2, 3, 6, 7].includes(combinationCode)) {
      device.publish(
        'mission',
        JSON.stringify({ ...tomlData.mision, timestamp })
      );
      console.log('📤 mission enviado');
    }

    if ([4, 5, 6, 7].includes(combinationCode)) {
      device.publish(
        'logs',
        JSON.stringify({ ...tomlData.logs, timestamp })
      );
      console.log('📤 logs enviado');
    }
  }, 5000);
});

device.on("close", () => {
  console.log("⚠️ CONEXIÓN CERRADA");
});

device.on("reconnect", () => {
  console.log("🔄 Reintentando conexión...");
});

device.on("error", (err) => {
  console.error("❌ ERROR:", err);
});