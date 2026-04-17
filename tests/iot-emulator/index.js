require('dotenv').config();
const awsIot = require('aws-iot-device-sdk');
const fs = require('fs');
const path = require('path');

console.log('<==== Emulador USV iniciado ====>');

// ===== Cargar JSON para configuración inicial =====
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

// ===== Estado Simulado (Dinámico) =====
let simulationState = {
  startTime: Date.now(),
  iterationCount: 0,
  
  // Posición GPS (progresa gradualmente)
  latitud: 10.4005,
  longitud: -75.5002,
  
  // Batería (disminuye gradualmente)
  bateria: 85,
  
  // Sensores del agua (varían naturalmente)
  temperatura: 25.4,
  ph: 7.21,
  turbidez: 15.8,
  oxigeno: 8.5,
  
  // Motores y voltaje
  corriente_motor_1: 15.5,
  corriente_motor_2: 16.2,
  
  // Orientación
  roll: 5.2,
  pitch: -1.1,
  yaw: 185.0,
  
  // Historial de logs
  logHistory: []
};

// ===== Función para generar perturbaciones suaves =====
function addSmallNoise(value, maxChange = 0.5) {
  return value + (Math.random() - 0.5) * maxChange * 2;
}

// ===== Función para generar datos coherentes =====
function generateSensorData() {
  const iteration = simulationState.iterationCount++;
  const elapsedMinutes = (Date.now() - simulationState.startTime) / 60000;
  
  // Movimiento GPS progresivo (simulando trayectoria)
  simulationState.latitud += 0.0001 * Math.sin(iteration * 0.05);
  simulationState.longitud += 0.0001 * Math.cos(iteration * 0.05);
  
  // Batería disminuye gradualmente (0.2% cada 5 segundos, aprox. 2.4% por minuto)
  simulationState.bateria = Math.max(20, 85 - (elapsedMinutes * 2.4));
  
  // Sensores con cambios naturales pero progresivos
  simulationState.temperatura = addSmallNoise(simulationState.temperatura, 0.3);
  simulationState.ph = addSmallNoise(simulationState.ph, 0.15);
  simulationState.turbidez = addSmallNoise(simulationState.turbidez, 0.8);
  simulationState.oxigeno = addSmallNoise(simulationState.oxigeno, 0.3);
  
  // Corrientes del motor con pequeñas variaciones
  simulationState.corriente_motor_1 = addSmallNoise(simulationState.corriente_motor_1, 0.8);
  simulationState.corriente_motor_2 = addSmallNoise(simulationState.corriente_motor_2, 0.8);
  
  // Orientación con cambios suaves
  simulationState.roll = addSmallNoise(simulationState.roll, 0.5);
  simulationState.pitch = addSmallNoise(simulationState.pitch, 0.5);
  simulationState.yaw = (simulationState.yaw + 0.5) % 360;
  
  // Limitar valores a rangos razonables
  simulationState.temperatura = Math.max(20, Math.min(30, simulationState.temperatura));
  simulationState.ph = Math.max(6.5, Math.min(8.0, simulationState.ph));
  simulationState.turbidez = Math.max(5, Math.min(50, simulationState.turbidez));
  simulationState.oxigeno = Math.max(5, Math.min(12, simulationState.oxigeno));
  simulationState.corriente_motor_1 = Math.max(5, Math.min(20, simulationState.corriente_motor_1));
  simulationState.corriente_motor_2 = Math.max(5, Math.min(20, simulationState.corriente_motor_2));
}

// ===== Función para generar logs coherentes =====
function generateCoherentLog() {
  const iteration = simulationState.iterationCount;
  const bateria = simulationState.bateria;
  const temperatura = simulationState.temperatura;
  const oxigeno = simulationState.oxigeno;
  
  let mensaje = "";
  let nivel = "INFO";
  let codigo = 101;
  
  // Logs según el estado actual
  if (iteration % 20 === 0) {
    // Reporte periódico de posición
    mensaje = `Posición actualizada - Lat: ${simulationState.latitud.toFixed(4)}, Lon: ${simulationState.longitud.toFixed(4)}`;
    codigo = 102;
  } else if (iteration % 15 === 0) {
    // Reporte de sensores de agua
    mensaje = `Lecturas de agua - Temp: ${temperatura.toFixed(1)}°C, pH: ${simulationState.ph.toFixed(2)}, O2: ${oxigeno.toFixed(1)} ppm`;
    codigo = 103;
  } else if (bateria < 40 && bateria > 35) {
    // Advertencia de batería baja
    mensaje = `Advertencia: Batería en nivel bajo (${bateria.toFixed(1)}%). Considera retornar a base`;
    nivel = "WARNING";
    codigo = 201;
  } else if (bateria < 25) {
    // Crítica de batería
    mensaje = `CRÍTICO: Batería crítica (${bateria.toFixed(1)}%). Iniciando retorno obligatorio`;
    nivel = "ERROR";
    codigo = 301;
  } else if (temperatura > 28) {
    // Temperatura alta
    mensaje = `Temperatura del agua elevada: ${temperatura.toFixed(1)}°C`;
    nivel = "WARNING";
    codigo = 202;
  } else if (oxigeno < 6) {
    // Oxígeno bajo
    mensaje = `Nivel bajo de oxígeno disuelto: ${oxigeno.toFixed(1)} ppm`;
    nivel = "WARNING";
    codigo = 203;
  } else if (iteration % 50 === 0) {
    // Reporte de estado general
    mensaje = `Estado nominal - Motores OK, Sensores calibrados, Comunicación estable`;
    codigo = 104;
  } else {
    // Log neutral
    mensaje = `Tarea en progreso...`;
    codigo = 100;
  }
  
  return {
    nivel,
    mensaje,
    codigo,
    timestamp_utc: new Date().toISOString()
  };
}

device.on("connect", () => {
  console.log("[CONNECT]: Conectado a AWS IoT Core <====");

  setInterval(() => {
    const timestamp_utc = new Date().toISOString();
    
    generateSensorData();

    // Enviar USV Status
    const usvStatus = {
      usv_id: THING_NAME,
      conexion: "ONLINE",
      actividad: simulationState.bateria > 25 ? "EN_MISION" : "RETORNANDO",
      
      bateria_porcentaje: parseFloat(simulationState.bateria.toFixed(1)),
      corriente_motor_1_a: parseFloat(simulationState.corriente_motor_1.toFixed(1)),
      corriente_motor_2_a: parseFloat(simulationState.corriente_motor_2.toFixed(1)),
      voltaje_celda_1_v: 3.85,
      voltaje_celda_2_v: 3.86,
      voltaje_celda_3_v: 3.84,
      
      roll_grados: parseFloat(simulationState.roll.toFixed(1)),
      pitch_grados: parseFloat(simulationState.pitch.toFixed(1)),
      yaw_grados: parseFloat(simulationState.yaw.toFixed(1)),
      
      latitud: parseFloat(simulationState.latitud.toFixed(4)),
      longitud: parseFloat(simulationState.longitud.toFixed(4)),
      
      timestamp_utc
    };

    device.publish(TOPICS.STATUS, JSON.stringify(usvStatus));
    console.log(`[SEND]: status enviado - Batería: ${usvStatus.bateria_porcentaje}%, Pos: (${usvStatus.latitud}, ${usvStatus.longitud})`);

    // Enviar Mission Data
    const missionData = {
      mission_id: "MISION-20251007-001",
      usv_id: THING_NAME,
      tipo_mision: "MCA",
      estado_mision: simulationState.bateria > 25 ? "EN_PROGRESO" : "COMPLETADA",
      
      punto_id: "PUNTO-001",
      latitud: parseFloat(simulationState.latitud.toFixed(4)),
      longitud: parseFloat(simulationState.longitud.toFixed(4)),
      profundidad_m: 5,
      
      temperatura_agua_c: parseFloat(simulationState.temperatura.toFixed(1)),
      ph_agua: parseFloat(simulationState.ph.toFixed(2)),
      turbidez_ntu: parseFloat(simulationState.turbidez.toFixed(1)),
      oxigeno_disuelto_ppm: parseFloat(simulationState.oxigeno.toFixed(1)),
      
      timestamp_utc
    };

    device.publish(TOPICS.MISSION, JSON.stringify(missionData));
    console.log(`[SEND]: mission enviado - Temp: ${missionData.temperatura_agua_c}°C, pH: ${missionData.ph_agua}, O2: ${missionData.oxigeno_disuelto_ppm} ppm`);

    // Generar log coherente y enviarlo
    const logData = generateCoherentLog();
    const logMessage = {
      log_id: `LOG-20251007-${String(simulationState.iterationCount).padStart(3, '0')}`,
      usv_id: THING_NAME,
      mission_id: "MISION-20251007-001",
      nivel: logData.nivel,
      mensaje: logData.mensaje,
      codigo: logData.codigo,
      timestamp_utc: logData.timestamp_utc
    };

    device.publish(TOPICS.LOGS, JSON.stringify(logMessage));
    console.log(`[SEND]: log enviado [${logData.nivel}] (${logData.codigo}): ${logData.mensaje}`);
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