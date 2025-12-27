-- Crear tabla de usuarios si no existe
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('admin', 'technician') NOT NULL,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    organization VARCHAR(255),
    phone VARCHAR(20),
    contact_email VARCHAR(255),
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
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Insertar datos de prueba
INSERT IGNORE INTO users (email, username, password, role, first_name, last_name, organization, phone, contact_email) VALUES
('admin@example.com', 'admin', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6fM/yqqqS', 'admin', 'Admin', 'User', 'USV Corp', '+1234567890', 'admin@usvcorp.com'),
('tech1@example.com', 'tech1', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6fM/yqqqS', 'technician', 'John', 'Doe', 'Tech Solutions', '+0987654321', 'john.doe@techsolutions.com'),
('tech2@example.com', 'tech2', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj6fM/yqqqS', 'technician', 'Jane', 'Smith', 'Innovate Inc', '+1122334455', 'jane.smith@innovate.com');