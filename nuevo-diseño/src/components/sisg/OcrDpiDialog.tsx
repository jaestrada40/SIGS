import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Camera, CheckCircle2, Loader2, Minus, ScanLine, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Geografia } from "@/lib/api";
import { interpretarDpi, lecturaVacia, type DpiLectura } from "@/lib/dpi";
import { cn } from "@/lib/utils";

export type { DpiLectura };
type Props = {
  /** Se llama solo cuando la persona confirma «Usar estos datos». Nunca se escribe nada sin esa confirmación. */
  onUsar: (lectura: DpiLectura) => void;
  /** Catálogo de departamentos y municipios para validar el lugar. Sin él solo se leen DPI, nombre, sexo y fecha. */
  geografia?: Geografia | undefined;
  /** «buscar»: solo interesa el DPI y el nombre (por ejemplo, para encontrar a un paciente ya registrado). */
  modo?: "paciente" | "buscar";
};

// ---------------------------------------------------------------------------------------------------- preparación de la imagen
// Se lee a varios tamaños: cada pasada tarda ~0.3 s y un tamaño distinto rescata lo que otro pierde (por ejemplo, los nombres de pila a 1000 o 1800 px).
const ESCALAS = [1000, 1400, 1800];   // px del lado más largo

/** Escala de grises con el contraste estirado, y una versión en blanco y negro con umbral adaptativo (sirve con fondos de fotografía u holograma). */
function variantes(bitmap: ImageBitmap, ancho: number, conBinaria: boolean) {
  const escala = ancho / Math.max(bitmap.width, bitmap.height);
  const w = Math.round(bitmap.width * escala), h = Math.round(bitmap.height * escala);
  const gris = document.createElement("canvas"); gris.width = w; gris.height = h;
  const g = gris.getContext("2d", { willReadFrequently: true });
  if (!g) throw new Error("canvas");
  g.drawImage(bitmap, 0, 0, w, h);
  const img = g.getImageData(0, 0, w, h), d = img.data;
  const lum = new Uint8ClampedArray(w * h), hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { const v = (d[i]! * 299 + d[i + 1]! * 587 + d[i + 2]! * 114) / 1000; lum[p] = v; hist[lum[p]!]!++; }
  let acum = 0, lo = 0, hi = 255;
  for (let v = 0; v < 256; v++) { acum += hist[v]!; if (acum >= w * h * 0.02) { lo = v; break; } }
  acum = 0;
  for (let v = 255; v >= 0; v--) { acum += hist[v]!; if (acum >= w * h * 0.02) { hi = v; break; } }
  const rango = Math.max(1, hi - lo);
  for (let p = 0; p < lum.length; p++) lum[p] = ((lum[p]! - lo) * 255) / rango;
  for (let i = 0, p = 0; i < d.length; i += 4, p++) { d[i] = d[i + 1] = d[i + 2] = lum[p]!; d[i + 3] = 255; }
  g.putImageData(img, 0, 0);
  if (!conBinaria) return { gris, binaria: null };

  // Umbral adaptativo (Bradley-Roth) con imagen integral: un píxel es tinta si es bastante más oscuro que su vecindad.
  const W = w + 1, integral = new Uint32Array(W * (h + 1));
  for (let y = 0; y < h; y++) { let fila = 0; for (let x = 0; x < w; x++) { fila += lum[y * w + x]!; integral[(y + 1) * W + x + 1] = integral[y * W + x + 1]! + fila; } }
  const s = Math.max(15, Math.floor(w / 16)), mitad = s >> 1;
  const binaria = document.createElement("canvas"); binaria.width = w; binaria.height = h;
  const b = binaria.getContext("2d");
  if (!b) throw new Error("canvas");
  const salida = b.createImageData(w, h), o = salida.data;
  for (let y = 0; y < h; y++) {
    const y1 = Math.max(0, y - mitad), y2 = Math.min(h - 1, y + mitad);
    for (let x = 0; x < w; x++) {
      const x1 = Math.max(0, x - mitad), x2 = Math.min(w - 1, x + mitad);
      const cuenta = (x2 - x1 + 1) * (y2 - y1 + 1);
      const suma = integral[(y2 + 1) * W + x2 + 1]! - integral[y1 * W + x2 + 1]! - integral[(y2 + 1) * W + x1]! + integral[y1 * W + x1]!;
      const v = lum[y * w + x]! * cuenta <= suma * 0.85 ? 0 : 255;
      const i = (y * w + x) * 4; o[i] = o[i + 1] = o[i + 2] = v; o[i + 3] = 255;
    }
  }
  b.putImageData(salida, 0, 0);
  return { gris, binaria };
}

/** La franja de lectura automática (MRZ) está en la parte baja del reverso: se lee aparte, con solo sus caracteres posibles. */
function recorteInferior(origen: HTMLCanvasElement, fraccion = 0.45) {
  const alto = Math.round(origen.height * fraccion), c = document.createElement("canvas");
  c.width = origen.width; c.height = alto;
  c.getContext("2d")?.drawImage(origen, 0, origen.height - alto, origen.width, alto, 0, 0, origen.width, alto);
  return c;
}

/**
 * Segunda lectura de la fecha del frente: el OCR general confunde 6 con «S» en la línea «06ENE1978». Se localiza la línea bajo «FECHA DE NACIMIENTO»,
 * se recorta con algo de margen y se lee a varios tamaños, con solo letras mayúsculas y dígitos. El resultado se suma a los textos; dpi.ts decide.
 */
async function leerFecha(general: { recognize: (i: HTMLCanvasElement, o?: object, out?: object) => Promise<{ data: { blocks?: { paragraphs: { lines: { text: string; bbox: { x0: number; y0: number; x1: number; y1: number } }[] }[] }[] | null } }> },
  linea: { setParameters: (p: Record<string, unknown>) => Promise<unknown>; recognize: (i: HTMLCanvasElement) => Promise<{ data: { text: string } }> }, lienzo: HTMLCanvasElement, PSM: { SINGLE_LINE: unknown }): Promise<string[]> {
  const lineas = ((await general.recognize(lienzo, {}, { blocks: true })).data.blocks ?? []).flatMap((b) => b.paragraphs.flatMap((p) => p.lines));
  const sinTildes = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
  const i = lineas.findIndex((l) => /NACIMIENTO/.test(sinTildes(l.text)) && !/LUGAR/.test(sinTildes(l.text)));
  const destino = i >= 0 ? lineas[i + 1] : undefined;
  if (!destino) return [];
  const h = destino.bbox.y1 - destino.bbox.y0, x0 = destino.bbox.x0, x1 = Math.min(destino.bbox.x1, x0 + 9 * h);
  await linea.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789", tessedit_pageseg_mode: PSM.SINGLE_LINE });
  const out: string[] = [];
  for (const margen of [0.35, 0.5, 0.7]) for (const alto of [100, 140]) {
    const m = Math.round(h * margen), sx = Math.max(0, x0 - m), sy = Math.max(0, destino.bbox.y0 - m);
    const sw = Math.min(lienzo.width - sx, x1 - x0 + 2 * m), sh = Math.min(lienzo.height - sy, h + 2 * m), k = alto / sh;
    const c = document.createElement("canvas"); c.width = Math.round(sw * k); c.height = Math.round(sh * k);
    c.getContext("2d")?.drawImage(lienzo, sx, sy, sw, sh, 0, 0, c.width, c.height);
    out.push((await linea.recognize(c)).data.text);
  }
  return out;
}

/** OCR local con Tesseract: la imagen NO sale del navegador. Devuelve los textos de varias pasadas; la interpretación se hace en lib/dpi.ts. */
async function leerImagenes(blobs: Blob[], avance: (texto: string) => void): Promise<string[]> {
  const { createWorker, PSM } = await import("tesseract.js");
  avance("Cargando el lector…");
  const general = await createWorker("spa");
  const mrz = await createWorker("eng");
  const textos: string[] = [];
  try {
    await mrz.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<", tessedit_pageseg_mode: PSM.SINGLE_BLOCK });
    const total = blobs.length * (ESCALAS.length + 1 + 3 + 1); let n = 0;
    const paso = (t: string) => avance(`${t} (${++n} de ${total})`);
    for (const [i, blob] of blobs.entries()) {
      const cara = blobs.length > 1 ? (i === 0 ? "el frente" : "el reverso") : "la imagen";
      const bitmap = await createImageBitmap(blob);
      try {
        const porEscala = ESCALAS.map((ancho) => variantes(bitmap, ancho, ancho === 1400));
        await general.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        for (const [k, v] of porEscala.entries()) { paso(`Leyendo ${cara}`); textos.push((await general.recognize(v.gris)).data.text); void k; }
        const media = porEscala[1]!;
        paso(`Leyendo ${cara} con más contraste`);
        await general.setParameters({ tessedit_pageseg_mode: PSM.SPARSE_TEXT });
        textos.push((await general.recognize(media.binaria!)).data.text);
        // Franja de lectura automática (MRZ): parte baja del reverso, con solo sus caracteres posibles.
        for (const lienzo of [media.gris, porEscala[2]!.gris, media.binaria!]) { paso("Buscando la franja de lectura automática"); textos.push((await mrz.recognize(recorteInferior(lienzo))).data.text); }
        paso(`Confirmando la fecha de ${cara}`);
        await general.setParameters({ tessedit_pageseg_mode: PSM.AUTO });
        textos.push(...await leerFecha(general as never, mrz as never, media.gris, PSM));
        await mrz.setParameters({ tessedit_char_whitelist: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<", tessedit_pageseg_mode: PSM.SINGLE_BLOCK });   // deja el lector de la franja como estaba para la siguiente cara
      } finally { bitmap.close(); }
    }
  } finally { await general.terminate(); await mrz.terminate(); }
  return textos;
}

// ---------------------------------------------------------------------------------------------------- cámara con marco guía
const PROPORCION_DPI = 1.586;   // 85.6 × 54 mm, igual que cualquier tarjeta de identificación

function CamaraDpi({ onListo, onCerrar }: { onListo: (blobs: Blob[]) => void; onCerrar: () => void }) {
  const video = useRef<HTMLVideoElement>(null), marco = useRef<HTMLDivElement>(null), guia = useRef<HTMLDivElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [frente, setFrente] = useState<Blob | null>(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (cancelado) { s.getTracks().forEach((t) => t.stop()); return; }
        stream.current = s;
        if (video.current) video.current.srcObject = s;
      } catch { setError("No se pudo abrir la cámara. Revise el permiso del navegador (la cámara solo funciona con HTTPS o en localhost) o use una imagen."); }
    })();
    return () => { cancelado = true; stream.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  /** Recorta del fotograma solo lo que queda dentro del marco, con la resolución completa de la cámara. */
  async function capturar(): Promise<Blob | null> {
    const v = video.current, m = marco.current, g = guia.current;
    if (!v || !m || !g || !v.videoWidth) { setError("Espere a que la cámara esté lista."); return null; }
    const cm = m.getBoundingClientRect(), cg = g.getBoundingClientRect();
    const escala = Math.max(cm.width / v.videoWidth, cm.height / v.videoHeight);   // el video se muestra con object-cover
    const offX = (v.videoWidth * escala - cm.width) / 2, offY = (v.videoHeight * escala - cm.height) / 2;
    const sx = Math.max(0, (cg.left - cm.left + offX) / escala), sy = Math.max(0, (cg.top - cm.top + offY) / escala);
    const sw = Math.min(v.videoWidth - sx, cg.width / escala), sh = Math.min(v.videoHeight - sy, cg.height / escala);
    const c = document.createElement("canvas"); c.width = Math.round(sw); c.height = Math.round(sh);
    c.getContext("2d")?.drawImage(v, sx, sy, sw, sh, 0, 0, c.width, c.height);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.92));
    if (!blob) setError("No se pudo capturar la imagen.");
    return blob;
  }

  async function onCapturar() {
    setError(null);
    const blob = await capturar();
    if (!blob) return;
    if (!frente) { setFrente(blob); return; }
    onListo([frente, blob]);
  }

  const lado = frente ? "reverso" : "frente";
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={`Escanear ${lado} del DPI`}>
      <div className="w-full max-w-lg rounded-2xl bg-background p-4 shadow-xl">
        <div className="mb-2 flex items-center justify-between">
          <strong>Paso {frente ? 2 : 1} de 2: {lado} del DPI</strong>
          <button type="button" onClick={onCerrar} aria-label="Cerrar cámara" className="rounded-lg p-1 hover:bg-accent"><X /></button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          {frente ? "Ahora el reverso: la franja de letras y símbolos de abajo debe quedar dentro del marco." : "Coloque el frente dentro del marco, sin reflejos y con buena luz."}
        </p>
        <div ref={marco} className="relative aspect-[4/3] overflow-hidden rounded-xl bg-black">
          <video ref={video} autoPlay playsInline muted className="h-full w-full object-cover" />
          <div ref={guia} className="pointer-events-none absolute left-1/2 top-1/2 w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]" style={{ aspectRatio: PROPORCION_DPI }} />
        </div>
        {error && <p role="alert" className="mt-3 rounded-lg bg-coral-soft p-2 text-sm">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" className="flex-1" onClick={() => void onCapturar()} disabled={!!error && !stream.current}><Camera /> Capturar {lado}</Button>
          {frente && <Button type="button" variant="outline" onClick={() => onListo([frente])}>Omitir reverso</Button>}
        </div>
        {frente && <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><CheckCircle2 className="h-3.5 w-3.5 text-primary" aria-hidden /> Frente capturado. Con el reverso se verifican más datos.</p>}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------- panel de revisión
const FILAS: { k: keyof DpiLectura; etiqueta: string; solo?: "paciente"; fmt?: (v: string) => string }[] = [
  { k: "nombreCompleto", etiqueta: "Nombre" },
  { k: "sexo", etiqueta: "Sexo", solo: "paciente", fmt: (v) => (v === "F" ? "Femenino" : "Masculino") },
  { k: "fechaNacimiento", etiqueta: "Fecha de nacimiento", solo: "paciente", fmt: (v) => v.split("-").reverse().join("/") },
  { k: "dpi", etiqueta: "DPI", fmt: (v) => (v.length === 13 ? `${v.slice(0, 4)} ${v.slice(4, 9)} ${v.slice(9)}` : v) },
  { k: "departamento", etiqueta: "Departamento", solo: "paciente" },
  { k: "municipio", etiqueta: "Municipio", solo: "paciente" },
];

function PanelLectura({ lectura, modo, onUsar, onDescartar }: { lectura: DpiLectura; modo: "paciente" | "buscar"; onUsar: () => void; onDescartar: () => void }) {
  const filas = FILAS.filter((f) => !f.solo || modo === "paciente");
  const sinVerificar = filas.some((f) => lectura[f.k]?.estado === "revisar" || !lectura[f.k]);
  return (
    <div className="space-y-3 rounded-2xl border bg-card p-4 text-sm shadow-sm" role="region" aria-label="Datos reconocidos del DPI">
      <p className="font-semibold">Datos reconocidos del DPI</p>
      <ul className="space-y-2">
        {filas.map((f) => {
          const c = lectura[f.k];
          return (
            <li key={f.k} className="flex items-start gap-2">
              {!c ? <Minus className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-label="No detectado" />
                : c.estado === "verificado" ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Verificado" />
                : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber" aria-label="Por revisar" />}
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground">{f.etiqueta}</p>
                <p className={cn("break-words font-medium", !c && "font-normal text-muted-foreground")}>{c ? (f.fmt ? f.fmt(c.valor) : c.valor) : "No detectado: complételo a mano"}</p>
                {c?.nota && <p className="text-xs text-muted-foreground">{c.nota}</p>}
              </div>
            </li>
          );
        })}
      </ul>
      <p className={cn("rounded-lg p-2 text-xs", sinVerificar ? "bg-amber-soft" : "bg-accent")}>
        {sinVerificar ? "Hay datos por revisar o sin detectar. Se cargan en el formulario para que los confirme o los corrija antes de guardar." : "Todos los datos pasaron las verificaciones. Confírmelos contra el documento antes de guardar."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onUsar}><ShieldCheck /> {modo === "buscar" ? "Buscar paciente" : "Usar estos datos"}</Button>
        <Button type="button" size="sm" variant="outline" onClick={onDescartar}>Descartar y escribir a mano</Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------------------------------- componente
const MAX_BYTES = 8 * 1024 * 1024;

/** Lee un DPI desde la cámara o desde imágenes. Todo ocurre en el navegador y la imagen no se guarda. Siempre se puede llenar a mano. */
export function OcrDpi({ onUsar, geografia, modo = "paciente" }: Props) {
  const [busy, setBusy] = useState(false);
  const [avance, setAvance] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [camara, setCamara] = useState(false);
  const [lectura, setLectura] = useState<DpiLectura | null>(null);
  const montado = useRef(true);
  // Se reasigna a true al montar: en desarrollo React monta, limpia y vuelve a montar, y sin esto quedaría en false para siempre.
  useEffect(() => { montado.current = true; return () => { montado.current = false; }; }, []);

  async function procesar(blobs: Blob[]) {
    setMsg(null); setLectura(null); setBusy(true);
    try {
      const textos = await leerImagenes(blobs, (t) => { if (montado.current) setAvance(t); });
      const l = interpretarDpi(textos, geografia);
      if (!montado.current) return;
      if (lecturaVacia(l)) setMsg("No pudimos leer datos del DPI. Pruebe con más luz, sin reflejos y con el documento completo y enfocado, o llene el formulario a mano.");
      else setLectura(l);
    } catch { if (montado.current) setMsg("No se pudo reconocer la imagen. Intente con otra o llene el formulario a mano."); }
    finally { if (montado.current) { setBusy(false); setAvance(""); } }
  }

  function leerArchivos(lista: FileList | null) {
    if (!lista?.length) return;
    const archivos = [...lista].slice(0, 2);
    if (archivos.some((a) => !/^image\/(png|jpe?g|webp)$/.test(a.type))) { setMsg("Seleccione imágenes JPG, PNG o WEBP."); return; }
    if (archivos.some((a) => a.size > MAX_BYTES)) { setMsg("Cada imagen puede pesar hasta 8 MB."); return; }
    void procesar(archivos);
  }

  const usar = () => { if (lectura) { onUsar(modo === "buscar" ? Object.fromEntries(Object.entries(lectura).filter(([k]) => k === "dpi" || k === "nombreCompleto")) : lectura); setLectura(null); } };

  return (
    <div className="mb-2 space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <button type="button" onClick={() => { setMsg(null); setLectura(null); setCamara(true); }} disabled={busy} className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline disabled:opacity-50"><Camera className="h-4 w-4" /> Escanear DPI con cámara</button>
        <span className="text-xs text-muted-foreground">o</span>
        <label className={cn("inline-flex items-center gap-1.5 text-sm font-semibold text-primary", busy ? "opacity-50" : "cursor-pointer hover:underline")}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanLine className="h-4 w-4" />}
          Reconocer DPI desde imagen
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple className="sr-only" disabled={busy} onChange={(e) => { leerArchivos(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      {!busy && !lectura && <p className="text-xs text-muted-foreground">Elija el frente y el reverso a la vez para verificar más datos. La imagen se procesa en su navegador y no se guarda. También puede llenar todo a mano.</p>}
      {busy && <p role="status" aria-live="polite" className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> {avance || "Reconociendo DPI…"} Esto puede tardar unos segundos.</p>}
      {msg && <p role="alert" className="rounded-lg bg-coral-soft p-2 text-xs">{msg}</p>}
      {lectura && <PanelLectura lectura={lectura} modo={modo} onUsar={usar} onDescartar={() => setLectura(null)} />}
      {camara && <CamaraDpi onCerrar={() => setCamara(false)} onListo={(blobs) => { setCamara(false); void procesar(blobs); }} />}
    </div>
  );
}
