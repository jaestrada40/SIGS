import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ScanLine, X } from "lucide-react";

export type DpiDatos = {
  dpi?: string;
  nombreCompleto?: string;
  sexo?: "F" | "M";
  fechaNacimiento?: string;
  departamento?: string;
  municipio?: string;
};
type Props = { onFound: (datos: DpiDatos) => void };

async function ocr(blob: Blob) {
  const image = await createImageBitmap(blob);
  const canvas = document.createElement("canvas");
  canvas.width = image.width * 2;
  canvas.height = image.height * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.filter = "grayscale(1) contrast(1.8)";
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  const procesada = await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => b ? resolve(b) : reject(new Error("imagen")), "image/png"));
  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("eng");
  await worker.setParameters({ tessedit_pageseg_mode: "6", tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<" });
  const { data: { text } } = await worker.recognize(procesada);
  await worker.terminate();
  return text.toUpperCase();
}

function reconocerDatos(textos: string[]): DpiDatos {
  const texto = textos.join("\n").replace(/[“”]/g, '"');
  const normalizado = texto.replace(/[OQ]/g, "0").replace(/[IL]/g, "1");
  // En el DPI guatemalteco la MRZ contiene GTM + el número de DPI de 13 dígitos.
  const mrz = normalizado.match(/GTM\s*([0-9]{13})/);
  const dpi = mrz?.[1] ?? normalizado.match(/\b\d{13}\b/)?.[0];
  const lineaMrz = normalizado.split(/\n+/).find((l) => /ESTRADA|<<.*<</.test(l));
  const nombreMrz = lineaMrz?.replace(/[^A-Z< ]/g, "").split("<").filter(Boolean).join(" ").trim();
  const nombre = nombreMrz && nombreMrz.length > 5 ? nombreMrz : undefined;
  const sexo = /\bF(?:EMENINO)?\b/.test(texto) ? "F" : /\bM(?:ASCULINO)?\b/.test(texto) ? "M" : undefined;
  const fecha = texto.match(/\b(\d{2})[\/.-](\d{2})[\/.-](\d{4})\b/) ?? texto.match(/\b(\d{2})(?:ENE|FEB|MAR|ABR|MAY|JUN|JUL|AGO|SEP|OCT|NOV|DIC)(\d{4})\b/);
  const meses: Record<string, string> = { ENE: "01", FEB: "02", MAR: "03", ABR: "04", MAY: "05", JUN: "06", JUL: "07", AGO: "08", SEP: "09", OCT: "10", NOV: "11", DIC: "12" };
  let fechaNacimiento: string | undefined;
  if (fecha && fecha.length === 4) fechaNacimiento = `${fecha[3]}-${fecha[2]}-${fecha[1]}`;
  else if (fecha && fecha.length === 3) { const m = fecha[0].match(/(\d{2})([A-Z]{3})(\d{4})/); if (m) fechaNacimiento = `${m[3]}-${meses[m[2]]}-${m[1]}`; }
  if (!fechaNacimiento) {
    const mrzFecha = normalizado.match(/\b(\d{6})\d[MF]\b/);
    if (mrzFecha) { const yy = Number(mrzFecha[1].slice(0, 2)); fechaNacimiento = `${yy > 30 ? "19" : "20"}${mrzFecha[1].slice(0, 2)}-${mrzFecha[1].slice(2, 4)}-${mrzFecha[1].slice(4, 6)}`; }
  }
  const lugares = texto.match(/(?:LUGAR DE NACIMIENTO|VECINDAD)[:\s]+([A-ZÁÉÍÓÚÑ ]+?)(?:\n|\r)/i);
  const departamento = lugares?.[1]?.trim();
  const municipio = texto.match(/(?:VECINDAD|MUNICIPIO)[:\s]+[A-ZÁÉÍÓÚÑ ]+\n([A-ZÁÉÍÓÚÑ ]+)/i)?.[1]?.trim();
  return { dpi, nombreCompleto: nombre, sexo, fechaNacimiento, departamento, municipio };
}

async function reconocerDpi(blobs: Blob[]) {
  const textos = await Promise.all(blobs.map(ocr));
  return reconocerDatos(textos);
}

/* Mantiene la compatibilidad del resultado con imágenes donde solo se alcanza a leer la MRZ. */
function validarDatos(datos: DpiDatos) {
  if (datos.dpi && !/^\d{13}$/.test(datos.dpi)) datos.dpi = undefined;
  return datos;
}

/** OCR local: la imagen no sale del navegador. Solo devuelve un DPI candidato. */
export function OcrDpi({ onFound }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [camara, setCamara] = useState(false);
  const [lado, setLado] = useState<"frente" | "reverso">("frente");
  const [frente, setFrente] = useState<Blob | null>(null);
  const [reverso, setReverso] = useState<Blob | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  useEffect(() => { if (camara && video.current && stream.current) video.current.srcObject = stream.current; }, [camara]);

  async function abrirCamara() {
    setMsg(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      setLado("frente"); setFrente(null); setReverso(null); setCamara(true);
      if (video.current) video.current.srcObject = stream.current;
    } catch { setMsg("No se pudo abrir la cámara. Verifique el permiso del navegador o use una imagen."); }
  }

  function cerrarCamara() {
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setCamara(false); setFrente(null); setReverso(null);
  }

  async function capturar() {
    const v = video.current;
    if (!v || !v.videoWidth) { setMsg("Espere a que la cámara esté lista."); return; }
    const c = document.createElement("canvas"); c.width = v.videoWidth; c.height = v.videoHeight;
    c.getContext("2d")?.drawImage(v, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => c.toBlob(resolve, "image/jpeg", 0.9));
    if (!blob) { setMsg("No se pudo capturar la imagen."); return; }
    if (lado === "frente") { setFrente(blob); setLado("reverso"); return; }
    if (!frente) { setMsg("Primero capture el frente del DPI."); return; }
    setReverso(blob);
    cerrarCamara();
    setBusy(true); setMsg(null);
    try {
      const datos = validarDatos(await reconocerDpi([frente, blob]));
      if (!datos.dpi && !datos.nombreCompleto) setMsg("No pudimos leer los datos. Asegúrese de que el DPI esté enfocado y completo."); else onFound(datos);
    } catch { setMsg("No se pudo reconocer el DPI. Intente nuevamente."); }
    finally { setBusy(false); setFrente(null); }
  }

  async function leer(file: File) {
    setMsg(null);
    if (!file.type.startsWith("image/")) { setMsg("Seleccione una imagen JPG, PNG o WEBP."); return; }
    if (file.size > 5 * 1024 * 1024) { setMsg("La imagen no puede superar 5 MB."); return; }
    setBusy(true);
    try {
      const datos = validarDatos(await reconocerDpi([file]));
      if (!datos.dpi && !datos.nombreCompleto) setMsg("No pudimos leer los datos. Pruebe con una imagen más nítida.");
      else onFound(datos);
    } catch { setMsg("No se pudo reconocer la imagen. Intente con otra fotografía."); }
    finally { setBusy(false); }
  }

  if (camara) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
    <div className="w-full max-w-lg rounded-2xl bg-background p-4 shadow-xl">
      <div className="mb-3 flex items-center justify-between"><strong>Escanear {lado} del DPI</strong><button type="button" onClick={cerrarCamara} aria-label="Cerrar cámara"><X /></button></div>
      <p className="mb-3 text-sm text-muted-foreground">Alinee todo el documento dentro del marco y asegúrese de tener buena luz.</p>
      <div className="overflow-hidden rounded-xl bg-black"><video ref={video} autoPlay playsInline muted className="aspect-[4/3] w-full object-cover" /></div>
      <button type="button" onClick={() => void capturar()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"><Camera /> Capturar {lado}</button>
    </div>
  </div>;

  return <div className="space-y-2">
    <button type="button" onClick={() => void abrirCamara()} disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"><Camera className="h-4 w-4" /> Escanear DPI con cámara</button>
    <span className="mx-2 text-xs text-muted-foreground">o</span>
    <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
      {busy ? "Reconociendo DPI…" : "Reconocer DPI desde imagen"}
      <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) void leer(f); e.target.value = ""; }} />
    </label>
    {msg && <p role="alert" className="rounded-lg bg-coral-soft p-2 text-xs">{msg}</p>}
  </div>;
}
