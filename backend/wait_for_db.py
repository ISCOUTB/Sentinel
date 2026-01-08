#!/usr/bin/env python3
import time
import pymysql
import os

def wait_for_db():
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