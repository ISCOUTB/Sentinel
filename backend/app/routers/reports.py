import os
import uuid
import datetime
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
import google.generativeai as genai
import pandas as pd
import matplotlib.pyplot as plt
import io
import base64
from jinja2 import Environment, FileSystemLoader
from weasyprint import HTML
from influxdb_client import InfluxDBClient

from app.database import get_db
from app.models.models import Mission
from app.dependencies.auth import get_current_user
from app.config import settings

router = APIRouter(prefix="/reports", tags=["reports"])

# Configure Gemini
genai.configure(api_key=settings.GEMINI_API_KEY)

def generate_graphs(df: pd.DataFrame) -> dict:
    graphs = {}
    metrics = {
        'temperature': ('Temperatura del Agua (°C)', 'red'),
        'ph': ('pH del Agua', 'green'),
        'turbidity': ('Turbidez (NTU)', 'orange'),
    }

    for column, (title, color) in metrics.items():
        if column in df.columns and not df[column].dropna().empty:
            plt.figure(figsize=(8, 4))
            plt.plot(df['timestamp'], df[column], color=color, marker='o', linestyle='-')
            plt.title(title)
            plt.xlabel('Tiempo')
            plt.ylabel('Valor')
            plt.grid(True)
            plt.tight_layout()
            
            buf = io.BytesIO()
            plt.savefig(buf, format='png')
            buf.seek(0)
            img_base64 = base64.b64encode(buf.read()).decode('utf-8')
            graphs[column] = f"data:image/png;base64,{img_base64}"
            plt.close()
    
    return graphs

def utc_to_bogota(utc_dt):
    """Convierte datetime de UTC a Bogotá (UTC-5) manualmente."""
    if not utc_dt:
        return None
    # Bogotá es UTC-5 siempre
    return utc_dt - datetime.timedelta(hours=5)

@router.post("/generate")
def generate_report(mission_id: str = Query(...), db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Misión no encontrada")

    # Calcular el número de misión (N)
    mission_count = db.query(Mission).filter(Mission.start_time <= mission.start_time).count()
    mission_seq_name = f"Misión {mission_count}"
    
    # Ajustar fechas a Bogotá
    start_time_bog = utc_to_bogota(mission.start_time)
    end_time_bog = utc_to_bogota(mission.end_time)
    now_bog = utc_to_bogota(datetime.datetime.utcnow())

    try:
        client = InfluxDBClient(url=settings.INFLUXDB_URL, token=settings.INFLUXDB_TOKEN, org=settings.INFLUXDB_ORG)
        query_api = client.query_api()

        query = f'''
            from(bucket: "{settings.INFLUXDB_BUCKET}")
            |> range(start: -1d)
            |> filter(fn: (r) => r._measurement == "usv_telemetry")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> filter(fn: (r) => r.mission_id == "{mission_id}")
        '''
        
        tables = query_api.query(query, org=settings.INFLUXDB_ORG)
        
        data_dicts = []
        for table in tables:
            for record in table.records:
                # Convertir timestamp de Influx (UTC) a Bogotá
                ts = record.get_time()
                if ts:
                    ts_bog = utc_to_bogota(ts.replace(tzinfo=None))
                else:
                    ts_bog = None

                # Debug: imprimir las llaves disponibles en el primer registro
                if not data_dicts:
                    print(f"DEBUG: InfluxDB record values keys: {list(record.values.keys())}")
                    print(f"DEBUG: Sample record: {record.values}")

                data_dicts.append({
                    "timestamp": ts_bog,
                    "temperature": record.values.get("temperatura_agua_c"),
                    "ph": record.values.get("ph_agua"),
                    "turbidity": record.values.get("turbidez_ntu"),
                })
    except Exception as e:
        print(f"DEBUG: Error in generate_report: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error al consultar InfluxDB: {str(e)}")

    if not data_dicts:
        raise HTTPException(status_code=400, detail="No hay datos de sensores para esta misión en InfluxDB")

    df = pd.DataFrame(data_dicts)

    # Calculate statistics
    stats = {}
    for col in ['temperature', 'ph', 'turbidity']:
        if col in df.columns:
            stats[col] = {
                'min': df[col].min(),
                'max': df[col].max(),
                'mean': df[col].mean()
            }

    # Ask Gemini for analysis
    prompt = f"""
    Eres un analista experto en calidad del agua. A continuación se presentan las estadísticas de una misión de monitoreo ({mission_seq_name} - {mission.name}):
    
    - Temperatura (°C): Min {stats.get('temperature', {}).get('min', 'N/A')}, Max {stats.get('temperature', {}).get('max', 'N/A')}, Promedio {stats.get('temperature', {}).get('mean', 'N/A')}
    - pH: Min {stats.get('ph', {}).get('min', 'N/A')}, Max {stats.get('ph', {}).get('max', 'N/A')}, Promedio {stats.get('ph', {}).get('mean', 'N/A')}
    - Turbidez (NTU): Min {stats.get('turbidity', {}).get('min', 'N/A')}, Max {stats.get('turbidity', {}).get('max', 'N/A')}, Promedio {stats.get('turbidity', {}).get('mean', 'N/A')}
    
    Por favor, redacta un análisis ejecutivo de la calidad del agua basado en estos parámetros. Menciona si hay alguna anomalía o riesgo ambiental (considera los niveles normales de agua dulce o marina según tu criterio). Escribe el reporte en español, usando formato HTML básico (párrafos, listas) sin usar Markdown. No incluyas el nombre del modelo de IA en el texto.
    """
    
    try:
        # Usar el nombre completo del modelo según la lista disponible
        model = genai.GenerativeModel('models/gemini-flash-latest')
        response = model.generate_content(prompt)
        ai_analysis = response.text.replace('```html', '').replace('```', '')
    except Exception as e:
        ai_analysis = f"<p>Error al generar el análisis de IA: {str(e)}</p>"

    # Generate graphs
    graphs = generate_graphs(df)

    # Render HTML template
    env = Environment(loader=FileSystemLoader("app/templates"))
    template = env.get_template("report_template.html")
    
    html_out = template.render(
        mission=mission,
        mission_seq_name=mission_seq_name,
        start_time_bog=start_time_bog,
        end_time_bog=end_time_bog,
        stats=stats,
        ai_analysis=ai_analysis,
        graphs=graphs,
        date_bog=now_bog.strftime("%Y-%m-%d"),
        time_bog=now_bog.strftime("%H:%M:%S")
    )

    # Generate PDF
    pdf_bytes = HTML(string=html_out).write_pdf()

    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=Reporte_Mision_{mission.id}.pdf"
    })

@router.post("/generate_csv")
def generate_csv_report(mission_id: str = Query(...), db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Misión no encontrada")

    try:
        client = InfluxDBClient(url=settings.INFLUXDB_URL, token=settings.INFLUXDB_TOKEN, org=settings.INFLUXDB_ORG)
        query_api = client.query_api()

        # Usar un rango más amplio si es necesario, o depender solo de mission_id
        query = f'''
            from(bucket: "{settings.INFLUXDB_BUCKET}")
            |> range(start: -30d)
            |> filter(fn: (r) => r._measurement == "usv_telemetry")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> filter(fn: (r) => r.mission_id == "{mission_id}")
        '''
        
        tables = query_api.query(query, org=settings.INFLUXDB_ORG)
        
        data_dicts = []
        for table in tables:
            for record in table.records:
                ts = record.get_time()
                if ts:
                    ts_bog = utc_to_bogota(ts.replace(tzinfo=None))
                else:
                    ts_bog = None

                data_dicts.append({
                    "timestamp": ts_bog,
                    "temperatura_agua_c": record.values.get("temperatura_agua_c"),
                    "ph_agua": record.values.get("ph_agua"),
                    "turbidez_ntu": record.values.get("turbidez_ntu"),
                })
    except Exception as e:
        print(f"DEBUG: Error in generate_csv: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error al consultar InfluxDB: {str(e)}")

    if not data_dicts:
        raise HTTPException(status_code=400, detail="No hay datos de sensores para esta misión en InfluxDB")

    df = pd.DataFrame(data_dicts)
    
    # Crear CSV en memoria
    csv_buffer = io.StringIO()
    df.to_csv(csv_buffer, index=False)
    csv_bytes = csv_buffer.getvalue().encode('utf-8')

    return Response(content=csv_bytes, media_type="text/csv", headers={
        "Content-Disposition": f"attachment; filename=Reporte_Mision_{mission.id}.csv"
    })

