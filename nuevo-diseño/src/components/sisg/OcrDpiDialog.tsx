import { useState } from "react";
import { Loader2, ScanLine } from "lucide-react";

type Props = { onFound: (dpi: string) => void };

/** OCR local: la imagen no sale del navegador. Solo devuelve un DPI candidato. */
export function OcrDpi({ onFound }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function leer(file: File) {
    setMsg(null);
    if (!file.type.startsWith("image/")) { setMsg("Seleccione una imagen JPG, PNG o WEBP."); return; }
    if (file.size > 5 * 1024 * 1024) { setMsg("La imagen no puede superar 5 MB."); return; }
    setBusy(true);
    try {
      const { createWorker } = await import("tesseract.js");
      const worker = await createWorker("eng");
      const { data: { text } } = await worker.recognize(file);
      await worker.terminate();
      const candidatos = text.replace(/[^0-9]/g, " ").match(/\d{13}/g) ?? [];
      const dpi = candidatos[0];
      if (!dpi) setMsg("No encontramos un DPI de 13 dígitos. Pruebe con una imagen más nítida.");
      else onFound(dpi);
    } catch { setMsg("No se pudo reconocer la imagen. Intente con otra fotografía."); }
    finally { setBusy(false); }
  }

  return <div className="space-y-2">
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
      {busy ? "Reconociendo DPI…" : "Reconocer DPI desde imagen"}
      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void leer(f); e.target.value = ""; }} />
    </label>
    {msg && <p role="alert" className="rounded-lg bg-coral-soft p-2 text-xs">{msg}</p>}
  </div>;
}
