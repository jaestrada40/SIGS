import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Sexo } from '../common/enums';

export const ESTADOS_REFERIDO = ['PENDIENTE', 'AGENDADO', 'ATENDIDO', 'NO_LLEGO', 'CANCELADO'] as const;
export type EstadoReferido = (typeof ESTADOS_REFERIDO)[number];

// Una persona que un organismo no lucrativo envía a un centro de diagnóstico (por ejemplo, tras un tamizaje en una campaña).
// Privacidad: el centro NO accede a la tabla de pacientes del organismo; recibe solo esta copia mínima, y solo con el consentimiento de la persona.
// El organismo, por su parte, ve el estado del referido, nunca el resultado clínico (que vive solo en el estudio del centro).
@Entity('referido')
@Index(['entidadOrigenId', 'id'])
@Index(['entidadDestinoId', 'id'])
export class Referido {
  @PrimaryGeneratedColumn() id: number;
  @Column() entidadOrigenId: number;
  @Column() entidadDestinoId: number;
  @Column({ type: 'int', nullable: true }) campanaId: number | null;

  // --- copia mínima de la persona, consentida ---
  @Column() nombreCompleto: string;
  @Column({ type: 'enum', enum: Sexo }) sexo: Sexo;
  @Column({ type: 'varchar', nullable: true }) dpi: string | null;
  @Column({ type: 'date', nullable: true }) fechaNacimiento: string | null;
  @Column({ type: 'varchar', nullable: true }) telefono: string | null;

  @Column() tipoEstudio: string;
  @Column({ type: 'text', nullable: true }) motivo: string | null;
  @Column({ type: 'varchar', default: 'PENDIENTE' }) estado: EstadoReferido;
  @Column({ unique: true }) codigo: string;                       // para que la persona lo muestre en el centro
  @Column({ type: 'timestamptz' }) consentimientoEn: Date;
  @Column({ type: 'int', nullable: true }) estudioId: number | null;   // estudio que creó el centro al agendar
  @Column({ type: 'date', nullable: true }) fechaCita: string | null;
  @CreateDateColumn() creadoEn: Date;
  @Column({ type: 'timestamptz', nullable: true }) atendidoEn: Date | null;
}
