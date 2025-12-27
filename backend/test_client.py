#!/usr/bin/env python3
"""
Cliente HTTP interactivo para probar los endpoints de autenticación
del backend USV HMI.

Uso:
    python test_client.py

Comandos disponibles:
- register: Registrar un nuevo usuario
- login: Iniciar sesión
- refresh: Refrescar token de acceso
- me: Obtener información del usuario actual
- logout: Cerrar sesión
- help: Mostrar ayuda
- quit: Salir
"""

import requests
import json
import getpass
from typing import Optional, Dict, Any

class AuthTestClient:
    def __init__(self, base_url: str = "http://localhost:8000"):
        self.base_url = base_url.rstrip('/')
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.session = requests.Session()

    def _get_headers(self, use_auth: bool = True) -> Dict[str, str]:
        """Obtener headers para las peticiones."""
        headers = {'Content-Type': 'application/json'}
        if use_auth and self.access_token:
            headers['Authorization'] = f'Bearer {self.access_token}'
        return headers

    def _make_request(self, method: str, endpoint: str, data: Optional[Dict] = None, use_auth: bool = True) -> Dict[str, Any]:
        """Hacer una petición HTTP."""
        url = f"{self.base_url}{endpoint}"
        headers = self._get_headers(use_auth)

        try:
            if method.upper() == 'GET':
                response = self.session.get(url, headers=headers)
            elif method.upper() == 'POST':
                response = self.session.post(url, headers=headers, json=data)
            else:
                return {'error': f'Método HTTP no soportado: {method}'}

            if response.status_code >= 200 and response.status_code < 300:
                try:
                    return response.json()
                except:
                    return {'message': response.text}
            else:
                try:
                    error_data = response.json()
                    return {'error': error_data.get('detail', f'Error {response.status_code}: {response.text}')}
                except:
                    return {'error': f'Error {response.status_code}: {response.text}'}

        except requests.exceptions.RequestException as e:
            return {'error': f'Error de conexión: {str(e)}'}

    def register(self, username: str, email: str, password: str, role: str = "user") -> Dict[str, Any]:
        """Registrar un nuevo usuario."""
        data = {
            "username": username,
            "email": email,
            "password": password,
            "role": role
        }
        return self._make_request('POST', '/api/v1/auth/register', data, use_auth=False)

    def login(self, username: str, password: str) -> Dict[str, Any]:
        """Iniciar sesión."""
        data = {
            "username": username,
            "password": password
        }
        result = self._make_request('POST', '/api/v1/auth/login', data, use_auth=False)

        if 'access_token' in result and 'refresh_token' in result:
            self.access_token = result['access_token']
            self.refresh_token = result['refresh_token']
            print("✅ Tokens guardados exitosamente")

        return result

    def refresh_token(self) -> Dict[str, Any]:
        """Refrescar el token de acceso."""
        if not self.refresh_token:
            return {'error': 'No hay refresh token disponible. Inicia sesión primero.'}

        # Para refresh, usamos el refresh token como bearer token
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.refresh_token}'
        }

        try:
            response = self.session.post(f"{self.base_url}/api/v1/auth/refresh", headers=headers)
            if response.status_code >= 200 and response.status_code < 300:
                result = response.json()
                if 'access_token' in result:
                    self.access_token = result['access_token']
                    print("✅ Token de acceso refrescado")
                return result
            else:
                try:
                    error_data = response.json()
                    return {'error': error_data.get('detail', f'Error {response.status_code}: {response.text}')}
                except:
                    return {'error': f'Error {response.status_code}: {response.text}'}
        except requests.exceptions.RequestException as e:
            return {'error': f'Error de conexión: {str(e)}'}

    def get_me(self) -> Dict[str, Any]:
        """Obtener información del usuario actual."""
        if not self.access_token:
            return {'error': 'No hay token de acceso. Inicia sesión primero.'}

        return self._make_request('GET', '/api/v1/auth/me')

    def logout(self) -> Dict[str, Any]:
        """Cerrar sesión."""
        if not self.refresh_token:
            return {'error': 'No hay refresh token disponible. Inicia sesión primero.'}

        # Para logout, usamos el refresh token como bearer token
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.refresh_token}'
        }

        try:
            response = self.session.post(f"{self.base_url}/api/v1/auth/logout", headers=headers)
            if response.status_code >= 200 and response.status_code < 300:
                result = response.json()
                # Limpiar tokens después del logout
                self.access_token = None
                self.refresh_token = None
                print("✅ Sesión cerrada, tokens limpiados")
                return result
            else:
                try:
                    error_data = response.json()
                    return {'error': error_data.get('detail', f'Error {response.status_code}: {response.text}')}
                except:
                    return {'error': f'Error {response.status_code}: {response.text}'}
        except requests.exceptions.RequestException as e:
            return {'error': f'Error de conexión: {str(e)}'}

    def show_status(self) -> None:
        """Mostrar el estado actual de autenticación."""
        print("\n📊 Estado de autenticación:")
        if self.access_token:
            print("✅ Access Token: Presente")
        else:
            print("❌ Access Token: No disponible")

        if self.refresh_token:
            print("✅ Refresh Token: Presente")
        else:
            print("❌ Refresh Token: No disponible")
        print()

def print_help():
    """Mostrar ayuda."""
    print("""
🤖 Cliente de Prueba para USV HMI Backend

Comandos disponibles:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
register    Registrar un nuevo usuario
login       Iniciar sesión con usuario existente
refresh     Refrescar el token de acceso
me          Obtener información del usuario actual
logout      Cerrar sesión
status      Mostrar estado de autenticación
help        Mostrar esta ayuda
quit        Salir del cliente

Ejemplos:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
register
login
refresh
me
logout
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
""")

def main():
    """Función principal del cliente interactivo."""
    print("🚀 Iniciando cliente de prueba para USV HMI Backend")
    print("📡 Conectando a: http://localhost:8000")
    print("💡 Escribe 'help' para ver los comandos disponibles\n")

    client = AuthTestClient()

    while True:
        try:
            command = input("usv-hmi> ").strip().lower()

            if command == 'quit' or command == 'exit':
                print("👋 ¡Hasta luego!")
                break

            elif command == 'help':
                print_help()

            elif command == 'status':
                client.show_status()

            elif command == 'register':
                print("📝 Registro de nuevo usuario")
                username = input("Username: ").strip()
                email = input("Email: ").strip()
                password = getpass.getpass("Password: ")
                role = input("Role (admin/user) [user]: ").strip() or "user"

                result = client.register(username, email, password, role)
                print("Resultado:", json.dumps(result, indent=2))

            elif command == 'login':
                print("🔐 Inicio de sesión")
                username = input("Username/Email: ").strip()
                password = getpass.getpass("Password: ")

                result = client.login(username, password)
                print("Resultado:", json.dumps(result, indent=2))

            elif command == 'refresh':
                print("🔄 Refrescando token...")
                result = client.refresh_token()
                print("Resultado:", json.dumps(result, indent=2))

            elif command == 'me':
                print("👤 Obteniendo información del usuario...")
                result = client.get_me()
                print("Resultado:", json.dumps(result, indent=2))

            elif command == 'logout':
                print("🚪 Cerrando sesión...")
                result = client.logout()
                print("Resultado:", json.dumps(result, indent=2))

            elif command == '':
                continue

            else:
                print(f"❌ Comando desconocido: {command}")
                print("Escribe 'help' para ver los comandos disponibles")

        except KeyboardInterrupt:
            print("\n👋 ¡Hasta luego!")
            break
        except Exception as e:
            print(f"❌ Error: {str(e)}")

if __name__ == "__main__":
    main()