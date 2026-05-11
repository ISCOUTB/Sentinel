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
  WAYPOINTS: `${THING_NAME}/waypoints`,
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
  waypoints: [],
  currentWaypointIndex: 0,
  active_mission_id: null,
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

  if (state.waypoints && state.waypoints.length > 0 && state.currentWaypointIndex < state.waypoints.length) {
    // Navigation mode
    const target = state.waypoints[state.currentWaypointIndex];
    const dx = target.lng - state.longitud;
    const dy = target.lat - state.latitud;
    const distance = Math.sqrt(dx * dx + dy * dy);

    // Si estamos suficientemente cerca, pasamos al siguiente punto
    if (distance < 0.0001) {
      state.currentWaypointIndex++;
      console.log(`[NAV]: Waypoint alcanzado. Siguiente waypoint: ${state.currentWaypointIndex}`);
    } else {
      // Nos movemos un paso fijo hacia el objetivo
      const step = Math.min(0.00008, distance); // Velocidad
      state.longitud += (dx / distance) * step;
      state.latitud += (dy / distance) * step;

      // Ajustar yaw apuntando al destino
      const targetBearing = (Math.atan2(dx, dy) * 180) / Math.PI;
      state.yaw = (targetBearing + 360) % 360;
    }
  } else {
    // Modo Drift (Sin misión activa)
    state.latitud += 0.00005 + (Math.random() * 2 - 1) * 0.00002;
    state.longitud += 0.00003 + (Math.random() * 2 - 1) * 0.00002;
  }

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

let awsConnected = false;

device.on("connect", () => {
  console.log("[CONNECT]: Conectado a AWS IoT Core <====");
  awsConnected = true;

  // Suscribirse al tópico de waypoints
  device.subscribe(TOPICS.WAYPOINTS);
  console.log(`[SUBSCRIBE]: Escuchando en ${TOPICS.WAYPOINTS}`);
});

device.on("message", (topic, payload) => {
  if (topic === TOPICS.WAYPOINTS) {
    try {
      const data = JSON.parse(payload.toString());
      console.log(`[RECV WAYPOINTS]: Recibidos ${data.points?.length} puntos para la misión ${data.mission_id}`);
      if (data.points && Array.isArray(data.points)) {
        state.waypoints = data.points;
        state.currentWaypointIndex = 0;
        if (data.mission_id) {
          state.active_mission_id = data.mission_id;
          console.log(`[NAV]: Misión activa asignada a ${state.active_mission_id}`);
        }
      }
    } catch (err) {
      console.error("[RECV ERROR]: Error parseando waypoints", err);
    }
  }
});

device.on("close", () => {
  console.log("[CLOSE]: CONEXIÓN CERRADA <====");
  awsConnected = false;
});

device.on("reconnect", () => {
  console.log("[RECONNECT]: Reintentando conexión... <====");
  awsConnected = false;
});

device.on("error", (err) => {
  console.error("[ERROR]:", err);
  awsConnected = false;
});

setInterval(async () => {
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
    mission_id: state.active_mission_id || "sin_mision",
    timestamp_utc,
  };

  const log = createLog(status, mission, timestamp_utc);

  if (awsConnected) {
    // Enviar USV Status
    device.publish(TOPICS.STATUS, JSON.stringify(status));
    console.log(`[SEND AWS]: status ${status.bateria_porcentaje}% | lat ${status.latitud} | lon ${status.longitud}`);

    // Enviar Mission Data
    device.publish(TOPICS.MISSION, JSON.stringify(mission));
    console.log(`[SEND AWS]: mission Temp ${mission.temperatura_agua_c}C | pH ${mission.ph_agua} | O2 ${mission.oxigeno_disuelto_ppm}`);

    // Enviar Logs
    device.publish(TOPICS.LOGS, JSON.stringify(log));
    console.log(`[SEND AWS]: log [${log.nivel}] ${log.codigo} - ${log.mensaje}`);
  }

  // Siempre enviar a HTTP Local para popular la base de datos y permitir reportes
  if (state.active_mission_id) {
    try {
      const telemetryPayload = {
        mission_id: state.active_mission_id,
        latitud: status.latitud,
        longitud: status.longitud,
        temperatura_agua_c: mission.temperatura_agua_c,
        ph_agua: mission.ph_agua,
        turbidez_ntu: mission.turbidez_ntu,
        bateria_porcentaje: status.bateria_porcentaje
      };

      const postRes = await fetch('http://localhost:8000/api/v1/data/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telemetryPayload)
      });

      if (postRes.ok) {
        console.log(`[FALLBACK SUCCESS]: Telemetría guardada en DB local para misión ${state.active_mission_id}`);
      } else {
        const errorText = await postRes.text();
        console.error(`[FALLBACK ERROR]: Error al guardar telemetría [${postRes.status}]`, errorText);
        // Detener misión ante cualquier error del backend (finalizada, no encontrada, 422, etc)
        state.active_mission_id = null;
        state.waypoints = [];
      }
    } catch (err) {
      console.error(`[FALLBACK ERROR]: Backend local no accesible`, err.message);
    }
  } else {
    // Para depuración si no hay misión activa
    // console.log(`[FALLBACK INFO]: No hay misión EN_PROGRESO para enviar telemetría.`);
  }
}, 5000);