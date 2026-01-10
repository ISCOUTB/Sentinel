-- Crear tabla de usuarios
-- En desarrollo, dropear para asegurar esquema limpio
-- En producción, usar ALTER TABLE para migraciones
SET @drop_tables = IFNULL(@drop_tables, 'false');

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    hashed_password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'user',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Crear tabla de permisos si no existe (opcional, para roles más granulares)
CREATE TABLE IF NOT EXISTS permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT
);

-- Crear tabla de roles_permisos para asignar permisos a roles
CREATE TABLE IF NOT EXISTS role_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    role ENUM('admin', 'technician') NOT NULL,
    permission_id INT NOT NULL,
    FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
);

-- Insertar permisos básicos
INSERT IGNORE INTO permissions (name, description) VALUES
('read_users', 'Permiso para leer usuarios'),
('write_users', 'Permiso para crear/editar usuarios'),
('delete_users', 'Permiso para eliminar usuarios'),
('read_sensors', 'Permiso para leer datos de sensores'),
('write_sensors', 'Permiso para modificar datos de sensores'),
('admin_access', 'Acceso completo de administrador');

-- Asignar permisos a roles
INSERT IGNORE INTO role_permissions (role, permission_id) VALUES
('admin', 1), ('admin', 2), ('admin', 3), ('admin', 4), ('admin', 5), ('admin', 6),
('technician', 1), ('technician', 4), ('technician', 5);

-- Crear tabla de refresh tokens
DROP TABLE IF EXISTS refresh_tokens;
CREATE TABLE refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    is_revoked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insertar datos de prueba
INSERT IGNORE INTO users (username, email, hashed_password, role) VALUES
('admin', 'admin@example.com', '$2b$12$wcvlhPkhoS6/4qfnOXcJOOER./IgBh78dPBP01T2YiMa4FNpeOKsi', 'admin'),
('tech1', 'tech1@example.com', '$2b$12$wcvlhPkhoS6/4qfnOXcJOOER./IgBh78dPBP01T2YiMa4FNpeOKsi', 'user'),
('tech2', 'tech2@example.com', '$2b$12$wcvlhPkhoS6/4qfnOXcJOOER./IgBh78dPBP01T2YiMa4FNpeOKsi', 'user');