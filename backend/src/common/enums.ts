// PLATAFORMA es la entidad interna del superadmin (sin pacientes): no se elige al dar de alta una entidad.
export enum TipoEntidad { CENTRO_DIAGNOSTICO = 'CENTRO_DIAGNOSTICO', ORG_NO_LUCRATIVA = 'ORG_NO_LUCRATIVA', PLATAFORMA = 'PLATAFORMA' }
export enum Sexo { F = 'F', M = 'M', NE = 'NE' }
export enum Area { CARDIOVASCULAR = 'CARDIOVASCULAR', RESPIRATORIA = 'RESPIRATORIA', PLANIFICACION = 'PLANIFICACION', ONCOLOGICO_OTRO = 'ONCOLOGICO_OTRO' }
export enum EstadoCampana { PROGRAMADA = 'PROGRAMADA', EN_CURSO = 'EN_CURSO', FINALIZADA = 'FINALIZADA' }
export enum Rol { SUPERADMIN = 'SUPERADMIN', ADMIN = 'ADMIN', OPERADOR = 'OPERADOR', AUDITOR = 'AUDITOR' }
