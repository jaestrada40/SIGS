import { ValueTransformer } from 'typeorm';

// Los montos se guardan como numeric(12,2); Postgres los devuelve como texto y aquí vuelven a ser números.
export const numerico: ValueTransformer = { to: (v?: number | null) => v ?? null, from: (v?: string | null) => (v === null || v === undefined ? null : Number(v)) };
