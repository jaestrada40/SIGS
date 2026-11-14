-- SISG: base de la aplicacion (OLTP) con datos de ejemplo. MySQL 8.
-- Uso: mysql -uroot -p < 1_sisg_aplicacion.sql   (crea la base sisg)
CREATE DATABASE IF NOT EXISTS sisg CHARACTER SET utf8mb4;
USE sisg;
-- MySQL dump 10.13  Distrib 8.4.10, for Linux (aarch64)
--
-- Host: localhost    Database: sisg_export
-- ------------------------------------------------------
-- Server version	8.4.10

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `atencion`
--

DROP TABLE IF EXISTS `atencion`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `atencion` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entidadId` int NOT NULL,
  `campanaId` int NOT NULL,
  `pacienteId` int NOT NULL,
  `claveCliente` varchar(255) NOT NULL,
  `atendidoEn` datetime(6) NOT NULL,
  `creadoEn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_547f185f014f9f96c99cf08271` (`campanaId`,`pacienteId`),
  UNIQUE KEY `IDX_8ecbdd955794c32fad2dd8ee3c` (`entidadId`,`claveCliente`),
  KEY `FK_8be3cef276ae28444d303c614a7` (`pacienteId`),
  CONSTRAINT `FK_8be3cef276ae28444d303c614a7` FOREIGN KEY (`pacienteId`) REFERENCES `paciente` (`id`),
  CONSTRAINT `FK_f6867a2bf72896f48f8cd59c2b4` FOREIGN KEY (`campanaId`) REFERENCES `campana` (`id`),
  CONSTRAINT `FK_fbc916e8e29ac607ddaaa53c186` FOREIGN KEY (`entidadId`) REFERENCES `entidad` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `atencion`
--

LOCK TABLES `atencion` WRITE;
/*!40000 ALTER TABLE `atencion` DISABLE KEYS */;
/*!40000 ALTER TABLE `atencion` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `bitacora`
--

DROP TABLE IF EXISTS `bitacora`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `bitacora` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entidadId` int NOT NULL,
  `tabla` varchar(255) NOT NULL,
  `usuarioId` int DEFAULT NULL,
  `registroId` int DEFAULT NULL,
  `accion` varchar(255) NOT NULL,
  `detalle` json DEFAULT NULL,
  `creadoEn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  KEY `IDX_d3b1f411db6b39c9ba82203dc1` (`entidadId`,`id`),
  CONSTRAINT `FK_3cbbe572c84975a6ecffc00059e` FOREIGN KEY (`entidadId`) REFERENCES `entidad` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `bitacora`
--

LOCK TABLES `bitacora` WRITE;
/*!40000 ALTER TABLE `bitacora` DISABLE KEYS */;
INSERT INTO `bitacora` VALUES (4,2,'sesion',2,2,'MFA_ACTIVADO',NULL,'2026-11-14 02:23:54.962806'),(5,2,'sesion',2,2,'INICIO_SESION',NULL,'2026-11-14 02:23:54.971228'),(6,2,'sesion',2,2,'CIERRE_SESION',NULL,'2026-11-14 02:24:05.709935'),(7,3,'sesion',5,5,'MFA_ACTIVADO',NULL,'2026-11-14 02:24:36.316814'),(8,3,'sesion',5,5,'INICIO_SESION',NULL,'2026-11-14 02:24:36.323741');
/*!40000 ALTER TABLE `bitacora` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `campana`
--

DROP TABLE IF EXISTS `campana`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `campana` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entidadId` int NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `area` enum('CARDIOVASCULAR','RESPIRATORIA','PLANIFICACION','ONCOLOGICO_OTRO') NOT NULL,
  `departamento` varchar(255) DEFAULT NULL,
  `ubicacion` varchar(255) DEFAULT NULL,
  `fechaInicio` date NOT NULL,
  `fechaFin` date DEFAULT NULL,
  `personasAtendidas` int NOT NULL DEFAULT '0',
  `estado` enum('PROGRAMADA','EN_CURSO','FINALIZADA') NOT NULL DEFAULT 'PROGRAMADA',
  `costo` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_55286909d5a5ee5ec95aedbec47` (`entidadId`),
  CONSTRAINT `FK_55286909d5a5ee5ec95aedbec47` FOREIGN KEY (`entidadId`) REFERENCES `entidad` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `campana`
--

LOCK TABLES `campana` WRITE;
/*!40000 ALTER TABLE `campana` DISABLE KEYS */;
INSERT INTO `campana` VALUES (1,3,'Jornada de salud cardiovascular','CARDIOVASCULAR','Escuintla','Salón comunal, Escuintla','2026-06-17','2026-06-27',180,'FINALIZADA',8200.00),(2,3,'Tamizaje respiratorio escolar','RESPIRATORIA','Sacatepéquez','Salón comunal, Sacatepéquez','2026-07-27','2026-08-06',120,'FINALIZADA',5400.00),(3,3,'Prevención de cáncer cervicouterino','ONCOLOGICO_OTRO','Guatemala','Salón comunal, Guatemala','2026-09-05','2026-09-15',210,'FINALIZADA',9800.00),(4,3,'Planificación familiar rural','PLANIFICACION','Alta Verapaz','Salón comunal, Alta Verapaz','2026-10-25','2026-11-24',90,'EN_CURSO',4300.00),(5,3,'Mamografías comunitarias','ONCOLOGICO_OTRO','Quetzaltenango','Salón comunal, Quetzaltenango','2026-10-10','2026-11-11',60,'EN_CURSO',NULL),(6,3,'Chequeo cardiovascular 2027','CARDIOVASCULAR','Guatemala','Salón comunal, Guatemala','2026-12-04','2026-12-14',0,'PROGRAMADA',NULL);
/*!40000 ALTER TABLE `campana` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `enlace_resultado`
--

DROP TABLE IF EXISTS `enlace_resultado`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `enlace_resultado` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entidadId` int NOT NULL,
  `estudioId` int NOT NULL,
  `tokenHash` varchar(255) NOT NULL,
  `expiraEn` datetime(6) NOT NULL,
  `revocadoEn` datetime(6) DEFAULT NULL,
  `intentosFallidos` int NOT NULL DEFAULT '0',
  `accesos` int NOT NULL DEFAULT '0',
  `ultimoAccesoEn` datetime(6) DEFAULT NULL,
  `creadoEn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_021b25cf8a551a6dfe65cacad6` (`tokenHash`),
  KEY `FK_69b9816773880a2dfa461b431b7` (`entidadId`),
  KEY `FK_634041c2f225745da5c8af93c74` (`estudioId`),
  CONSTRAINT `FK_634041c2f225745da5c8af93c74` FOREIGN KEY (`estudioId`) REFERENCES `estudio` (`id`),
  CONSTRAINT `FK_69b9816773880a2dfa461b431b7` FOREIGN KEY (`entidadId`) REFERENCES `entidad` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `enlace_resultado`
--

LOCK TABLES `enlace_resultado` WRITE;
/*!40000 ALTER TABLE `enlace_resultado` DISABLE KEYS */;
/*!40000 ALTER TABLE `enlace_resultado` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `entidad`
--

DROP TABLE IF EXISTS `entidad`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `entidad` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `tipo` enum('CENTRO_DIAGNOSTICO','ORG_NO_LUCRATIVA','PLATAFORMA') NOT NULL,
  `departamento` varchar(255) DEFAULT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `activa` tinyint NOT NULL DEFAULT '1',
  `correo` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_97a38d7ff58dd57655c0815b7a` (`correo`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `entidad`
--

LOCK TABLES `entidad` WRITE;
/*!40000 ALTER TABLE `entidad` DISABLE KEYS */;
INSERT INTO `entidad` VALUES (2,'Centro Diagnóstico Vida','CENTRO_DIAGNOSTICO','Guatemala','22345678',1,'centro@demo.sisg'),(3,'Fundación Luz y Salud','ORG_NO_LUCRATIVA','Escuintla','22345678',1,'org@demo.sisg');
/*!40000 ALTER TABLE `entidad` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `estudio`
--

DROP TABLE IF EXISTS `estudio`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `estudio` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entidadId` int NOT NULL,
  `pacienteId` int NOT NULL,
  `tipoEstudio` varchar(255) NOT NULL,
  `salaEquipo` varchar(255) DEFAULT NULL,
  `fecha` date NOT NULL,
  `hora` time DEFAULT NULL,
  `especialista` varchar(255) DEFAULT NULL,
  `resultado` text,
  `estado` varchar(255) DEFAULT NULL,
  `monto` decimal(12,2) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_4a70c41ab51d73c1dfaa91c7433` (`entidadId`),
  KEY `FK_39de13112873d6f5b23031d271b` (`pacienteId`),
  CONSTRAINT `FK_39de13112873d6f5b23031d271b` FOREIGN KEY (`pacienteId`) REFERENCES `paciente` (`id`),
  CONSTRAINT `FK_4a70c41ab51d73c1dfaa91c7433` FOREIGN KEY (`entidadId`) REFERENCES `entidad` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=92 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `estudio`
--

LOCK TABLES `estudio` WRITE;
/*!40000 ALTER TABLE `estudio` DISABLE KEYS */;
INSERT INTO `estudio` VALUES (1,2,35,'Mamografía','Sala 1','2026-11-28','09:00:00','Dra. Méndez',NULL,'PROGRAMADO',NULL),(2,2,2,'Rayos X de tórax','Sala 3','2026-10-29','13:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',200.00),(3,2,16,'Ultrasonido abdominal','Sala 2','2026-11-09','13:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',300.00),(4,2,10,'Electrocardiograma','Sala 1','2026-07-24','13:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',180.00),(5,2,18,'Espirometría','Sala 2','2026-10-04','15:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',250.00),(6,2,12,'Electrocardiograma','Sala 3','2026-11-12','11:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',180.00),(7,2,13,'Rayos X de tórax','Sala 1','2026-06-26','13:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',200.00),(8,2,10,'Ultrasonido abdominal','Sala 1','2026-07-11','10:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',300.00),(9,2,8,'Rayos X de tórax','Sala 3','2026-07-30','08:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',200.00),(10,2,14,'Espirometría','Sala 1','2026-11-15','14:00:00','Dr. Ortiz',NULL,'PROGRAMADO',NULL),(11,2,6,'Mamografía','Sala 1','2026-10-09','11:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',450.00),(12,2,23,'Mamografía','Sala 2','2026-11-01','16:00:00','Dr. Ortiz',NULL,'CANCELADO',NULL),(13,2,39,'Espirometría','Sala 2','2026-09-17','11:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',250.00),(14,2,35,'Mamografía','Sala 2','2026-06-21','14:00:00','Dra. Solís',NULL,'REALIZADO',450.00),(15,2,11,'Electrocardiograma','Sala 1','2026-07-19','16:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',180.00),(16,2,23,'Rayos X de tórax','Sala 3','2026-06-28','15:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',200.00),(17,2,28,'Rayos X de tórax','Sala 2','2026-08-16','14:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',200.00),(18,2,6,'Ultrasonido abdominal','Sala 2','2026-05-30','12:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',NULL),(19,2,9,'Rayos X de tórax','Sala 3','2026-12-03','13:00:00','Dr. Ortiz',NULL,'PROGRAMADO',NULL),(20,2,38,'Espirometría','Sala 3','2026-10-12','08:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',250.00),(21,2,17,'Espirometría','Sala 2','2026-09-22','15:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',250.00),(22,2,6,'Electrocardiograma','Sala 3','2026-06-12','11:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',180.00),(23,2,25,'Rayos X de tórax','Sala 3','2026-07-18','13:00:00','Dra. Méndez',NULL,'CANCELADO',NULL),(24,2,40,'Espirometría','Sala 3','2026-09-27','15:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',250.00),(25,2,11,'Mamografía','Sala 1','2026-10-27','11:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',450.00),(26,2,10,'Rayos X de tórax','Sala 3','2026-08-04','15:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',200.00),(27,2,17,'Mamografía','Sala 2','2026-09-16','16:00:00','Dra. Solís',NULL,'REALIZADO',450.00),(28,2,13,'Espirometría','Sala 3','2026-11-18','14:00:00','Dra. Méndez',NULL,'PROGRAMADO',NULL),(29,2,33,'Electrocardiograma','Sala 1','2026-07-06','12:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',180.00),(30,2,19,'Papanicolaou','Sala 2','2026-08-14','13:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',150.00),(31,2,1,'Electrocardiograma','Sala 2','2026-08-07','11:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',180.00),(32,2,29,'Rayos X de tórax','Sala 3','2026-07-24','11:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',200.00),(33,2,1,'Mamografía','Sala 3','2026-06-29','11:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',450.00),(34,2,11,'Rayos X de tórax','Sala 1','2026-07-05','11:00:00','Dra. Méndez',NULL,'CANCELADO',NULL),(35,2,20,'Electrocardiograma','Sala 3','2026-06-03','15:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',NULL),(36,2,31,'Ultrasonido abdominal','Sala 3','2026-10-23','12:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',300.00),(37,2,15,'Espirometría','Sala 1','2026-12-03','08:00:00','Dr. Ortiz',NULL,'PROGRAMADO',NULL),(38,2,15,'Ultrasonido abdominal','Sala 3','2026-06-02','16:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',300.00),(39,2,25,'Espirometría','Sala 2','2026-09-24','10:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',250.00),(40,2,30,'Electrocardiograma','Sala 1','2026-10-30','14:00:00','Dra. Méndez',NULL,'REALIZADO',180.00),(41,2,6,'Papanicolaou','Sala 3','2026-06-19','08:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',150.00),(42,2,21,'Ultrasonido abdominal','Sala 2','2026-10-12','11:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',300.00),(43,2,17,'Papanicolaou','Sala 2','2026-06-02','15:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',150.00),(44,2,26,'Rayos X de tórax','Sala 3','2026-08-31','10:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',200.00),(45,2,37,'Rayos X de tórax','Sala 3','2026-09-24','15:00:00','Dr. Ortiz',NULL,'CANCELADO',NULL),(46,2,8,'Ultrasonido abdominal','Sala 1','2026-11-29','14:00:00','Dra. Méndez',NULL,'PROGRAMADO',NULL),(47,2,24,'Rayos X de tórax','Sala 1','2026-08-31','08:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',200.00),(48,2,16,'Rayos X de tórax','Sala 3','2026-07-16','09:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',200.00),(49,2,40,'Ultrasonido abdominal','Sala 1','2026-08-28','13:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',300.00),(50,2,36,'Rayos X de tórax','Sala 3','2026-09-07','14:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',200.00),(51,2,37,'Electrocardiograma','Sala 2','2026-07-18','12:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',180.00),(52,2,7,'Papanicolaou','Sala 3','2026-07-02','09:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',NULL),(53,2,32,'Espirometría','Sala 3','2026-06-21','08:00:00','Dra. Méndez',NULL,'REALIZADO',250.00),(54,2,37,'Espirometría','Sala 2','2026-10-08','11:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',250.00),(55,2,33,'Ultrasonido abdominal','Sala 2','2026-11-19','10:00:00','Dr. Ortiz',NULL,'PROGRAMADO',NULL),(56,2,39,'Papanicolaou','Sala 2','2026-07-01','11:00:00','Dra. Solís',NULL,'CANCELADO',NULL),(57,2,1,'Electrocardiograma','Sala 2','2026-10-10','12:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',180.00),(58,2,14,'Ultrasonido abdominal','Sala 2','2026-07-20','08:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',300.00),(59,2,8,'Mamografía','Sala 1','2026-07-04','10:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',450.00),(60,2,31,'Ultrasonido abdominal','Sala 2','2026-07-15','11:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',300.00),(61,2,23,'Espirometría','Sala 2','2026-07-26','11:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',250.00),(62,2,10,'Papanicolaou','Sala 2','2026-10-16','16:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',150.00),(63,2,33,'Mamografía','Sala 3','2026-10-15','08:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',450.00),(64,2,11,'Ultrasonido abdominal','Sala 1','2026-11-21','13:00:00','Dra. Solís',NULL,'PROGRAMADO',NULL),(65,2,8,'Papanicolaou','Sala 1','2026-08-28','11:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',150.00),(66,2,8,'Papanicolaou','Sala 3','2026-10-09','15:00:00','Dr. Ortiz',NULL,'REALIZADO',150.00),(67,2,28,'Rayos X de tórax','Sala 1','2026-06-21','12:00:00','Dra. Méndez',NULL,'CANCELADO',NULL),(68,2,34,'Papanicolaou','Sala 1','2026-09-20','14:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',150.00),(69,2,37,'Espirometría','Sala 1','2026-09-06','13:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',NULL),(70,2,23,'Espirometría','Sala 2','2026-07-16','13:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',250.00),(71,2,12,'Espirometría','Sala 2','2026-09-16','14:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',250.00),(72,2,14,'Espirometría','Sala 2','2026-10-16','15:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',250.00),(73,2,9,'Electrocardiograma','Sala 1','2026-11-28','13:00:00','Dra. Méndez',NULL,'PROGRAMADO',NULL),(74,2,33,'Ultrasonido abdominal','Sala 2','2026-08-20','13:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',300.00),(75,2,36,'Mamografía','Sala 3','2026-08-03','14:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',450.00),(76,2,3,'Ultrasonido abdominal','Sala 1','2026-10-02','14:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',300.00),(77,2,32,'Electrocardiograma','Sala 3','2026-07-03','08:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',180.00),(78,2,21,'Mamografía','Sala 3','2026-06-05','08:00:00','Dra. Solís',NULL,'CANCELADO',NULL),(79,2,35,'Ultrasonido abdominal','Sala 1','2026-08-23','11:00:00','Dra. Méndez',NULL,'REALIZADO',300.00),(80,2,25,'Rayos X de tórax','Sala 2','2026-07-24','13:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',200.00),(81,2,18,'Papanicolaou','Sala 2','2026-08-19','14:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',150.00),(82,2,39,'Rayos X de tórax','Sala 1','2026-11-21','14:00:00','Dra. Solís',NULL,'PROGRAMADO',NULL),(83,2,2,'Electrocardiograma','Sala 2','2026-06-22','11:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',180.00),(84,2,9,'Papanicolaou','Sala 2','2026-07-30','13:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',150.00),(85,2,28,'Mamografía','Sala 1','2026-06-01','14:00:00','Dra. Méndez','Sin hallazgos de importancia','REALIZADO',450.00),(86,2,35,'Rayos X de tórax','Sala 2','2026-11-13','10:00:00','Dr. Ortiz','Sin hallazgos de importancia','REALIZADO',NULL),(87,2,3,'Rayos X de tórax','Sala 2','2026-09-13','14:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',200.00),(88,2,39,'Mamografía','Sala 2','2026-10-29','10:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',450.00),(89,2,28,'Rayos X de tórax','Sala 1','2026-07-08','09:00:00','Dra. Solís',NULL,'CANCELADO',NULL),(90,2,6,'Espirometría','Sala 1','2026-07-12','10:00:00','Dra. Solís','Sin hallazgos de importancia','REALIZADO',250.00),(91,2,1,'Ultrasonido abdominal',NULL,'2026-11-02',NULL,NULL,NULL,'PROGRAMADO',NULL);
/*!40000 ALTER TABLE `estudio` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `paciente`
--

DROP TABLE IF EXISTS `paciente`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `paciente` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entidadId` int NOT NULL,
  `nombreCompleto` varchar(255) NOT NULL,
  `dpi` varchar(255) DEFAULT NULL,
  `fechaNacimiento` date DEFAULT NULL,
  `sexo` enum('F','M','NE') NOT NULL,
  `departamento` varchar(255) DEFAULT NULL,
  `municipio` varchar(255) DEFAULT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `contactoEmergencia` varchar(255) DEFAULT NULL,
  `estado` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `FK_046297d58ed134dc1db254a56b8` (`entidadId`),
  CONSTRAINT `FK_046297d58ed134dc1db254a56b8` FOREIGN KEY (`entidadId`) REFERENCES `entidad` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=66 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `paciente`
--

LOCK TABLES `paciente` WRITE;
/*!40000 ALTER TABLE `paciente` DISABLE KEYS */;
INSERT INTO `paciente` VALUES (1,2,'Carlos Cruz Ramírez','2000000200000','1959-02-01','F','Guatemala','Mixco','52511053',NULL,'ACTIVO'),(2,2,'Juan Hernández Barrios','2000000200001','1974-10-05','F','Guatemala','Mixco','58722115',NULL,'ACTIVO'),(3,2,'Rosa Castillo Ramírez','2000000200002','1975-06-10','F','Escuintla','Escuintla','56451846',NULL,'ACTIVO'),(4,2,'José Castillo Castillo','2000000200003','2002-02-22','F','Escuintla','Escuintla','51176208',NULL,'ACTIVO'),(5,2,'Luis García Morales','2000000200004','1987-03-17','F','Sacatepéquez','Antigua Guatemala','57943940',NULL,'ACTIVO'),(6,2,'Rosa Ramírez García','2000000200005','2003-01-19','F','Alta Verapaz','Cobán','56022181',NULL,'ACTIVO'),(7,2,'Carlos Castillo López','2000000200006','1983-02-09','F','Escuintla','Escuintla','55649048',NULL,'ACTIVO'),(8,2,'Elena López Pérez','2000000200007','1951-07-08','F','Guatemala','Guatemala','54605737',NULL,'ACTIVO'),(9,2,'María Hernández Castillo','2000000200008','1969-01-17','F','Guatemala','Guatemala','56650759',NULL,'ACTIVO'),(10,2,'Carmen Barrios Castillo','2000000200009','1962-05-10','F','Quetzaltenango','Quetzaltenango','55458256',NULL,'ACTIVO'),(11,2,'Carmen García Morales','2000000200010','1976-04-27','F','Alta Verapaz','Cobán','52997630',NULL,'ACTIVO'),(12,2,'José Mejía Morales','2000000200011','1974-05-11','M','Quetzaltenango','Quetzaltenango','52876834',NULL,'ACTIVO'),(13,2,'Carmen García Pérez','2000000200012','1959-04-18','F','Sacatepéquez','Antigua Guatemala','53203375',NULL,'ACTIVO'),(14,2,'Pedro Hernández López','2000000200013','1982-07-27','F','Guatemala','Guatemala','52347419',NULL,'ACTIVO'),(15,2,'Carmen Ramírez López','2000000200014','1987-04-28','F','Alta Verapaz','Cobán','52748242',NULL,'ACTIVO'),(16,2,'Ana Castillo Barrios','2000000200015','1997-11-16','M','Guatemala','Mixco','58587760',NULL,'ACTIVO'),(17,2,'Ana López Pérez','2000000200016','1953-02-12','F','Quetzaltenango','Quetzaltenango','55543875',NULL,'ACTIVO'),(18,2,'Rosa Morales Morales','2000000200017','1962-04-24','M','Escuintla','Escuintla','59455680',NULL,'ACTIVO'),(19,2,'Carlos Cruz Cruz','2000000200018','1971-09-09','M','Sacatepéquez','Antigua Guatemala','52076801',NULL,'ACTIVO'),(20,2,'María Barrios Mejía','2000000200019','1966-08-22','M','Guatemala','Guatemala','56903732',NULL,'ACTIVO'),(21,2,'Juan Barrios García','2000000200020','1996-09-25','F','Alta Verapaz','Cobán','52500893',NULL,'ACTIVO'),(22,2,'Miguel Ramírez Castillo','2000000200021','1970-05-26','F','Quetzaltenango','Quetzaltenango','54637591',NULL,'ACTIVO'),(23,2,'María López Castillo','2000000200022','1969-03-10','F','Guatemala','Guatemala','58340177',NULL,'ACTIVO'),(24,2,'Miguel Ramírez Morales','2000000200023','1997-03-24','M','Escuintla','Escuintla','53393244',NULL,'ACTIVO'),(25,2,'Carmen Pérez Ramírez','2000000200024','1983-12-05','F','Guatemala','Mixco','52505018',NULL,'ACTIVO'),(26,2,'José Barrios Ramírez','2000000200025','1985-11-23','M','Quetzaltenango','Quetzaltenango','55433120',NULL,'ACTIVO'),(27,2,'Pedro Pérez Hernández','2000000200026','1972-03-23','F','Escuintla','Escuintla','51667109',NULL,'ACTIVO'),(28,2,'Carlos Castillo López','2000000200027','1959-12-18','F','Guatemala','Mixco','55213467',NULL,'ACTIVO'),(29,2,'Ana Morales Barrios','2000000200028','1968-02-07','M','Guatemala','Mixco','56833574',NULL,'ACTIVO'),(30,2,'Miguel López Mejía','2000000200029','1973-04-14','F','Escuintla','Escuintla','52973693',NULL,'ACTIVO'),(31,2,'Pedro Cruz Ramírez','2000000200030','1975-09-10','F','Sacatepéquez','Antigua Guatemala','54611784',NULL,'ACTIVO'),(32,2,'Pedro Hernández García','2000000200031','1997-02-17','F','Alta Verapaz','Cobán','58082348',NULL,'ACTIVO'),(33,2,'Juan Mejía Cruz','2000000200032','1964-07-07','F','Quetzaltenango','Quetzaltenango','58781891',NULL,'ACTIVO'),(34,2,'Miguel Castillo Morales','2000000200033','1978-07-11','F','Quetzaltenango','Quetzaltenango','57688564',NULL,'ACTIVO'),(35,2,'María Hernández Cruz','2000000200034','1950-07-19','F','Guatemala','Mixco','54705025',NULL,'ACTIVO'),(36,2,'Rosa López Ramírez','2000000200035','1971-11-19','F','Escuintla','Escuintla','56376893',NULL,'ACTIVO'),(37,2,'María Castillo García','2000000200036','1956-12-21','F','Quetzaltenango','Quetzaltenango','53025024',NULL,'ACTIVO'),(38,2,'Pedro Cruz García','2000000200037','2000-12-07','F','Guatemala','Mixco','51519697',NULL,'ACTIVO'),(39,2,'Carlos Hernández Hernández','2000000200038','1969-05-20','F','Guatemala','Guatemala','59476997',NULL,'ACTIVO'),(40,2,'Pedro Pérez Cruz','2000000200039','1959-12-06','F','Quetzaltenango','Quetzaltenango','54596321',NULL,'ACTIVO'),(41,3,'José Cruz Mejía','2000000300000','1966-02-10','F','Guatemala','Guatemala','52321317',NULL,'ACTIVO'),(42,3,'Juan Barrios Barrios','2000000300001','1959-12-28','F','Guatemala','Guatemala','54302291',NULL,'ACTIVO'),(43,3,'Luis Cruz Barrios','2000000300002','1979-03-10','F','Escuintla','Escuintla','53332521',NULL,'ACTIVO'),(44,3,'Carlos Barrios Mejía','2000000300003','1979-04-10','F','Escuintla','Escuintla','57456679',NULL,'ACTIVO'),(45,3,'Luisa Castillo López','2000000300004','2004-09-10','F','Quetzaltenango','Quetzaltenango','52999952',NULL,'ACTIVO'),(46,3,'Rosa López Hernández','2000000300005','1968-08-05','F','Escuintla','Escuintla','58465755',NULL,'ACTIVO'),(47,3,'María López Ramírez','2000000300006','1996-11-01','F','Sacatepéquez','Antigua Guatemala','58233549',NULL,'ACTIVO'),(48,3,'Rosa Ramírez Castillo','2000000300007','1983-12-14','F','Alta Verapaz','Cobán','58576059',NULL,'ACTIVO'),(49,3,'José Pérez Mejía','2000000300008','1969-04-17','F','Sacatepéquez','Antigua Guatemala','56288364',NULL,'ACTIVO'),(50,3,'Elena Morales Pérez','2000000300009','1960-05-28','F','Guatemala','Mixco','58364274',NULL,'ACTIVO'),(51,3,'Carlos Mejía Morales','2000000300010','1993-09-10','F','Alta Verapaz','Cobán','57929221',NULL,'ACTIVO'),(52,3,'Pedro Morales Cruz','2000000300011','1968-03-07','M','Sacatepéquez','Antigua Guatemala','53611912',NULL,'ACTIVO'),(53,3,'José Barrios Ramírez','2000000300012','1970-12-25','F','Escuintla','Escuintla','51604681',NULL,'ACTIVO'),(54,3,'Miguel Morales Barrios','2000000300013','1997-05-03','M','Sacatepéquez','Antigua Guatemala','53866934',NULL,'ACTIVO'),(55,3,'Rosa Mejía Cruz','2000000300014','1967-11-15','F','Quetzaltenango','Quetzaltenango','59530536',NULL,'ACTIVO'),(56,3,'Luisa Mejía Morales','2000000300015','1955-03-26','F','Guatemala','Guatemala','57470496',NULL,'ACTIVO'),(57,3,'José Morales Cruz','2000000300016','1964-09-08','F','Guatemala','Guatemala','51194454',NULL,'ACTIVO'),(58,3,'Ana Pérez López','2000000300017','1984-06-25','M','Alta Verapaz','Cobán','55823380',NULL,'ACTIVO'),(59,3,'María Cruz López','2000000300018','1984-10-09','M','Quetzaltenango','Quetzaltenango','51295279',NULL,'ACTIVO'),(60,3,'Elena Ramírez García','2000000300019','1950-10-25','M','Guatemala','Guatemala','55497516',NULL,'ACTIVO'),(61,3,'Ana Castillo Morales','2000000300020','1965-08-04','M','Guatemala','Mixco','53994069',NULL,'ACTIVO'),(62,3,'Pedro Barrios Castillo','2000000300021','1999-05-23','F','Alta Verapaz','Cobán','57821853',NULL,'ACTIVO'),(63,3,'Carmen Cruz Morales','2000000300022','1966-06-07','F','Escuintla','Escuintla','53808719',NULL,'ACTIVO'),(64,3,'Elena García López','2000000300023','1982-03-10','F','Quetzaltenango','Quetzaltenango','59526689',NULL,'ACTIVO'),(65,3,'José Castillo Hernández','2000000300024','1996-01-07','F','Sacatepéquez','Antigua Guatemala','52631648',NULL,'ACTIVO');
/*!40000 ALTER TABLE `paciente` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `referido`
--

DROP TABLE IF EXISTS `referido`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `referido` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entidadOrigenId` int NOT NULL,
  `entidadDestinoId` int NOT NULL,
  `campanaId` int DEFAULT NULL,
  `nombreCompleto` varchar(255) NOT NULL,
  `sexo` enum('F','M','NE') NOT NULL,
  `dpi` varchar(255) DEFAULT NULL,
  `fechaNacimiento` date DEFAULT NULL,
  `telefono` varchar(255) DEFAULT NULL,
  `tipoEstudio` varchar(255) NOT NULL,
  `motivo` text,
  `estado` varchar(255) NOT NULL DEFAULT 'PENDIENTE',
  `codigo` varchar(255) NOT NULL,
  `consentimientoEn` datetime(6) NOT NULL,
  `estudioId` int DEFAULT NULL,
  `fechaCita` date DEFAULT NULL,
  `creadoEn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `atendidoEn` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_6f9ec82293a2578357bb950e91` (`codigo`),
  KEY `IDX_a93c9d0eac630be307489e6a85` (`entidadDestinoId`,`id`),
  KEY `IDX_89a51dc3bba26d5901a9eb9db6` (`entidadOrigenId`,`id`),
  KEY `FK_5d73945a9f61c780ebd68ca7fa6` (`campanaId`),
  KEY `FK_f9b8fc130cbc59dd05c8faf7f4f` (`estudioId`),
  CONSTRAINT `FK_5d73945a9f61c780ebd68ca7fa6` FOREIGN KEY (`campanaId`) REFERENCES `campana` (`id`),
  CONSTRAINT `FK_912bbbe847cc1c7a99d67a07e90` FOREIGN KEY (`entidadOrigenId`) REFERENCES `entidad` (`id`),
  CONSTRAINT `FK_b56271dd641d7ca9a7768bc7f36` FOREIGN KEY (`entidadDestinoId`) REFERENCES `entidad` (`id`),
  CONSTRAINT `FK_f9b8fc130cbc59dd05c8faf7f4f` FOREIGN KEY (`estudioId`) REFERENCES `estudio` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=19 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `referido`
--

LOCK TABLES `referido` WRITE;
/*!40000 ALTER TABLE `referido` DISABLE KEYS */;
INSERT INTO `referido` VALUES (1,3,2,3,'Pedro Ramírez Morales','F',NULL,NULL,'54505218','Ultrasonido abdominal','Hallazgo en jornada comunitaria','PENDIENTE','DEMO0000','2026-10-15 02:21:59.311000',NULL,NULL,'2026-11-14 02:21:59.310561',NULL),(2,3,2,4,'Luisa Castillo García','F',NULL,NULL,'57114481','Ultrasonido abdominal','Hallazgo en jornada comunitaria','AGENDADO','DEMO0001','2026-10-16 02:21:59.312000',NULL,'2026-11-18','2026-11-14 02:21:59.312226',NULL),(3,3,2,2,'Miguel Morales Mejía','F',NULL,NULL,'55592850','Mamografía','Hallazgo en jornada comunitaria','ATENDIDO','DEMO0002','2026-10-17 02:21:59.313000',NULL,NULL,'2026-11-14 02:21:59.313033',NULL),(4,3,2,3,'José Pérez López','F',NULL,NULL,'59068994','Papanicolaou','Hallazgo en jornada comunitaria','ATENDIDO','DEMO0003','2026-10-18 02:21:59.314000',NULL,NULL,'2026-11-14 02:21:59.314012',NULL),(5,3,2,4,'Elena García Hernández','F',NULL,NULL,'54528098','Mamografía','Hallazgo en jornada comunitaria','ATENDIDO','DEMO0004','2026-10-19 02:21:59.315000',NULL,NULL,'2026-11-14 02:21:59.314889',NULL),(6,3,2,1,'María Pérez García','F',NULL,NULL,'57627072','Espirometría','Hallazgo en jornada comunitaria','NO_LLEGO','DEMO0005','2026-10-20 02:21:59.316000',NULL,NULL,'2026-11-14 02:21:59.315707',NULL),(7,3,2,5,'Miguel Mejía Morales','F',NULL,NULL,'53159632','Ultrasonido abdominal','Hallazgo en jornada comunitaria','PENDIENTE','DEMO0006','2026-10-21 02:21:59.317000',NULL,NULL,'2026-11-14 02:21:59.316579',NULL),(8,3,2,4,'Carlos Cruz Cruz','F',NULL,NULL,'55719858','Rayos X de tórax','Hallazgo en jornada comunitaria','AGENDADO','DEMO0007','2026-10-22 02:21:59.318000',NULL,'2026-11-24','2026-11-14 02:21:59.317409',NULL),(9,3,2,1,'Miguel Pérez Mejía','F',NULL,NULL,'58437064','Ultrasonido abdominal','Hallazgo en jornada comunitaria','ATENDIDO','DEMO0008','2026-10-23 02:21:59.319000',NULL,NULL,'2026-11-14 02:21:59.318790',NULL),(10,3,2,4,'Carmen Cruz Pérez','F',NULL,NULL,'52344445','Espirometría','Hallazgo en jornada comunitaria','ATENDIDO','DEMO0009','2026-10-24 02:21:59.320000',NULL,NULL,'2026-11-14 02:21:59.319876',NULL),(11,3,2,4,'María Cruz Mejía','F',NULL,NULL,'53682203','Espirometría','Hallazgo en jornada comunitaria','ATENDIDO','DEMO0010','2026-10-25 02:21:59.321000',NULL,NULL,'2026-11-14 02:21:59.320823',NULL),(12,3,2,5,'Luis Morales Hernández','F',NULL,NULL,'54643260','Mamografía','Hallazgo en jornada comunitaria','NO_LLEGO','DEMO0011','2026-10-26 02:21:59.322000',NULL,NULL,'2026-11-14 02:21:59.321678',NULL),(13,3,2,4,'Elena Hernández Mejía','F',NULL,NULL,'52045398','Ultrasonido abdominal','Hallazgo en jornada comunitaria','PENDIENTE','DEMO0012','2026-10-27 02:21:59.323000',NULL,NULL,'2026-11-14 02:21:59.322655',NULL),(14,3,2,2,'Pedro Ramírez Morales','F',NULL,NULL,'58495596','Rayos X de tórax','Hallazgo en jornada comunitaria','AGENDADO','DEMO0013','2026-10-28 02:21:59.324000',NULL,'2026-11-30','2026-11-14 02:21:59.323499',NULL),(15,3,2,5,'Pedro Hernández García','F',NULL,NULL,'56967072','Papanicolaou','Hallazgo en jornada comunitaria','ATENDIDO','DEMO0014','2026-10-29 02:21:59.325000',NULL,NULL,'2026-11-14 02:21:59.324362',NULL),(16,3,2,2,'Pedro Mejía Pérez','F',NULL,NULL,'51821757','Espirometría','Hallazgo en jornada comunitaria','ATENDIDO','DEMO0015','2026-10-30 02:21:59.325000',NULL,NULL,'2026-11-14 02:21:59.325105',NULL),(17,3,2,3,'Luisa Castillo García','F',NULL,NULL,'55652709','Mamografía','Hallazgo en jornada comunitaria','ATENDIDO','DEMO0016','2026-10-31 02:21:59.326000',NULL,NULL,'2026-11-14 02:21:59.326085',NULL),(18,3,2,4,'Rosa Pérez Morales','F',NULL,NULL,'59833222','Mamografía','Hallazgo en jornada comunitaria','NO_LLEGO','DEMO0017','2026-11-01 02:21:59.327000',NULL,NULL,'2026-11-14 02:21:59.326987',NULL);
/*!40000 ALTER TABLE `referido` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `usuario`
--

DROP TABLE IF EXISTS `usuario`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `usuario` (
  `id` int NOT NULL AUTO_INCREMENT,
  `entidadId` int NOT NULL,
  `nombre` varchar(255) NOT NULL,
  `correo` varchar(255) NOT NULL,
  `rol` enum('SUPERADMIN','ADMIN','OPERADOR','AUDITOR') NOT NULL DEFAULT 'OPERADOR',
  `activo` tinyint NOT NULL DEFAULT '1',
  `creadoEn` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  `ultimoAcceso` datetime(6) DEFAULT NULL,
  `mfaActivo` tinyint NOT NULL DEFAULT '0',
  `passwordHash` varchar(255) NOT NULL,
  `mfaSecreto` text,
  `mfaUltimoPaso` int DEFAULT NULL,
  `mfaRecuperacion` json DEFAULT NULL,
  `intentosFallidos` int NOT NULL DEFAULT '0',
  `bloqueadoHasta` datetime(6) DEFAULT NULL,
  `sesionesDesde` datetime(6) DEFAULT NULL,
  `invitacionHash` varchar(255) DEFAULT NULL,
  `invitacionVence` datetime(6) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `IDX_349ecb64acc4355db443ca17cb` (`correo`),
  KEY `IDX_e13adaf550c80e902a1fff4209` (`entidadId`),
  CONSTRAINT `FK_e13adaf550c80e902a1fff4209a` FOREIGN KEY (`entidadId`) REFERENCES `entidad` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=8 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `usuario`
--

LOCK TABLES `usuario` WRITE;
/*!40000 ALTER TABLE `usuario` DISABLE KEYS */;
INSERT INTO `usuario` VALUES (2,2,'Administrador centro','centro@demo.sisg','ADMIN',1,'2026-11-14 02:21:59.159204','2026-11-14 02:23:54.967000',1,'$2b$10$ML1q3Ebp78mGyXDUh3tJsuC6jdw0DI8DRb/Yt854WBUIbk7dSkcOi','v5LzAA0MLWqog7EO.2hDfAThVD/CeBa0Op8d/Mw==.p4Fg589fAhCvrWleEIhOeg==',59820767,'[\"b61bb279a4d1441687df45b23c6dffcf58043533a275e0d18cbf7d7aee227b27\", \"8e73b1e59aeb5680b1d138bd8f398b709bf0cf881c2eb8c0ec956e709512d6ae\", \"0fed2367aa85f0accef642eeed86f1525df4f3e5c0a134780ecbbaffde7c968e\", \"ed6ec59d60c351e500262277ae3279d6c582c71329823bab2439249716d7c25c\", \"36e5f5ddf35514b311c8b75191ffa99a57937a5719bce9c867d562d57d13ca9b\", \"5642daf2db67c1aca6adc22dc94ed23ef305caceceb480f2a3eea446a421bea0\", \"59a7fc44ab75e6501df7a70cea0bc989d6190afc6ef77f1da1c86d4308ae094a\", \"bfb49982454fae5e5754b7d4d7b7a066a10726b8898efc59c6fe1a60cbbd317e\"]',0,NULL,'2026-11-14 02:24:05.706000',NULL,NULL),(3,2,'Operador centro','operador.centro@demo.sisg','OPERADOR',1,'2026-11-14 02:21:59.162614',NULL,0,'$2b$10$ML1q3Ebp78mGyXDUh3tJsuC6jdw0DI8DRb/Yt854WBUIbk7dSkcOi',NULL,NULL,NULL,0,NULL,NULL,NULL,NULL),(4,2,'Auditor centro','auditor.centro@demo.sisg','AUDITOR',1,'2026-11-14 02:21:59.164402',NULL,0,'$2b$10$ML1q3Ebp78mGyXDUh3tJsuC6jdw0DI8DRb/Yt854WBUIbk7dSkcOi',NULL,NULL,NULL,0,NULL,NULL,NULL,NULL),(5,3,'Administrador org','org@demo.sisg','ADMIN',1,'2026-11-14 02:21:59.165616','2026-11-14 02:24:36.320000',1,'$2b$10$ML1q3Ebp78mGyXDUh3tJsuC6jdw0DI8DRb/Yt854WBUIbk7dSkcOi','Uo1eMUDqncoBtY7D.vQe6MSxcPtR5xmyyey506w==.2sAeP6xav+msMww1dn/oWA==',59820769,'[\"445ba9e19d2d247caa580537973c4111896fc60092612c21f5097aa75b12009a\", \"19f1e2d74196fdb7f0cf763289766c283c992a235b75bc46e3c4089878c2356e\", \"090f7693ad9ecbf7ca5723451a66f869bae682301668a5c7dbdb67cca986af85\", \"bb3b700273de744175a0d29130f71b095f85cf5626fe8c5e836df2e42afdac71\", \"4a6cdeec326a938670052f33aaf313b85add38a5ec8d90a754ad4d23fe5caec6\", \"6de27bd7eb1bb0a458eac854788e44b631983055a36a9deb6b7e1ab1622f4ed1\", \"aeeb0911a7339bd697ed4496afba73410d2269da23e4e913084ce587bae02f30\", \"e84d3006bee24e9c269f38c7670e878ef96cf9f92f91356a5e0120b011c2228b\"]',0,NULL,NULL,NULL,NULL),(6,3,'Operador org','operador.org@demo.sisg','OPERADOR',1,'2026-11-14 02:21:59.166463',NULL,0,'$2b$10$ML1q3Ebp78mGyXDUh3tJsuC6jdw0DI8DRb/Yt854WBUIbk7dSkcOi',NULL,NULL,NULL,0,NULL,NULL,NULL,NULL),(7,3,'Auditor org','auditor.org@demo.sisg','AUDITOR',1,'2026-11-14 02:21:59.167296',NULL,0,'$2b$10$ML1q3Ebp78mGyXDUh3tJsuC6jdw0DI8DRb/Yt854WBUIbk7dSkcOi',NULL,NULL,NULL,0,NULL,NULL,NULL,NULL);
/*!40000 ALTER TABLE `usuario` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-11-14  3:03:32
