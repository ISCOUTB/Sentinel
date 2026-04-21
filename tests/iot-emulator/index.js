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

// ===== Configuración de Tópicos =====
const THING_NAME = process.env.AWS_IOT_THING_NAME || 'USV-001';
const TOPICS = {
  STATUS: `${THING_NAME}/general_usv_status`,
  MISSION: `${THING_NAME}/mision`,
  LOGS: `${THING_NAME}/logs`,
};

// ===== Estado dinámico de simulación =====
const state = {
  tick: 0,
  latitud: jsonData.general_usv_status.latitud,
  longitud: jsonData.general_usv_status.longitud,
  bateria: jsonData.general_usv_status.bateria_porcentaje,
  corriente_motor_1: jsonData.general_usv_status.corriente_motor_1_a,
  corriente_motor_2: jsonData.general_usv_status.corriente_motor_2_a,
  voltaje_celda_1: jsonData.general_usv_status.voltaje_celda_1_v,
  voltaje_celda_2: jsonData.general_usv_status.voltaje_celda_2_v,
  voltaje_celda_3: jsonData.general_usv_status.voltaje_celda_3_v,
  roll: jsonData.general_usv_status.roll_grados,
  pitch: jsonData.general_usv_status.pitch_grados,
  yaw: jsonData.general_usv_status.yaw_grados,
  temperatura: jsonData.mision.temperatura_agua_c,
  ph: jsonData.mision.ph_agua,
  turbidez: jsonData.mision.turbidez_ntu,
  oxigeno: jsonData.mision.oxigeno_disuelto_ppm,
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function smoothStep(value, maxDelta, min, max) {
  const delta = (Math.random() * 2 - 1) * maxDelta;
  return clamp(value + delta, min, max);
}

function round(value, decimals) {
  return Number(value.toFixed(decimals));
}

function nextState() {
  state.tick += 1;

  // Ruta suave con deriva pequeña.
  state.latitud += 0.00005 + (Math.random() * 2 - 1) * 0.00002;
  state.longitud += 0.00003 + (Math.random() * 2 - 1) * 0.00002;

  // Descarga gradual de batería y ajuste coherente de voltajes/corriente.
  state.bateria = clamp(state.bateria - 0.02, 20, 100);
  const motorBase = state.bateria < 35 ? 13.6 : 15.0;
  state.corriente_motor_1 = clamp(smoothStep(motorBase + Math.sin(state.tick / 9), 0.25, 8.5, 18.0), 8.5, 18.0);
  state.corriente_motor_2 = clamp(smoothStep(motorBase + Math.cos(state.tick / 8), 0.25, 8.5, 18.0), 8.5, 18.0);

  const voltageTarget = 3.65 + (state.bateria / 100) * 0.45;
  state.voltaje_celda_1 = smoothStep(voltageTarget, 0.01, 3.6, 4.2);
  state.voltaje_celda_2 = smoothStep(voltageTarget + 0.005, 0.01, 3.6, 4.2);
  state.voltaje_celda_3 = smoothStep(voltageTarget - 0.005, 0.01, 3.6, 4.2);

  // Orientación con cambios pequeños y continuos.
  state.roll = smoothStep(state.roll, 0.18, -12, 12);
  state.pitch = smoothStep(state.pitch, 0.15, -8, 8);
  state.yaw = (state.yaw + 0.8 + (Math.random() * 2 - 1) * 0.2 + 360) % 360;

  // Sensores ambientales progresivos.
  state.temperatura = smoothStep(state.temperatura, 0.08, 23.0, 30.0);
  state.ph = smoothStep(state.ph, 0.015, 6.6, 8.2);
  state.turbidez = smoothStep(state.turbidez, 0.25, 5.0, 40.0);
  state.oxigeno = smoothStep(state.oxigeno, 0.05, 5.0, 11.0);
}

function createLog(status, mission, timestamp_utc) {
  let nivel = "INFO";
  let codigo = 100;
  let mensaje = `Lectura estable: Temp ${mission.temperatura_agua_c} C, pH ${mission.ph_agua}, Turbidez ${mission.turbidez_ntu} NTU, O2 ${mission.oxigeno_disuelto_ppm} ppm.`;

  if (status.bateria_porcentaje <= 25) {
    nivel = "ERROR";
    codigo = 301;
    mensaje = `Bateria critica ${status.bateria_porcentaje}%. Retorno inmediato recomendado.`;
  } else if (status.bateria_porcentaje <= 40) {
    nivel = "WARNING";
    codigo = 201;
    mensaje = `Bateria baja ${status.bateria_porcentaje}%. Continuar con precaucion.`;
  } else if (mission.oxigeno_disuelto_ppm < 6.0) {
    nivel = "WARNING";
    codigo = 203;
    mensaje = `Oxigeno disuelto bajo (${mission.oxigeno_disuelto_ppm} ppm) en punto de muestreo.`;
  } else if (mission.temperatura_agua_c > 28.0) {
    nivel = "WARNING";
    codigo = 202;
    mensaje = `Temperatura elevada (${mission.temperatura_agua_c} C) detectada en muestreo.`;
  } else if (state.tick % 20 === 0) {
    codigo = 102;
    mensaje = `Posicion actualizada: lat ${status.latitud}, lon ${status.longitud}.`;
  }

  return {
    log_id: `LOG-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${String(state.tick).padStart(4, '0')}`,
    usv_id: THING_NAME,
    mission_id: mission.mission_id,
    nivel,
    mensaje,
    codigo,
    timestamp_utc,
  };
}

device.on("connect", () => {
  console.log("[CONNECT]: Conectado a AWS IoT Core <====");

  setInterval(() => {
    const timestamp_utc = new Date().toISOString();

    nextState();

    const status = {
      ...jsonData.general_usv_status,
      usv_id: THING_NAME,
      actividad: state.bateria <= 25 ? "RETORNO" : jsonData.general_usv_status.actividad,
      bateria_porcentaje: round(state.bateria, 1),
      corriente_motor_1_a: round(state.corriente_motor_1, 2),
      corriente_motor_2_a: round(state.corriente_motor_2, 2),
      voltaje_celda_1_v: round(state.voltaje_celda_1, 3),
      voltaje_celda_2_v: round(state.voltaje_celda_2, 3),
      voltaje_celda_3_v: round(state.voltaje_celda_3, 3),
      roll_grados: round(state.roll, 2),
      pitch_grados: round(state.pitch, 2),
      yaw_grados: round(state.yaw, 2),
      latitud: round(state.latitud, 6),
      longitud: round(state.longitud, 6),
      timestamp_utc,
    };

    const mission = {
      ...jsonData.mision,
      usv_id: THING_NAME,
      estado_mision: state.bateria <= 25 ? "RETORNO" : jsonData.mision.estado_mision,
      latitud: status.latitud,
      longitud: status.longitud,
      temperatura_agua_c: round(state.temperatura, 2),
      ph_agua: round(state.ph, 3),
      turbidez_ntu: round(state.turbidez, 2),
      oxigeno_disuelto_ppm: round(state.oxigeno, 2),
      timestamp_utc,
    };

    const log = createLog(status, mission, timestamp_utc);

    // Enviar USV Status
    device.publish(
      TOPICS.STATUS,
      JSON.stringify(status)
    );
    console.log(`[SEND]: status ${status.bateria_porcentaje}% | lat ${status.latitud} | lon ${status.longitud}`);

    // Enviar Mission Data
    device.publish(
      TOPICS.MISSION,
      JSON.stringify(mission)
    );
    console.log(`[SEND]: mission Temp ${mission.temperatura_agua_c}C | pH ${mission.ph_agua} | O2 ${mission.oxigeno_disuelto_ppm}`);

    // Enviar Logs
    device.publish(
      TOPICS.LOGS,
      JSON.stringify(log)
    );
    console.log(`[SEND]: log [${log.nivel}] ${log.codigo} - ${log.mensaje}`);
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