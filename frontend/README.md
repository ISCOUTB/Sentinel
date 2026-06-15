# Sentinel HMI: Frontend React & TypeScript

Este directorio contiene el cliente web de monitoreo y control (HMI - Human Machine Interface) del proyecto Sentinel, construido utilizando **React**, **TypeScript**, **Vite** y **Tailwind CSS**.

---

## 🎨 Características Destacadas

### 1. Mapa Interactivo 2D (Leaflet) y Validación Visual de Agua
* Renderiza waypoints de misiones en tiempo real.
* **Control Inteligente de Seguridad**: Implementa la función `checkWaterColor`. Al hacer clic en el mapa para situar un punto de la ruta, el HMI calcula matemáticamente el Tile OSM correspondiente, carga el tile gráfico en un Canvas de HTML5 en memoria y evalúa el pixel exacto. Si el píxel no se encuentra dentro del rango de color azul representativo de cuerpos de agua en OpenStreetMap, el punto es rechazado y se notifica al operador mediante una alerta sonora/visual.

### 2. Panel 3D de Orientación Física (React Three Fiber)
* Incrusta un Canvas de Three.js que renderiza un modelo del USV (`/boat.glb`) con luces dinámicas y sombras.
* **Interpolación Lineal (`lerp`)**: Se suscribe a los ángulos IMU (roll, pitch, yaw) reportados por el WebSocket MQTT. En lugar de aplicar rotaciones directas que ocasionen saltos bruscos ante retardos de red, el bucle de animación de Three.js aproxima sutilmente el modelo al ángulo de destino con un factor de atenuación exponencial, simulando un movimiento hidráulico real.
* Simula una oscilación de oleaje sinusoidal constante sobre el eje Y.

### 3. Conexión WebSocket Presignada con SigV4
* El servicio `iot-config.ts` utiliza las credenciales temporales obtenidas desde Cognito Identity Pool para firmar criptográficamente una URL del protocolo `wss://` usando el algoritmo AWS Signature Version 4.
* Abre un cliente nativo MQTT del SDK v2 que se suscribe a los tópicos de telemetría y publica comandos.

---

## 📂 Estructura del Código Fuente

```
frontend/src/
├── api/
│   └── gateway.ts        # Clientes HTTP authAPI y dataAPI
├── assets/               # Archivos estáticos y water.json
├── components/           # Componentes visuales
│   ├── ui/               # Componentes atómicos base (Shadcn UI)
│   ├── AlertNotification.tsx  # Alertas emergentes para logs de error
│   ├── Boat3D.tsx        # Render procedimental del bote 3D (Fallback)
│   ├── MapView.tsx       # Leaflet Map y escena Three.js integrada
│   ├── MissionRoute.tsx  # Marcadores de waypoints y cálculo de distancias
│   ├── ReportGeneratorModal.tsx # Selector de misiones y gatillo de PDF
│   ├── SensorChart.tsx   # Gráficos Recharts en tiempo real
│   ├── SensorPanel.tsx   # Panel lateral con indicadores
│   └── StatusBar.tsx     # Barra superior de batería y red
├── config/
│   └── cognito.ts        # Lector y validador de configuración de AWS
├── contexts/
│   ├── AuthContext.tsx   # Proveedor de autenticación dual (Cognito/Local)
│   └── IoTContext.tsx    # Distribuidor global de mensajes MQTT
├── hooks/
│   ├── useIoTconnection.ts # Gestión de ciclo de vida del socket y reducer
│   └── useKeyboardControls.ts # Atajos del teclado para paneo
├── services/
│   ├── cognitoAuthService.ts # SDK wrapper para registro/login en Cognito
│   └── iot-config.ts     # Firma SigV4 y vinculación de políticas de AWS IoT
├── types/
│   └── iot.types.ts      # Contratos de tipos del USV
└── utils/
    └── validators.ts     # Helpers para validar telemetría ruidosa
```

---

## 🛠️ Ejecución Local

### Requisitos
* Node.js v18 o superior
* Bun o npm como gestor de paquetes

### Pasos para arrancar
1. Instala las dependencias necesarias:
   ```bash
   npm install
   ```
2. Asegúrate de configurar las variables de entorno con prefijo `VITE_` en el archivo `.env` en la raíz del proyecto.
3. Ejecuta el servidor de desarrollo de Vite:
   ```bash
   npm run dev
   ```
4. Abre [http://localhost:5173](http://localhost:5173) en tu navegador.
