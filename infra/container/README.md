# Consultas Flux para evitar el error de mean con strings

Este archivo incluye consultas listas para usar en InfluxDB Data Explorer.

Error que se evita:
- unsupported input type for mean aggregate: string

Causa:
- `mean()` solo funciona con campos numericos.
- Si la consulta mezcla campos de texto (logs, estados, mensajes), falla.

## 1) Consulta recomendada (solo campos numericos)

Usa esta como consulta base para paneles de metricas:

```flux
from(bucket: "mi-bucket-inicial")
  |> range(start: v.timeRangeStart, stop: v.timeRangeStop)
  |> filter(fn: (r) => r._measurement == "iot_telemetry")
  |> filter(fn: (r) => contains(value: r._field, set: [
    "temperatura_agua_c",
    "ph_agua",
    "turbidez_ntu",
    "oxigeno_disuelto_ppm",
    "bateria_porcentaje"
  ]))
  |> aggregateWindow(every: v.windowPeriod, fn: mean, createEmpty: false)
  |> yield(name: "mean_numeric_only")
```

## 2) Ultimo valor por senal (sin promedio)

```flux
from(bucket: "mi-bucket-inicial")
  |> range(start: -30m)
  |> filter(fn: (r) => r._measurement == "iot_telemetry")
  |> filter(fn: (r) => contains(value: r._field, set: [
    "temperatura_agua_c",
    "ph_agua",
    "turbidez_ntu",
    "oxigeno_disuelto_ppm",
    "bateria_porcentaje"
  ]))
  |> last()
  |> yield(name: "last_numeric")
```

## 3) Consulta para campos de texto (sin mean)

Usa `last()` para estados y mensajes:

```flux
from(bucket: "mi-bucket-inicial")
  |> range(start: -30m)
  |> filter(fn: (r) => r._measurement == "iot_telemetry")
  |> filter(fn: (r) => contains(value: r._field, set: [
    "actividad",
    "estado_mision",
    "nivel",
    "mensaje"
  ]))
  |> last()
  |> yield(name: "last_text_fields")
```

## 4) Diagnostico rapido de tipos/campos

Para ver una muestra por campo y detectar si estas mezclando texto con numeros:

```flux
from(bucket: "mi-bucket-inicial")
  |> range(start: -30m)
  |> filter(fn: (r) => r._measurement == "iot_telemetry")
  |> group(columns: ["_field"])
  |> limit(n: 1)
  |> keep(columns: ["_field", "_value"])
  |> yield(name: "sample_fields")
```

## Recomendacion de uso

- Usa la consulta #1 para graficas de promedio.
- Usa la consulta #3 para texto.
- No mezcles texto y agregaciones numericas en la misma consulta con `mean()`.
