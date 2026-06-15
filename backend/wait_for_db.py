#!/usr/bin/env python3
"""
Sentinel Backend — Script de espera para la Base de Datos.

Este script se ejecuta durante el arranque del contenedor del backend.
Analiza la cadena de conexión de base de datos y realiza intentos de ping a MySQL
hasta que el servidor se encuentre listo para recibir conexiones, evitando caídas
por desfases de orden de inicio de los servicios.
"""

import time
import pymysql
import os

def wait_for_db():
    """
    Realiza intentos repetidos de conexión TCP/IP hacia la base de datos MySQL.
    
    Parsea la cadena `DATABASE_URL` o usa variables de entorno individuales
    para configurar el socket de PyMySQL. Realiza hasta 30 intentos espaciados por 2s.
    
    Returns:
        bool: True si la base de datos respondió exitosamente, False en caso contrario.
    """
    database_url = os.getenv('DATABASE_URL')
    if database_url and "://" in database_url:
        try:
            # Parse format: mysql+pymysql://user:password@host:port/dbname
            # Remove the protocol part
            url_part = database_url.split("://")[1]
            # Split credentials and host/db
            creds, rest = url_part.split("@")
            user, password = creds.split(":")
            # Split host:port and dbname
            host_port, dbname = rest.split("/")
            if ":" in host_port:
                host, port = host_port.split(":")
            else:
                host, port = host_port, 3306
            
            db_config = {
                'host': host,
                'user': user,
                'password': password,
                'database': dbname,
                'port': int(port)
            }
        except Exception as e:
            print(f"Error parsing DATABASE_URL, falling back to separate env vars: {e}")
            db_config = {
                'host': os.getenv('DB_HOST', 'db'),
                'user': os.getenv('DB_USER', 'usv_user'),
                'password': os.getenv('DB_PASSWORD', 'usv_password'),
                'database': os.getenv('DB_NAME', 'usv_hmi'),
                'port': int(os.getenv('DB_PORT', 3306))
            }
    else:
        db_config = {
            'host': os.getenv('DB_HOST', 'db'),
            'user': os.getenv('DB_USER', 'usv_user'),
            'password': os.getenv('DB_PASSWORD', 'usv_password'),
            'database': os.getenv('DB_NAME', 'usv_hmi'),
            'port': int(os.getenv('DB_PORT', 3306))
        }

    max_attempts = 30
    for attempt in range(max_attempts):
        try:
            connection = pymysql.connect(**db_config)
            connection.close()
            print("Database is ready!")
            return True
        except pymysql.Error as e:
            print(f"Database not ready (attempt {attempt + 1}/{max_attempts}): {e}")
            time.sleep(2)

    print("Database did not become ready in time")
    return False

if __name__ == "__main__":
    if not wait_for_db():
        exit(1)