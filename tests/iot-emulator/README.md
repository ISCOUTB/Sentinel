# 🚢 IoT Emulator - USV "El Barquito"

Este proyecto es un emulador de dispositivo IoT diseñado para simular el comportamiento de un **Vehículo de Superficie No Tripulado (USV)**. Permite enviar datos telemétricos, de misión y logs a **AWS IoT Core** utilizando el protocolo MQTT.

## 📋 Tabla de Contenidos

- [Características](#-características)
- [Requisitos Previos](#-requisitos-previos)
- [Instalación](#-instalación)
- [Configuración](#-configuración)
  - [Certificados de AWS](#certificados-de-aws)
  - [Archivo de Simulación (TOML)](#archivo-de-simulación-toml)
- [Uso](#-uso)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Tópicos MQTT](#-tópicos-mqtt)

---

## 🚀 Características

- **Simulación Flexible**: Permite elegir qué tipo de datos enviar mediante códigos de combinación.
- **Integración con AWS**: Conexión segura mediante certificados X.509 a AWS IoT Core.
- **Datos Completos**: Simula estado general (batería, motores, GPS), datos de misión (sensores de agua) y logs del sistema.
- **Basado en TOML**: Configuración fácil de leer y editar.

## 🛠 Requisitos Previos

- [Node.js](https://nodejs.org/) (v14 o superior recomendado)
- [npm](https://www.npmjs.com/)
- Una cuenta de AWS con un "Thing" configurado en AWS IoT Core.

## 📦 Instalación

1. Navega a la carpeta del emulador:
   ```bash
   cd tests/iot-emulator
   ```
2. Instala las dependencias necesarias:
   ```bash
   npm install
   ```

## ⚙️ Configuración

### Certificados de AWS

Para que el emulador se conecte a AWS IoT Core, debes colocar tus certificados en la carpeta `certs/` (la carpeta debes crearla en la carpeta `tests/iot-emulator/`). El código espera los siguientes nombres:

- `AmazonRootCA1.pem`: Certificado de la autoridad certificadora de Amazon.
- `device.pem.crt`: Certificado de tu dispositivo (Thing).
- `private.pem.key`: Llave privada de tu dispositivo.

### Configuración del Entorno (`.env`)

El emulador utiliza variables de entorno para evitar valores fijos en el código.

1. Copia el archivo de ejemplo:
   ```bash
   cp .env.example .env
   ```
2. Edita el archivo `.env` con tus credenciales de AWS:
   - `AWS_IOT_ENDPOINT`: Tu endpoint de AWS IoT Core (ej. `111aaa222bbb33-ats.iot.us-east-1.amazonaws.com`).
   - `AWS_IOT_CLIENT_ID`: Identificador único para el cliente MQTT.
   - `AWS_IOT_PRIVATE_KEY_PATH`: Ruta a tu llave privada (por defecto `certs/private.pem.key`).
   - `AWS_IOT_CERT_PATH`: Ruta a tu certificado (por defecto `certs/device.pem.crt`).
   - `AWS_IOT_CA_PATH`: Ruta al certificado CA de Amazon (por defecto `certs/AmazonRootCA1.pem`).

> **Nota**: Puedes encontrar tu endpoint en la consola de AWS IoT Core bajo la sección **Settings**.

### Archivo de Simulación (TOML)

El archivo `usv_simulation.toml` controla los datos que se envían.

#### Selección de Datos (`active_combination_code`)

Puedes cambiar qué información se publica modificando el valor de `active_combination_code` en la sección `[simulation]`:

| Código | Datos Enviados                             |
| :----- | :----------------------------------------- |
| **1**  | Solo Estado General (`general_usv_status`) |
| **2**  | Solo Datos de Misión (`mission`)           |
| **4**  | Solo Logs de Sistema (`logs`)              |
| **3**  | Estado General + Misión                    |
| **5**  | Estado General + Logs                      |
| **6**  | Misión + Logs                              |
| **7**  | **Todos los datos (Recomendado)**          |

#### Secciones de Datos

- `[general_usv_status]`: Información de batería, GPS, giroscopio y estado de motores.
- `[mission]`: Información sobre puntos de muestreo y valores de sensores (pH, temperatura, turbidez, oxígeno).
- `[logs]`: Mensajes de estado internos del sistema.

## 🚦 Uso

Para iniciar el emulador, simplemente ejecuta:

```bash
node index.js
```

El script mostrará en consola cuando se conecte exitosamente y confirmará cada publicación de datos realizada (por defecto cada 5 segundos).

## 📂 Estructura del Proyecto

- `index.js`: Lógica principal de conexión y publicación MQTT.
- `usv_simulation.toml`: Configuración de datos a enviar.
- `certs/`: Carpeta para certificados de seguridad.
- `package.json`: Definición de dependencias del proyecto.

## 📡 Tópicos MQTT

El emulador publica datos en los siguientes tópicos:

1. `usv/status/data`: Datos de telemetría y estado del hardware.
2. `usv/mission/data`: Información de la misión actual y sensores científicos.
3. `usv/logs/data`: Registro de eventos y errores.

---

_Desarrollado para el proyecto Sentinel / El Barquito._
