-- ER de las fuentes (OLTP) del Grupo 4: centros de diagnóstico y organismos no lucrativos.
-- Parte del modelo de la app (entidad, paciente, estudio, campaña) y lo lleva a 3FN:
--   * catálogos en vez de texto libre (departamento, municipio, tipo de estudio, área)
--   * llaves foráneas, únicos, CHECK e índices
--   * columnas nuevas pensadas para medir: costo_q, duracion_min, presupuesto_q
DROP DATABASE IF EXISTS sisg_fuente;
CREATE DATABASE sisg_fuente CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE sisg_fuente;

CREATE TABLE departamento (
  id     TINYINT UNSIGNED PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE municipio (
  id              SMALLINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  departamento_id TINYINT UNSIGNED NOT NULL,
  nombre          VARCHAR(60) NOT NULL,
  UNIQUE (departamento_id, nombre),
  FOREIGN KEY (departamento_id) REFERENCES departamento (id)
);

CREATE TABLE tipo_entidad (
  id     TINYINT UNSIGNED PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE entidad (
  id              INT AUTO_INCREMENT PRIMARY KEY,
  nombre          VARCHAR(120) NOT NULL,
  tipo_entidad_id TINYINT UNSIGNED NOT NULL,
  departamento_id TINYINT UNSIGNED NULL,
  telefono        VARCHAR(20),
  correo          VARCHAR(120) NOT NULL UNIQUE,
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (tipo_entidad_id) REFERENCES tipo_entidad (id),
  FOREIGN KEY (departamento_id) REFERENCES departamento (id)
);

-- Cada entidad solo ve sus pacientes (decisión de la app), por eso el DPI es único por entidad.
CREATE TABLE paciente (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  entidad_id       INT NOT NULL,
  nombre_completo  VARCHAR(120) NOT NULL,
  dpi              VARCHAR(20) NULL,
  fecha_nacimiento DATE NULL,
  sexo             ENUM('F','M','NE') NOT NULL,
  departamento_id  TINYINT UNSIGNED NULL,
  municipio_id     SMALLINT UNSIGNED NULL,
  telefono         VARCHAR(20),
  estado           ENUM('ACTIVO','INACTIVO') NOT NULL DEFAULT 'ACTIVO',
  UNIQUE (entidad_id, dpi),
  INDEX ix_paciente_municipio (municipio_id),
  FOREIGN KEY (entidad_id)     REFERENCES entidad (id),
  FOREIGN KEY (departamento_id) REFERENCES departamento (id),
  FOREIGN KEY (municipio_id)   REFERENCES municipio (id)
);

CREATE TABLE tipo_estudio (
  id            TINYINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre        VARCHAR(60) NOT NULL UNIQUE,
  categoria     VARCHAR(30) NOT NULL,
  precio_base_q DECIMAL(10,2) NOT NULL,
  duracion_base SMALLINT UNSIGNED NOT NULL
);

CREATE TABLE estudio (
  id              BIGINT AUTO_INCREMENT PRIMARY KEY,
  entidad_id      INT NOT NULL,
  paciente_id     INT NOT NULL,
  tipo_estudio_id TINYINT UNSIGNED NOT NULL,
  fecha           DATE NOT NULL,
  hora            TIME NULL,
  especialista    VARCHAR(80),
  sala_equipo     VARCHAR(40),
  estado          ENUM('PROGRAMADO','REALIZADO','CANCELADO') NOT NULL DEFAULT 'PROGRAMADO',
  duracion_min    SMALLINT UNSIGNED NULL,
  costo_q         DECIMAL(10,2) NULL CHECK (costo_q IS NULL OR costo_q >= 0),
  resultado       TEXT NULL,
  INDEX ix_estudio_entidad_fecha (entidad_id, fecha),
  INDEX ix_estudio_paciente (paciente_id),
  INDEX ix_estudio_tipo (tipo_estudio_id),
  FOREIGN KEY (entidad_id)      REFERENCES entidad (id),
  FOREIGN KEY (paciente_id)     REFERENCES paciente (id),
  FOREIGN KEY (tipo_estudio_id) REFERENCES tipo_estudio (id)
);

CREATE TABLE area_campana (
  id     TINYINT UNSIGNED PRIMARY KEY,
  nombre VARCHAR(40) NOT NULL UNIQUE
);

CREATE TABLE campana (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  entidad_id        INT NOT NULL,
  area_id           TINYINT UNSIGNED NOT NULL,
  nombre            VARCHAR(120) NOT NULL,
  departamento_id   TINYINT UNSIGNED NULL,
  municipio_id      SMALLINT UNSIGNED NULL,
  ubicacion         VARCHAR(120) NULL,
  fecha_inicio      DATE NOT NULL,
  fecha_fin         DATE NULL,
  estado            ENUM('PROGRAMADA','EN_CURSO','FINALIZADA') NOT NULL DEFAULT 'PROGRAMADA',
  personas_atendidas INT UNSIGNED NOT NULL DEFAULT 0,
  presupuesto_q     DECIMAL(12,2) NULL,
  CHECK (fecha_fin IS NULL OR fecha_fin >= fecha_inicio),
  INDEX ix_campana_entidad_fecha (entidad_id, fecha_inicio),
  FOREIGN KEY (entidad_id)      REFERENCES entidad (id),
  FOREIGN KEY (area_id)         REFERENCES area_campana (id),
  FOREIGN KEY (departamento_id) REFERENCES departamento (id),
  FOREIGN KEY (municipio_id)    REFERENCES municipio (id)
);

-- Bitácora de auditoría (la llenan los triggers de 03_fuente_triggers.sql).
CREATE TABLE bitacora (
  id          BIGINT AUTO_INCREMENT PRIMARY KEY,
  tabla       VARCHAR(30) NOT NULL,
  registro_id BIGINT NOT NULL,
  accion      ENUM('INSERT','UPDATE','DELETE') NOT NULL,
  usuario_db  VARCHAR(80) NOT NULL,
  fecha_hora  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  detalle     JSON NULL,
  INDEX ix_bitacora_tabla_registro (tabla, registro_id)
);
