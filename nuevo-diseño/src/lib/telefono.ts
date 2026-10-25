export const TELEFONO_GT = /^[2-7]\d{7}$/;   // misma regla que el servidor: 8 dígitos que empiezan en 2-7
export const limpiarTelefono = (v: string) => v.replace(/^\+?502/, "").replace(/[\s-]/g, "");
