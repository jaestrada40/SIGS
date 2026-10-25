import { describe, expect, it } from "vitest";
import { mapearFilas, normalizarFecha, parseCSV } from "./csv";

describe("CSV de importación", () => {
  it("convierte fechas dd/mm/aaaa a aaaa-mm-dd", () => {
    expect(normalizarFecha("05/03/1990")).toBe("1990-03-05");
    expect(normalizarFecha("31/02/2020")).toBeNull();
  });

  it("acepta punto y coma como separador", () => {
    expect(parseCSV("a;b\n1;2")).toEqual([["a", "b"], ["1", "2"]]);
  });

  it("numera errores contando el encabezado como fila 1", () => {
    const { errores } = mapearFilas([["nombreCompleto", "sexo"], ["Ana", "F"], ["", "X"]], [
      { clave: "nombreCompleto", requerida: true },
      { clave: "sexo", requerida: true, opciones: ["F", "M", "NE"] },
    ]);
    expect(errores.map((e) => e.fila)).toEqual([3, 3]);
  });

  it("rechaza más de 1,000 filas", () => {
    const filas = [["nombreCompleto"], ...Array.from({ length: 1001 }, () => ["x"])];
    expect(mapearFilas(filas, [{ clave: "nombreCompleto", requerida: true }]).errores).toHaveLength(1);
  });
});
