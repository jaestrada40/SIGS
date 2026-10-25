-- Modelo estrella de SISG (Grupo 4). Dos tablas de hechos que comparten tres dimensiones conformadas:
--   dim_tiempo, dim_geografia, dim_entidad  (clase 9: dimensiones conformadas)
-- Se mantiene en estrella pura ("empieza siempre en estrella", clase 12); ver README para el candidato a copo de nieve.
DROP DATABASE IF EXISTS sisg_dw;
CREATE DATABASE sisg_dw CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE sisg_dw;

-- ---------- Dimensiones ----------
CREATE TABLE dim_tiempo (
  tiempo_key    INT PRIMARY KEY,               -- yyyymmdd
  fecha         DATE NOT NULL UNIQUE,
  anio          SMALLINT NOT NULL,
  trimestre     TINYINT NOT NULL,
  mes           TINYINT NOT NULL,
  nombre_mes    VARCHAR(12) NOT NULL,
  dia           TINYINT NOT NULL,
  dia_semana    VARCHAR(10) NOT NULL,
  es_fin_semana BOOLEAN NOT NULL
);

CREATE TABLE dim_geografia (                     -- desnormalizada: departamento y municipio en la misma tabla
  geo_key         SMALLINT AUTO_INCREMENT PRIMARY KEY,
  departamento_id TINYINT UNSIGNED NULL,
  municipio_id    SMALLINT UNSIGNED NULL,
  departamento    VARCHAR(40) NOT NULL,
  municipio       VARCHAR(60) NOT NULL,
  INDEX ix_geo_municipio (municipio_id),
  INDEX ix_geo_departamento (departamento_id)
);

CREATE TABLE dim_entidad (
  entidad_key  INT AUTO_INCREMENT PRIMARY KEY,
  entidad_id   INT NOT NULL UNIQUE,
  nombre       VARCHAR(120) NOT NULL,
  tipo_entidad VARCHAR(40) NOT NULL,
  departamento VARCHAR(40) NOT NULL
);

-- Sin datos personales: el DW solo guarda sexo, no nombre ni DPI (datos de salud).
CREATE TABLE dim_paciente (
  paciente_key INT AUTO_INCREMENT PRIMARY KEY,
  paciente_id  INT NOT NULL UNIQUE,
  sexo         CHAR(2) NOT NULL
);

CREATE TABLE dim_grupo_etario (
  grupo_etario_key SMALLINT PRIMARY KEY,
  etiqueta         VARCHAR(10) NOT NULL,
  edad_min         TINYINT UNSIGNED NULL,
  edad_max         TINYINT UNSIGNED NULL
);
INSERT INTO dim_grupo_etario VALUES
  (-1,'Sin dato',NULL,NULL),(1,'0-14',0,14),(2,'15-29',15,29),(3,'30-44',30,44),(4,'45-59',45,59),(5,'60+',60,130);

CREATE TABLE dim_tipo_estudio (
  tipo_estudio_key SMALLINT AUTO_INCREMENT PRIMARY KEY,
  tipo_estudio_id  TINYINT UNSIGNED NOT NULL UNIQUE,
  tipo_estudio     VARCHAR(60) NOT NULL,
  categoria        VARCHAR(30) NOT NULL
);

CREATE TABLE dim_area_campana (
  area_key SMALLINT AUTO_INCREMENT PRIMARY KEY,
  area_id  TINYINT UNSIGNED NOT NULL UNIQUE,
  area     VARCHAR(40) NOT NULL
);

-- ---------- Hechos ----------
-- Grano: un estudio diagnóstico.
CREATE TABLE fact_estudio (
  estudio_id       BIGINT PRIMARY KEY,           -- dimensión degenerada
  tiempo_key       INT NOT NULL,
  entidad_key      INT NOT NULL,
  geo_key          SMALLINT NOT NULL,            -- residencia del paciente
  paciente_key     INT NOT NULL,
  tipo_estudio_key SMALLINT NOT NULL,
  grupo_etario_key SMALLINT NOT NULL,            -- edad del paciente el día del estudio
  estado           ENUM('PROGRAMADO','REALIZADO','CANCELADO') NOT NULL,
  cantidad         TINYINT NOT NULL DEFAULT 1,
  costo_q          DECIMAL(10,2) NULL,
  duracion_min     SMALLINT UNSIGNED NULL,
  FOREIGN KEY (tiempo_key)       REFERENCES dim_tiempo (tiempo_key),
  FOREIGN KEY (entidad_key)      REFERENCES dim_entidad (entidad_key),
  FOREIGN KEY (geo_key)          REFERENCES dim_geografia (geo_key),
  FOREIGN KEY (paciente_key)     REFERENCES dim_paciente (paciente_key),
  FOREIGN KEY (tipo_estudio_key) REFERENCES dim_tipo_estudio (tipo_estudio_key),
  FOREIGN KEY (grupo_etario_key) REFERENCES dim_grupo_etario (grupo_etario_key)
);

-- Grano: una campaña de salud.
CREATE TABLE fact_campana (
  campana_id         INT PRIMARY KEY,            -- dimensión degenerada
  tiempo_inicio_key  INT NOT NULL,
  tiempo_fin_key     INT NULL,                   -- dim_tiempo en dos roles: inicio y fin
  entidad_key        INT NOT NULL,
  geo_key            SMALLINT NOT NULL,
  area_key           SMALLINT NOT NULL,
  estado             ENUM('PROGRAMADA','EN_CURSO','FINALIZADA') NOT NULL,
  personas_atendidas INT UNSIGNED NOT NULL,
  presupuesto_q      DECIMAL(12,2) NULL,
  duracion_dias      SMALLINT UNSIGNED NOT NULL,
  FOREIGN KEY (tiempo_inicio_key) REFERENCES dim_tiempo (tiempo_key),
  FOREIGN KEY (tiempo_fin_key)    REFERENCES dim_tiempo (tiempo_key),
  FOREIGN KEY (entidad_key)       REFERENCES dim_entidad (entidad_key),
  FOREIGN KEY (geo_key)           REFERENCES dim_geografia (geo_key),
  FOREIGN KEY (area_key)          REFERENCES dim_area_campana (area_key)
);

-- Tabla de sumarización (clase 9): estudios realizados por mes, entidad y tipo (sin geografía, para que sea realmente más chica que el hecho).
CREATE TABLE fact_estudio_mensual (
  anio              SMALLINT NOT NULL,
  mes               TINYINT NOT NULL,
  entidad_key       INT NOT NULL,
  tipo_estudio_key  SMALLINT NOT NULL,
  total_estudios    INT NOT NULL,
  ingresos_q        DECIMAL(14,2) NOT NULL,
  duracion_prom_min DECIMAL(8,2) NULL,
  PRIMARY KEY (anio, mes, entidad_key, tipo_estudio_key)
);

-- Control de cargas del ETL.
CREATE TABLE etl_log (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  inicio         DATETIME NOT NULL,
  fin            DATETIME NULL,
  filas_estudio  INT NULL,
  filas_campana  INT NULL,
  filas_resumen  INT NULL,
  resultado      VARCHAR(10) NOT NULL,
  mensaje        TEXT NULL
);

-- Rol de solo lectura para analistas (clase 7: mínimo privilegio).
CREATE ROLE IF NOT EXISTS analista;
GRANT SELECT ON sisg_dw.* TO analista;
