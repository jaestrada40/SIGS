import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Rol } from '../common/enums';

// Persona que inicia sesión. Varias por entidad; ADMIN gestiona, OPERADOR registra datos, AUDITOR solo lee y ve la auditoría.
@Entity('usuario')
export class Usuario {
  @PrimaryGeneratedColumn() id: number;
  @Index() @Column() entidadId: number;
  @Column() nombre: string;
  @Column({ unique: true }) correo: string;
  @Column({ type: 'enum', enum: Rol, default: Rol.OPERADOR }) rol: Rol;
  @Column({ default: true }) activo: boolean;
  @CreateDateColumn() creadoEn: Date;
  @Column({ type: 'timestamptz', nullable: true }) ultimoAcceso: Date | null;
  @Column({ default: false }) mfaActivo: boolean;

  // --- Seguridad (select:false: nunca salen en consultas normales ni en respuestas) ---
  @Column({ select: false }) passwordHash: string;
  @Column({ type: 'text', nullable: true, select: false }) mfaSecreto: string | null;          // cifrado con AES-256-GCM
  @Column({ type: 'int', nullable: true, select: false }) mfaUltimoPaso: number | null;        // evita reutilizar un código TOTP
  @Column({ type: 'jsonb', nullable: true, select: false }) mfaRecuperacion: string[] | null;  // solo hashes SHA-256
  @Column({ type: 'int', default: 0, select: false }) intentosFallidos: number;
  @Column({ type: 'timestamptz', nullable: true, select: false }) bloqueadoHasta: Date | null;
  @Column({ type: 'timestamptz', nullable: true, select: false }) sesionesDesde: Date | null;   // tokens anteriores a esta fecha quedan revocados
}
