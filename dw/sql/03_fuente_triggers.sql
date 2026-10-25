-- Reglas de negocio y auditoría en la base (clase 2: triggers). Se crean después de cargar datos de prueba.
USE sisg_fuente;
DELIMITER $$

-- Solo un centro de diagnóstico registra estudios, y solo de sus propios pacientes.
CREATE TRIGGER trg_estudio_valida BEFORE INSERT ON estudio FOR EACH ROW
BEGIN
  IF (SELECT tipo_entidad_id FROM entidad WHERE id = NEW.entidad_id) <> 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un centro de diagnóstico puede registrar estudios';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM paciente WHERE id = NEW.paciente_id AND entidad_id = NEW.entidad_id) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'El paciente no pertenece a la entidad';
  END IF;
END$$

-- Solo un organismo no lucrativo registra campañas.
CREATE TRIGGER trg_campana_valida BEFORE INSERT ON campana FOR EACH ROW
BEGIN
  IF (SELECT tipo_entidad_id FROM entidad WHERE id = NEW.entidad_id) <> 2 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Solo un organismo no lucrativo puede registrar campañas';
  END IF;
END$$

CREATE TRIGGER trg_estudio_ai AFTER INSERT ON estudio FOR EACH ROW
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_db, detalle)
  VALUES ('estudio', NEW.id, 'INSERT', CURRENT_USER(), JSON_OBJECT('estado', NEW.estado, 'paciente_id', NEW.paciente_id))$$

CREATE TRIGGER trg_estudio_au AFTER UPDATE ON estudio FOR EACH ROW
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_db, detalle)
  VALUES ('estudio', NEW.id, 'UPDATE', CURRENT_USER(),
          JSON_OBJECT('estado_anterior', OLD.estado, 'estado_nuevo', NEW.estado, 'resultado_modificado', NOT (OLD.resultado <=> NEW.resultado)))$$

CREATE TRIGGER trg_campana_au AFTER UPDATE ON campana FOR EACH ROW
  INSERT INTO bitacora (tabla, registro_id, accion, usuario_db, detalle)
  VALUES ('campana', NEW.id, 'UPDATE', CURRENT_USER(),
          JSON_OBJECT('estado_anterior', OLD.estado, 'estado_nuevo', NEW.estado,
                      'personas_anterior', OLD.personas_atendidas, 'personas_nuevo', NEW.personas_atendidas))$$

DELIMITER ;
