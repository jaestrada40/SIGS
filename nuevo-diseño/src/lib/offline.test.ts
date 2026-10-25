import { describe, expect, it } from "vitest";
import { abrirSello, derivarClave, sellar } from "./offline";

const sal = new Uint8Array(16).fill(7);

describe("cifrado de la cola de jornada", () => {
  it("lo cifrado se recupera con la misma contraseña y no contiene el texto original", async () => {
    const k = await derivarClave("contraseña-larga", sal, 1000);
    const s = await sellar(k, { paciente: { nombreCompleto: "Ana López", dpi: "2048173580301" } });
    expect(new TextDecoder().decode(s.datos)).not.toContain("Ana");
    expect(await abrirSello(k, s)).toEqual({ paciente: { nombreCompleto: "Ana López", dpi: "2048173580301" } });
  });
  it("una contraseña distinta, una sal distinta o un byte alterado no abren el registro", async () => {
    const k = await derivarClave("contraseña-larga", sal, 1000), s = await sellar(k, { a: 1 });
    await expect(abrirSello(await derivarClave("otra-contraseña", sal, 1000), s)).rejects.toThrow();
    await expect(abrirSello(await derivarClave("contraseña-larga", new Uint8Array(16).fill(8), 1000), s)).rejects.toThrow();
    const alterado = { ...s, datos: s.datos.slice() }; alterado.datos[0] = alterado.datos[0]! ^ 1;
    await expect(abrirSello(k, alterado)).rejects.toThrow();
  });
  it("cada cifrado usa un vector distinto: el mismo dato no produce el mismo texto", async () => {
    const k = await derivarClave("contraseña-larga", sal, 1000);
    const [a, b] = [await sellar(k, "x"), await sellar(k, "x")];
    expect(a.iv).not.toEqual(b.iv);
    expect(a.datos).not.toEqual(b.datos);
  });
});
