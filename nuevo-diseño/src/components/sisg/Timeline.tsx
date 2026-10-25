import { Ban, Download, FilePlus2, KeyRound, Link2, Lock, LogIn, LogOut, PencilLine, ShieldAlert, ShieldCheck, ShieldOff, Upload, UserCheck, UserX, type LucideIcon } from "lucide-react";
import { ROLES, tiempoRelativo, type Accion, type Movimiento } from "@/lib/api";
import { IconChip, Tag, type Tono } from "./ui";

// Paleta del diseño original: Creación verde, Modificación azul, Importación ámbar (el ámbar es solo de Importación). Alertas en coral.
export const acciones: Record<Accion, { label: string; icon: LucideIcon; tone: Tono; seguridad?: boolean }> = {
  CREAR: { label: "Creación", icon: FilePlus2, tone: "teal" },
  MODIFICAR: { label: "Modificación", icon: PencilLine, tone: "blue" },
  IMPORTAR: { label: "Importación", icon: Upload, tone: "amber" },
  INICIO_SESION: { label: "Inicio de sesión", icon: LogIn, tone: "teal", seguridad: true },
  CIERRE_SESION: { label: "Cierre de sesión", icon: LogOut, tone: "blue", seguridad: true },
  MFA_ACTIVADO: { label: "MFA activado", icon: ShieldCheck, tone: "teal", seguridad: true },
  BLOQUEO: { label: "Cuenta bloqueada", icon: ShieldAlert, tone: "coral", seguridad: true },
  CAMBIO_PASSWORD: { label: "Cambio de contraseña", icon: KeyRound, tone: "blue", seguridad: true },
  ACTIVAR: { label: "Usuario activado", icon: UserCheck, tone: "teal", seguridad: true },
  DESACTIVAR: { label: "Usuario desactivado", icon: UserX, tone: "coral", seguridad: true },
  RESTABLECER_MFA: { label: "MFA restablecido", icon: ShieldOff, tone: "blue", seguridad: true },
  RESTABLECER_PASSWORD: { label: "Contraseña restablecida", icon: Lock, tone: "blue", seguridad: true },
  EXPORTAR: { label: "Exportación", icon: Download, tone: "coral", seguridad: true },
  ACCESO: { label: "Resultado consultado por la persona", icon: ShieldCheck, tone: "teal", seguridad: true },
  ACCESO_FALLIDO: { label: "Intento fallido en un enlace", icon: ShieldAlert, tone: "coral", seguridad: true },
  SUSPENDER: { label: "Entidad suspendida", icon: Ban, tone: "coral", seguridad: true },
  REACTIVAR: { label: "Entidad reactivada", icon: UserCheck, tone: "teal", seguridad: true },
  REINVITAR: { label: "Invitación nueva", icon: Link2, tone: "blue", seguridad: true },
  INVITACION_ACEPTADA: { label: "Invitación aceptada", icon: ShieldCheck, tone: "teal", seguridad: true },
  RESTABLECER_ACCESO: { label: "Acceso restablecido", icon: KeyRound, tone: "blue", seguridad: true },
};
const tablas: Record<string, [string, string, boolean]> = { pacientes: ["Paciente", "Pacientes", false], paciente: ["Paciente", "Pacientes", false], estudios: ["Estudio", "Estudios", false], estudio: ["Estudio", "Estudios", false], campanas: ["Campaña", "Campañas", true], campana: ["Campaña", "Campañas", true], bitacora: ["Registro de auditoría", "Registros de auditoría", false], usuario: ["Usuario", "Usuarios", false], referido: ["Referido", "Referidos", false], impacto: ["Reporte de indicadores", "Reportes de indicadores", false], enlace: ["Enlace de resultado", "Enlaces de resultado", false], entidad: ["Entidad", "Entidades", true], sesion: ["Sesión", "Sesiones", true] };

export function describir(m: Movimiento) {
  const [t, pl, fem] = tablas[m.tabla.toLowerCase()] ?? [m.tabla, m.tabla, false];
  const o = fem ? "a" : "o";
  if (m.accion === "IMPORTAR") return `${pl} importad${o}s${m.detalle?.filas ? ` (${m.detalle.filas} filas)` : ""}`;
  if (m.accion === "MODIFICAR") return `${t} actualizad${o}${m.detalle?.campos?.length ? `: ${m.detalle.campos.join(", ")}` : ""}`;
  if (m.accion === "CREAR") return `${t} registrad${o}${m.tabla === "usuario" && m.detalle?.rol ? ` como ${ROLES[m.detalle.rol].label}` : ""}`;
  if (m.accion === "EXPORTAR") return `${pl} exportad${o}s${m.detalle?.filas !== undefined ? ` (${m.detalle.filas} filas)` : ""}`;
  if (m.accion === "BLOQUEO") return `Cuenta bloqueada ${m.detalle?.minutos ?? 15} min por intentos fallidos`;
  return acciones[m.accion]?.label ?? m.accion;
}

/** Quién hizo el movimiento, como texto. Para acciones sobre otra persona (activar, restablecer…) el actor es siempre un administrador. */
export const quien = (m: Movimiento) => (m.detalle?.plataforma ? "Plataforma SISG" : m.usuario ? `${m.usuario.nombre} · ${m.usuario.correo}` : "Usuario eliminado o sin registro");

export function Timeline({ items }: { items: Movimiento[] }) {
  return (
    <ol className="relative space-y-4 before:absolute before:bottom-2 before:left-[21px] before:top-2 before:w-px before:bg-border">
      {items.map((m) => {
        const a = acciones[m.accion] ?? acciones.CREAR;
        return (
          <li key={m.id} className="relative flex items-start gap-3">
            <IconChip icon={a.icon} tone={a.tone} />
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-sm font-medium">{describir(m)}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Tag tone={a.tone}>{a.label}</Tag>
                {m.detalle?.plataforma && <span className="text-xs text-muted-foreground">· Plataforma SISG</span>}
                {m.usuario && <span className="text-xs text-muted-foreground" title={`${m.usuario.correo} · ${ROLES[m.usuario.rol].label}`}>· {m.usuario.nombre}</span>}
                <time className="text-xs text-muted-foreground" dateTime={m.creadoEn}>{tiempoRelativo(m.creadoEn)}</time>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
