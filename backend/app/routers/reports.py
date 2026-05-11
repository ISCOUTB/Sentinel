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

@router.post("/generate")
def generate_report(mission_id: str = Query(...), db: Session = Depends(get_db), current_user = Depends(get_current_user)):
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(status_code=404, detail="Misión no encontrada")

    try:
        client = InfluxDBClient(url=settings.INFLUXDB_URL, token=settings.INFLUXDB_TOKEN, org=settings.INFLUXDB_ORG)
        query_api = client.query_api()

        query = f'''
            from(bucket: "{settings.INFLUXDB_BUCKET}")
            |> range(start: 0)
            |> filter(fn: (r) => r._measurement == "iot_telemetry")
            |> pivot(rowKey:["_time"], columnKey: ["_field"], valueColumn: "_value")
            |> filter(fn: (r) => r.mission_id == "{mission_id}")
        '''
        
        tables = query_api.query(query, org=settings.INFLUXDB_ORG)
        
        data_dicts = []
        for table in tables:
            for record in table.records:
                data_dicts.append({
                    "timestamp": record.get_time(),
                    "temperature": record.values.get("temperatura_agua_c"),
                    "ph": record.values.get("ph_agua"),
                    "turbidity": record.values.get("turbidez_ntu"),
                })
    except Exception as e:
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
    Eres un analista experto en calidad del agua. A continuación se presentan las estadísticas de una misión de monitoreo (Misión ID: {mission.name}):
    
    - Temperatura (°C): Min {stats.get('temperature', {}).get('min', 'N/A') if stats.get('temperature') else 'N/A':.2f}, Max {stats.get('temperature', {}).get('max', 'N/A') if stats.get('temperature') else 'N/A':.2f}, Promedio {stats.get('temperature', {}).get('mean', 'N/A') if stats.get('temperature') else 'N/A':.2f}
    - pH: Min {stats.get('ph', {}).get('min', 'N/A') if stats.get('ph') else 'N/A':.2f}, Max {stats.get('ph', {}).get('max', 'N/A') if stats.get('ph') else 'N/A':.2f}, Promedio {stats.get('ph', {}).get('mean', 'N/A') if stats.get('ph') else 'N/A':.2f}
    - Turbidez (NTU): Min {stats.get('turbidity', {}).get('min', 'N/A') if stats.get('turbidity') else 'N/A':.2f}, Max {stats.get('turbidity', {}).get('max', 'N/A') if stats.get('turbidity') else 'N/A':.2f}, Promedio {stats.get('turbidity', {}).get('mean', 'N/A') if stats.get('turbidity') else 'N/A':.2f}
    
    Por favor, redacta un análisis ejecutivo de la calidad del agua basado en estos parámetros. Menciona si hay alguna anomalía o riesgo ambiental (considera los niveles normales de agua dulce o marina según tu criterio). Escribe el reporte en español, usando formato HTML básico (párrafos, listas) sin usar Markdown.
    """
    
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
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
        stats=stats,
        ai_analysis=ai_analysis,
        graphs=graphs,
        date=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    )

    # Generate PDF
    pdf_bytes = HTML(string=html_out).write_pdf()

    return Response(content=pdf_bytes, media_type="application/pdf", headers={
        "Content-Disposition": f"attachment; filename=Reporte_Mision_{mission.id}.pdf"
    })
