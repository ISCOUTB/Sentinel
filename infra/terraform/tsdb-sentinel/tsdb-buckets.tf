# Creación de buckets adicionales en InfluxDB usando la API
# InfluxDB v3 (Timestream) solo permite un bucket inicial, los demás se crean vía API

# Resource null para crear buckets adicionales usando local-exec
# InfluxDB v3 (Timestream) permite gestionar buckets vía API v2 compatible
resource "null_resource" "create_additional_buckets" {
  for_each = toset(var.additional_buckets)

  triggers = {
    instance_id  = aws_timestreaminfluxdb_db_instance.influxdb_instance.id
    bucket_name  = each.value
    endpoint     = aws_timestreaminfluxdb_db_instance.influxdb_instance.endpoint
    port         = aws_timestreaminfluxdb_db_instance.influxdb_instance.port
    organization = var.organization_name
    username     = var.db_username
    password     = var.db_password
  }

  provisioner "local-exec" {
    command = <<-EOT
      set -e
      URL="https://${self.triggers.endpoint}:${self.triggers.port}"
      COOKIE_FILE="/tmp/influx_cookie_${self.triggers.bucket_name}.txt"

      echo "----------------------------------------------------------"
      echo " Intentando crear bucket: ${self.triggers.bucket_name}"
      
      # 1. Esperar a que el servicio esté realmente listo (Health Check)
      echo " Esperando a que el servicio esté listo..."
      MAX_RETRIES=30
      COUNT=0
      while ! curl -s -k "$URL/health" > /dev/null; do
        COUNT=$((COUNT+1))
        if [ $COUNT -ge $MAX_RETRIES ]; then
          echo " [ERROR]: El servicio no respondió después de 5 minutos."
          exit 1
        fi
        echo "   (Intento $COUNT/$MAX_RETRIES) Esperando 10s..."
        sleep 10
      done
      echo " [INFO] El servicio está respondiendo. Esperando 15s adicionales para estabilidad..."
      sleep 15

      # 2. Obtener Cookie de Sesión (Signin)
      echo " Autenticando..."
      SIGNIN_CODE=$(curl -s -k -c "$COOKIE_FILE" -w "%%{http_code}" -o /dev/null -X POST -u "${self.triggers.username}:${self.triggers.password}" "$URL/api/v2/signin")
      
      if [ "$SIGNIN_CODE" != "204" ] && [ "$SIGNIN_CODE" != "200" ]; then
        echo " [ERROR] de Autenticación (Signin): HTTP $SIGNIN_CODE"
        exit 1
      fi
      echo " [INFO] Autenticación exitosa (HTTP $SIGNIN_CODE)."

      # 3. Obtener OrgID real usando la sesión
      echo " Buscando ID de organización..."
      ORGS_JSON=$(curl -s -k -b "$COOKIE_FILE" "$URL/api/v2/orgs")
      # Usar Python para parsear el JSON correctamente
      ORG_ID=$(echo "$ORGS_JSON" | python3 -c "import sys, json; data=json.load(sys.stdin); print(data['orgs'][0]['id'])" 2>/dev/null)
      
      if [ -z "$ORG_ID" ]; then
        echo " [ERROR]: No se pudo encontrar el OrgID en la respuesta."
        echo " Respuesta de /api/v2/orgs: $ORGS_JSON"
        rm -f "$COOKIE_FILE"
        exit 1
      fi
      echo " OrgID encontrado: $ORG_ID"

      # 4. Crear Bucket
      echo " Creando bucket..."
      CREATE_RESPONSE=$(curl -s -k -b "$COOKIE_FILE" -w "\n%%{http_code}" -X POST "$URL/api/v2/buckets" \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"${self.triggers.bucket_name}\", \"orgID\": \"$ORG_ID\", \"retentionRules\": []}")

      HTTP_CODE=$(echo "$CREATE_RESPONSE" | tail -n1)
      BODY=$(echo "$CREATE_RESPONSE" | head -n-1)

      if [ "$HTTP_CODE" = "201" ]; then
        echo " [INFO]: Bucket '${self.triggers.bucket_name}' creado."
      elif [ "$HTTP_CODE" = "422" ] && echo "$BODY" | grep -q "already exists"; then
        echo " [¡¡INFO!!]: El bucket '${self.triggers.bucket_name}' ya existe."
      else
        echo " [¡¡¡ATENCIÓN!!!]: Código HTTP $HTTP_CODE recibido."
        echo " Respuesta: $BODY"
      fi

      rm -f "$COOKIE_FILE"
      echo "----------------------------------------------------------"
    EOT

    interpreter = ["/bin/bash", "-c"]
  }

  depends_on = [aws_timestreaminfluxdb_db_instance.influxdb_instance]
}

# Resource para verificar los buckets creados
resource "null_resource" "list_buckets_output" {
  triggers = {
    always_run = timestamp()
  }

  provisioner "local-exec" {
    command = <<-EOT
      URL="https://${aws_timestreaminfluxdb_db_instance.influxdb_instance.endpoint}:${aws_timestreaminfluxdb_db_instance.influxdb_instance.port}"
      COOKIE_FILE="/tmp/influx_list_cookie.txt"

      echo ""
      echo "========================================="
      echo " Verificando lista final de buckets:"
      echo "========================================="

      # Esperar a que el servicio esté listo
      while ! curl -s -k "$URL/health" > /dev/null; do
        sleep 5
      done

      # 1. Signin
      curl -s -k -c "$COOKIE_FILE" -X POST -u "${var.db_username}:${var.db_password}" "$URL/api/v2/signin" > /dev/null

      # 2. List
      curl -s -k -b "$COOKIE_FILE" "$URL/api/v2/buckets" -H "Accept: application/json" | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sed 's/^/  - /'

      rm -f "$COOKIE_FILE"
      echo "========================================="
    EOT

    interpreter = ["/bin/bash", "-c"]
  }

  depends_on = [null_resource.create_additional_buckets]
}
