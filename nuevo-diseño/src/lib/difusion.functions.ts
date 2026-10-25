import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const entrada = z.object({
  campana: z.string().trim().min(1).max(200),
  area: z.string().trim().max(60),
  lugar: z.string().trim().max(200).optional(),
  fechas: z.string().trim().max(100).optional(),
  objetivos: z.string().trim().min(5, "Describa los objetivos.").max(1500),
  publico: z.string().trim().min(3, "Describa el público.").max(800),
  canales: z.array(z.enum(["WhatsApp", "Radio comunitaria", "Facebook", "Afiche"])).min(1).max(4),
  tono: z.enum(["Cálido y cercano", "Formal e informativo", "Urgente y motivador"]),
});
export type EntradaDifusion = z.infer<typeof entrada>;
export type ResultadoDifusion = { mensajes: { canal: string; texto: string }[] } | { error: string };

const INSTRUCCIONES = `Usted redacta mensajes de difusión para campañas de salud de organismos no lucrativos en Guatemala.
Escriba en español de Guatemala, con trato de "usted", lenguaje sencillo y respetuoso, culturalmente sensible y sin tecnicismos.
No invente cifras, teléfonos, precios ni datos médicos que no estén en la información recibida; si falta un dato útil (hora, contacto), use un marcador entre corchetes como [hora] o [teléfono].
No prometa curas ni resultados. Incluya una llamada a la acción clara.
Formato obligatorio: para cada canal solicitado, una línea "### <Canal>" seguida del mensaje. Nada más.
Longitud: WhatsApp máx. 600 caracteres con 1-2 emojis; Radio comunitaria guion de 30 segundos para leer en voz alta; Facebook 80-150 palabras con 2-3 hashtags; Afiche un titular corto y 3 líneas breves.`;

export const redactarDifusion = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => entrada.parse(d))
  .handler(async ({ data }): Promise<ResultadoDifusion> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) return { error: "La función de IA no está configurada." };
    const { generateTextViaGateway } = await import("./ai-gateway.server");
    const prompt = [
      `Campaña: ${data.campana}`, `Área: ${data.area}`,
      data.lugar && `Lugar: ${data.lugar}`, data.fechas && `Fechas: ${data.fechas}`,
      `Objetivos: ${data.objetivos}`, `Público: ${data.publico}`,
      `Tono: ${data.tono}`, `Canales: ${data.canales.join(", ")}`,
    ].filter(Boolean).join("\n");
    try {
      const texto = await generateTextViaGateway(apiKey, "openai/gpt-6-astra", [{ role: "user", content: prompt }], INSTRUCCIONES);
      const mensajes = texto.split(/^###\s*/m).map((b) => b.trim()).filter(Boolean).map((b) => {
        const [canal = "", ...rest] = b.split("\n");
        return { canal: canal.trim(), texto: rest.join("\n").trim() };
      }).filter((m) => m.texto);
      if (!mensajes.length) return { error: "No se generaron mensajes. Revise la información e intente de nuevo." };
      return { mensajes };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.error("redactarDifusion failed", status, (e as Error).message);
      if (status === 429) return { error: "Hay muchas solicitudes en este momento. Espere un minuto e intente de nuevo." };
      if (status === 402) return { error: "Se agotaron los créditos de IA del espacio de trabajo. Puede recargarlos en Settings → Plans & credits." };
      if (status === 403) return { error: "La IA no está disponible para este espacio de trabajo en este momento." };
      return { error: "No pudimos redactar los mensajes. Intente de nuevo en unos momentos." };
    }
  });
