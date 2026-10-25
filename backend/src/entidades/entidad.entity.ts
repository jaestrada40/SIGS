import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { TipoEntidad } from '../common/enums';

@Entity('entidad')
export class Entidad {
  @PrimaryGeneratedColumn() id: number;
  @Column() nombre: string;
  @Column({ type: 'enum', enum: TipoEntidad }) tipo: TipoEntidad;
  @Column({ nullable: true }) departamento: string;
  @Column({ nullable: true }) telefono: string;
  @Column({ default: true }) activa: boolean;   // false = suspendida por la plataforma: nadie de la entidad puede entrar
  @Column({ unique: true }) correo: string;   // contacto de la entidad (el del primer administrador)
}
