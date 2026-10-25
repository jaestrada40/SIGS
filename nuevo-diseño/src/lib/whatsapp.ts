/** Enlace wa.me para escribir a un teléfono de Guatemala (8 dígitos; se antepone 502). Devuelve null si el número no sirve. */
export function enlaceWhatsApp(telefono: string | null | undefined, texto: string): string | null {
  const d = (telefono ?? "").replace(/\D/g, "");
  const n = d.length === 8 ? `502${d}` : d.length === 11 && d.startsWith("502") ? d : null;
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(texto)}` : null;
}
