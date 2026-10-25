-- Puente app -> fuente, paso 1: staging. Refleja tal cual lo que exporta la app (Postgres), sin validar nada.
DROP DATABASE IF EXISTS sisg_stg;
CREATE DATABASE sisg_stg CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
USE sisg_stg;

CREATE TABLE stg_entidad  (id INT, nombre VARCHAR(200), tipo VARCHAR(40), departamento VARCHAR(80), telefono VARCHAR(40), correo VARCHAR(200));
CREATE TABLE stg_paciente (id INT, entidad_id INT, nombre_completo VARCHAR(200), dpi VARCHAR(40), fecha_nacimiento DATE NULL, sexo VARCHAR(4),
                           departamento VARCHAR(80), municipio VARCHAR(80), telefono VARCHAR(40), estado VARCHAR(40));
CREATE TABLE stg_estudio  (id INT, entidad_id INT, paciente_id INT, tipo_estudio VARCHAR(120), sala_equipo VARCHAR(80), fecha DATE, hora TIME NULL,
                           especialista VARCHAR(120), resultado TEXT, estado VARCHAR(40));
CREATE TABLE stg_campana  (id INT, entidad_id INT, nombre VARCHAR(200), area VARCHAR(40), departamento VARCHAR(80), ubicacion VARCHAR(200),
                           fecha_inicio DATE, fecha_fin DATE NULL, personas_atendidas INT NULL, estado VARCHAR(20));

-- Postgres exporta NULL como campo vacío; aquí vacío = NULL.
LOAD DATA INFILE '/var/lib/mysql-files/entidad.csv' INTO TABLE stg_entidad CHARACTER SET utf8mb4
  FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"' LINES TERMINATED BY '\n'
  (id, nombre, tipo, @dep, @tel, correo) SET departamento = NULLIF(@dep, ''), telefono = NULLIF(@tel, '');

LOAD DATA INFILE '/var/lib/mysql-files/paciente.csv' INTO TABLE stg_paciente CHARACTER SET utf8mb4
  FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"' LINES TERMINATED BY '\n'
  (id, entidad_id, nombre_completo, @dpi, @nac, sexo, @dep, @mun, @tel, @est)
  SET dpi = NULLIF(@dpi, ''), fecha_nacimiento = NULLIF(@nac, ''), departamento = NULLIF(@dep, ''), municipio = NULLIF(@mun, ''),
      telefono = NULLIF(@tel, ''), estado = NULLIF(@est, '');

LOAD DATA INFILE '/var/lib/mysql-files/estudio.csv' INTO TABLE stg_estudio CHARACTER SET utf8mb4
  FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"' LINES TERMINATED BY '\n'
  (id, entidad_id, paciente_id, tipo_estudio, @sala, fecha, @hora, @esp, @res, @est)
  SET sala_equipo = NULLIF(@sala, ''), hora = NULLIF(@hora, ''), especialista = NULLIF(@esp, ''), resultado = NULLIF(@res, ''), estado = NULLIF(@est, '');

LOAD DATA INFILE '/var/lib/mysql-files/campana.csv' INTO TABLE stg_campana CHARACTER SET utf8mb4
  FIELDS TERMINATED BY ',' OPTIONALLY ENCLOSED BY '"' ESCAPED BY '"' LINES TERMINATED BY '\n'
  (id, entidad_id, nombre, area, @dep, @ubi, fecha_inicio, @fin, @per, estado)
  SET departamento = NULLIF(@dep, ''), ubicacion = NULLIF(@ubi, ''), fecha_fin = NULLIF(@fin, ''), personas_atendidas = NULLIF(@per, '');
