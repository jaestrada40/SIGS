import { describe, expect, it } from "vitest";
import { aCSV } from "./exportar";

describe("exportar CSV", () => {
  it("incluye encabezado y una fila por registro filtrado", () => {
    const csv = aCSV([{ n: "Ana" }, { n: "Luis" }], [{ titulo: "nombre", valor: (f) => f.n }]);
    expect(csv.trim().split("\r\n")).toEqual(["nombre", "Ana", "Luis"]);
  });
  it("entrecomilla valores con coma o comillas", () => {
    expect(aCSV([{ n: 'Mixco, "zona 1"' }], [{ titulo: "x", valor: (f) => f.n }])).toContain('"Mixco, ""zona 1"""');
  });
});
