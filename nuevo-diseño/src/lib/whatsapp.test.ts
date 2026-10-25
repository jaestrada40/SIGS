import { describe, expect, it } from "vitest";
import { enlaceWhatsApp } from "./whatsapp";

describe("enlaceWhatsApp", () => {
  it("antepone 502 a un número de 8 dígitos y codifica el texto", () => {
    expect(enlaceWhatsApp("5512-3456", "Hola & adiós")).toBe("https://wa.me/50255123456?text=Hola%20%26%20adi%C3%B3s");
  });
  it("acepta el número ya con 502 y rechaza lo que no es un teléfono", () => {
    expect(enlaceWhatsApp("+502 5512 3456", "x")).toContain("wa.me/50255123456");
    for (const mal of [null, undefined, "", "123", "5512345678"]) expect(enlaceWhatsApp(mal, "x")).toBeNull();
  });
});
