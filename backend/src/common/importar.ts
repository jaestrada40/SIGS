import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';

export const MAX_FILAS = 1000;

export const rechazar = (errores: { fila: number; mensaje: string }[]) =>
  new BadRequestException({ message: 'Hay filas con errores; no se importó nada', errores });

// Valida cada fila contra el DTO. Si alguna falla se rechaza todo el archivo con el detalle por fila
// (fila 1 = encabezado, así el número coincide con el que ve la persona en Excel).
export async function validarFilas<T extends object>(dto: new () => T, filas: unknown): Promise<T[]> {
  if (!Array.isArray(filas) || !filas.length) throw new BadRequestException('El archivo no trae filas');
  if (filas.length > MAX_FILAS) throw new BadRequestException(`Máximo ${MAX_FILAS} filas por archivo`);
  const errores: { fila: number; mensaje: string }[] = [];
  const ok: T[] = [];
  for (const [i, f] of filas.entries()) {
    const inst = plainToInstance(dto, f);
    const e = await validate(inst, { whitelist: true });
    if (e.length) errores.push({ fila: i + 2, mensaje: e.flatMap((x) => Object.values(x.constraints ?? {})).join('. ') });
    else ok.push(inst);
  }
  if (errores.length) throw rechazar(errores);
  return ok;
}
