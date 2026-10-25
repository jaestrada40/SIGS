import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, ScanLine, X } from "lucide-react";

type Props = { onFound: (dpi: string) => void };

async function reconocerDpi(blob: Blob) {
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
  const normalizado = text.toUpperCase().replace(/[OQ]/g, "0").replace(/[IL]/g, "1");
  // En el DPI guatemalteco la MRZ contiene GTM + el número de DPI de 13 dígitos.
  const mrz = normalizado.match(/GTM\s*([0-9]{13})/);
  if (mrz) return mrz[1];
  const candidatos = (normalizado.match(/[0-9][0-9\s-]{11,20}[0-9]/g) ?? [])
    .map((x) => x.replace(/\D/g, "")).filter((x) => x.length === 13);
  return candidatos[0] ?? normalizado.replace(/\D/g, "").match(/\d{13}/)?.[0];
}

/** OCR local: la imagen no sale del navegador. Solo devuelve un DPI candidato. */
export function OcrDpi({ onFound }: Props) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [camara, setCamara] = useState(false);
  const [lado, setLado] = useState<"frente" | "reverso">("frente");
  const [frente, setFrente] = useState<Blob | null>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);

  useEffect(() => () => stream.current?.getTracks().forEach((t) => t.stop()), []);
  useEffect(() => { if (camara && video.current && stream.current) video.current.srcObject = stream.current; }, [camara]);

  async function abrirCamara() {
    setMsg(null);
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } }, audio: false });
      setLado("frente"); setFrente(null); setCamara(true);
      if (video.current) video.current.srcObject = stream.current;
    } catch { setMsg("No se pudo abrir la cámara. Verifique el permiso del navegador o use una imagen."); }
  }

  function cerrarCamara() {
    stream.current?.getTracks().forEach((t) => t.stop()); stream.current = null; setCamara(false); setFrente(null);
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
    cerrarCamara();
    setBusy(true); setMsg(null);
    try {
      const dpi = await reconocerDpi(frente);
      if (!dpi) setMsg("No encontramos el DPI en el frente. Intente con mejor luz y enfoque."); else onFound(dpi);
    } catch { setMsg("No se pudo reconocer el DPI. Intente nuevamente."); }
    finally { setBusy(false); setFrente(null); }
  }

  async function leer(file: File) {
    setMsg(null);
    if (!file.type.startsWith("image/")) { setMsg("Seleccione una imagen JPG, PNG o WEBP."); return; }
    if (file.size > 5 * 1024 * 1024) { setMsg("La imagen no puede superar 5 MB."); return; }
    setBusy(true);
    try {
      const dpi = await reconocerDpi(file);
      if (!dpi) setMsg("No encontramos un DPI de 13 dígitos. Pruebe con una imagen más nítida.");
      else onFound(dpi);
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
