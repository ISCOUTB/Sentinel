# IoT -> Influx local bridge (reemplazo de Lambda)

Este mini proyecto sustituye la Lambda de insercion por un contenedor local que:

- se conecta a AWS IoT Core via MQTT con certificados,
- consume los topicos `usv/+/data`,
- reutiliza la logica de transformacion a line protocol,
- escribe en InfluxDB local usando la API `/api/v2/write`.

## Estructura

- `app/main.py`: bridge MQTT -> Influx (script reutilizado/adaptado de Lambda)
- `Dockerfile`: build multistage para imagen mas liviana
- `docker-compose.yml`: InfluxDB local + bridge
- `.env.example`: variables necesarias

## 1 Preparacion

1. Copia variables:
   - Linux/macOS: `cp .env.example .env`
   - PowerShell: `Copy-Item .env.example .env`
2. Edita `.env` y coloca tu `AWS_IOT_ENDPOINT` real.
3. Asegura certificados en `tests/iot-emulator/certs`:
   - `AmazonRootCA1.pem`
   - `device.pem.crt`
   - `private.pem.key`

## 2 Levantar stack local

Desde `infra/container/iot-influx-bridge`:

```bash
docker compose up --build -d
```

Ver logs del bridge:

```bash
docker compose logs -f iot-influx-bridge
```

## 3 Prueba IoT normal

En otra terminal, ejecuta el emulador actual sin cambios:

```bash
cd tests/iot-emulator
npm install
node index.js
```

El bridge debe mostrar lineas como:

- `[OK] usv/status/data -> bucket=general_status`
- `[OK] usv/mission/data -> bucket=mission`
- `[OK] usv/logs/data -> bucket=logs`

## 4 Verificar datos en Influx local

Si tienes el CLI de Influx dentro del contenedor:

```bash
docker exec -it sentinel-influxdb influx query \
  'from(bucket:"general_status") |> range(start: -5m) |> limit(n:5)' \
  --org sentinel-org \
  --token sentinel-local-admin-token-please-change
```

## Enrutamiento por bucket

`TOPIC_BUCKET_MAP` define el bucket por topico. Si un topico no aparece, usa `INFLUXDB_BUCKET`.

## Importante para "independiente de donde este el contenedor"

- El bridge no usa `localhost` para AWS IoT, solo `AWS_IOT_ENDPOINT`.
- Influx es configurable por `INFLUXDB_URL`.
- Fuera de Docker Compose, define `INFLUXDB_URL` al host/servicio real y mantiene los mismos certs/env vars.

## Apagar

```bash
docker compose down
```

Para borrar volumenes de Influx (reset completo):

```bash
docker compose down -v
```
