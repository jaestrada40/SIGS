import { BadRequestException, Body, Controller, NotFoundException, Post, UseGuards } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { plainToInstance } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsInt, validate } from 'class-validator';
import { Column, CreateDateColumn, DataSource, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';
import { Entidad, SoloTipo, TipoGuard } from '../common/auth';
import { Bitacora, registrar } from '../common/bitacora';
import { TipoEntidad } from '../common/enums';
import { Campana } from '../campanas/campanas';
import { CreatePacienteDto, Paciente } from '../pacientes/pacientes';

// Registro de personas atendidas en una jornada, pensado para el modo sin conexión: la app guarda cada atención con una clave
// que genera el dispositivo y la envía cuando hay señal. La clave hace la sincronización idempotente (reenviar no duplica).
// Una persona cuenta una sola vez por campaña. Solo organismos: los centros no tienen jornadas.
const MAX_ITEMS = 100;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Entity('atencion')
@Index(['entidadId', 'claveCliente'], { unique: true })
@Index(['campanaId', 'pacienteId'], { unique: true })
export class Atencion {
  @PrimaryGeneratedColumn() id: number;
  @Column() entidadId: number;
  @Column() campanaId: number;
  @Column() pacienteId: number;
  @Column() claveCliente: string;
  @Column({ type: 'timestamptz' }) atendidoEn: Date;
  @CreateDateColumn({ type: 'timestamptz' }) creadoEn: Date;
}

class SincronizarDto {
  @IsInt() campanaId: number;
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(MAX_ITEMS) items: unknown[];
}
type Resultado = { claveCliente: string; estado: 'ok' | 'duplicado' | 'repetido' | 'error'; mensaje?: string };

@UseGuards(TipoGuard)
@SoloTipo(TipoEntidad.ORG_NO_LUCRATIVA)
@Controller('jornada')
export class JornadaController {
  constructor(@InjectDataSource() private db: DataSource) {}

  @Post('sincronizar') async sincronizar(@Entidad() u, @Body() dto: SincronizarDto): Promise<{ resultados: Resultado[] }> {
    if (!(await this.db.getRepository(Campana).existsBy({ id: dto.campanaId, entidadId: u.entidadId }))) throw new NotFoundException('campaña');
    const resultados: Resultado[] = [];
    for (const crudo of dto.items) resultados.push(await this.uno(u, dto.campanaId, crudo));
    return { resultados };
  }

  private async uno(u, campanaId: number, crudo: any): Promise<Resultado> {
    const clave = typeof crudo?.claveCliente === 'string' ? crudo.claveCliente : '';
    if (!UUID.test(clave)) return { claveCliente: clave.slice(0, 40), estado: 'error', mensaje: 'Clave de registro inválida.' };
    const paciente = plainToInstance(CreatePacienteDto, crudo.paciente ?? {});
    const errores = await validate(paciente, { whitelist: true });
    if (errores.length) return { claveCliente: clave, estado: 'error', mensaje: errores.flatMap((e) => Object.values(e.constraints ?? {})).join('. ') };
    const cuando = new Date(crudo.atendidoEn ?? Date.now());
    if (isNaN(cuando.getTime()) || cuando.getTime() > Date.now() + 86_400_000) return { claveCliente: clave, estado: 'error', mensaje: 'La fecha de atención no es válida.' };
    try {
      return await this.db.transaction(async (m) => {
        if (await m.existsBy(Atencion, { entidadId: u.entidadId, claveCliente: clave })) return { claveCliente: clave, estado: 'duplicado' as const };
        let p = paciente.dpi ? await m.findOneBy(Paciente, { entidadId: u.entidadId, dpi: paciente.dpi }) : null;
        const nuevo = !p;
        if (!p) p = await m.save(m.create(Paciente, { ...paciente, entidadId: u.entidadId }));
        if (await m.existsBy(Atencion, { campanaId, pacienteId: p.id })) {
          if (nuevo) throw new Error('inalcanzable');   // un paciente recién creado no puede tener atenciones
          return { claveCliente: clave, estado: 'repetido' as const, mensaje: 'Esta persona ya estaba registrada en la campaña.' };
        }
        const a = await m.save(m.create(Atencion, { entidadId: u.entidadId, campanaId, pacienteId: p.id, claveCliente: clave, atendidoEn: cuando }));
        await m.increment(Campana, { id: campanaId }, 'personasAtendidas', 1);
        const bit = m.getRepository(Bitacora);
        if (nuevo) await registrar(bit, u, 'paciente', p.id, 'CREAR', { origen: 'jornada' });
        await registrar(bit, u, 'atencion', a.id, 'CREAR', { campanaId });
        return { claveCliente: clave, estado: 'ok' as const };
      });
    } catch (e: any) {
      if (e?.code === '23505') return { claveCliente: clave, estado: 'duplicado' };   // otra petición con la misma clave ganó la carrera
      throw new BadRequestException('No se pudo procesar el registro.');
    }
  }
}
