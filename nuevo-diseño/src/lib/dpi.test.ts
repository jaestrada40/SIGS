import { describe, expect, it } from "vitest";
import { digitoIcao, interpretarDpi, leerMrz, repararCui, validarCui } from "./dpi";

// Todos los datos son inventados. La estructura sí es la de un DPI real: el CUI de 13 dígitos (8 de número + verificador + 2 de
// departamento + 2 de municipio), una franja de lectura automática de 3 líneas y las etiquetas del documento.
const CUI = "2048173580301";   // 20481735 + verificador 8 + departamento 03 (Sacatepéquez) + municipio 01
const GEO = {
  Escuintla: ["Escuintla", "San José"], Guatemala: ["Guatemala", "Mixco"], Petén: ["Flores", "San José"],
  Sacatepéquez: ["Alotenango", "Antigua Guatemala", "Jocotenango"], "San Marcos": ["San Marcos", "Tacaná"],
};
const relleno = (s: string, n = 30) => s.padEnd(n, "<");

/** Franja de lectura como la del DPI: en la línea 1 el dígito de control de la franja queda ENTRE los 9 primeros dígitos del CUI y los 4 del lugar. */
function mrz({ cui = CUI, nacimiento = "900106", sexo = "M", linea3 = "GOMEZ<<LUIS" } = {}) {
  const doc = cui.slice(0, 9);
  const l1 = relleno(`IDGTM${doc}${digitoIcao(doc)}${cui.slice(9)}S0301<<<224`);
  const l2 = relleno(`${nacimiento}${digitoIcao(nacimiento)}${sexo}3102215GTM<<963923818`).slice(0, 29) + "6";
  return [l1, l2, relleno(linea3)].join("\n");
}
const FRENTE = `REPÚBLICA DE GUATEMALA, CENTROAMÉRICA
Registro Nacional de las Personas - Documento Personal de Identificación -DPI-
CÓDIGO UNICO DE IDENTIFICACIÓN
2048 17358 0301
NOMBRE:
LUIS
FERNANDO
APELLIDO:
GÓMEZ
PÉREZ
NACIONALIDAD: GTM
SEXO:
MASCULINO
FECHA DE NACIMIENTO:
06ENE1990
22FEB2021`;
const REVERSO = `LUGAR DE NACIMIENTO:
SACATEPEQUEZ
ANTIGUA GUATEMALA
VECINDAD:
SACATEPEQUEZ
ANTIGUA GUATEMALA
ESTADO CIVIL: SOLTERO
FECHA DE VENCIMIENTO: 21FEB2031
${mrz()}`;
const HOY = new Date("2026-10-25");

describe("CUI (número de DPI)", () => {
  it("el número de prueba es válido y los códigos de lugar se leen bien", () => {
    expect(validarCui(CUI)).toMatchObject({ valido: true, departamentoCodigo: 3 });
  });
  it("rechaza dígito verificador distinto, departamento inexistente y largo incorrecto", () => {
    expect(validarCui(CUI.slice(0, 8) + "9" + CUI.slice(9)).valido).toBe(false);
    expect(validarCui(CUI.slice(0, 9) + "30" + "30")).toMatchObject({ valido: false, motivo: "el código de departamento no existe" });
    expect(validarCui("12345").valido).toBe(false);
  });
  it("corrige un dígito mal leído solo si la corrección es única (y nunca devuelve un número que no valide)", () => {
    let reparadas = 0;
    for (let i = 0; i < 13; i++) for (const d of "0123456789") {
      if (d === CUI[i]) continue;
      const mal = CUI.slice(0, i) + d + CUI.slice(i + 1);
      const r = repararCui(mal);
      if (r === null) continue;
      expect(validarCui(r).valido).toBe(true);
      expect([...mal].filter((c, k) => c !== r[k]).length).toBe(1);   // cambia exactamente un dígito
      if (r === CUI) reparadas++;
    }
    expect(reparadas).toBeGreaterThan(0);
    expect(repararCui("abc")).toBeNull();
  });
});

describe("franja de lectura (MRZ)", () => {
  it("arma el CUI con la estructura real: 9 dígitos + (control) + 4 del lugar; NO 13 dígitos seguidos", () => {
    const l = mrz().split("\n")[0]!;
    const trece = l.slice(5, 18);   // lo que tomaría un lector ingenuo: incluye el dígito de control y corta el lugar
    expect(validarCui(trece).valido).toBe(false);
    expect(leerMrz([mrz()]).cui).toBe(CUI);
  });
  it("lee nombre, sexo y nacimiento verificado con su dígito de control", () => {
    expect(leerMrz([mrz()])).toMatchObject({ cui: CUI, nombre: "LUIS GOMEZ", sexo: "M", nacimiento: "1990-01-06", nacimientoVerificado: true });
  });
  it("descarta el ruido de los «<» que el OCR lee como K, L…", () => {
    const sucio = mrz({ linea3: "GOMEZL<KLUIS<KLLLLLLLLLLLKLKLK" });
    expect(leerMrz([sucio]).piezasNombre).toEqual(["KLUIS", "GOMEZL"]);
  });
  it("tolera letras en lugar de dígitos en la zona numérica", () => {
    const l = mrz().split("\n"); l[1] = l[1]!.replace("900106", "9OO1O6");
    expect(leerMrz([l.join("\n")]).nacimiento).toBe("1990-01-06");
  });
  it("sexo femenino y un nacimiento del siglo XXI", () => {
    expect(leerMrz([mrz({ sexo: "F", nacimiento: "150210" })])).toMatchObject({ sexo: "F", nacimiento: "2015-02-10", nacimientoVerificado: true });
  });
  it("una línea 1 con un dígito de control que no cuadra no se usa para el CUI", () => {
    const l = mrz().split("\n"); l[0] = l[0]!.replace(CUI.slice(0, 9), "204817359");
    expect(leerMrz([l.join("\n")]).cui).toBeUndefined();
  });
});

describe("interpretarDpi", () => {
  it("con frente y reverso que coinciden, todo queda verificado y contra el catálogo", () => {
    const r = interpretarDpi([FRENTE, REVERSO], GEO, HOY);
    expect(r.dpi).toMatchObject({ valor: CUI, estado: "verificado" });
    expect(r.nombreCompleto).toMatchObject({ valor: "Luis Fernando Gómez Pérez", estado: "verificado" });
    expect(r.sexo).toMatchObject({ valor: "M", estado: "verificado" });
    expect(r.fechaNacimiento).toMatchObject({ valor: "1990-01-06", estado: "verificado" });
    expect(r.departamento).toMatchObject({ valor: "Sacatepéquez", estado: "verificado" });
    expect(r.municipio).toMatchObject({ valor: "Antigua Guatemala", estado: "verificado" });
  });

  it("con una sola cara no se inventa lo que no está", () => {
    expect(interpretarDpi(["TEXTO SIN SENTIDO F M 1234"], GEO)).toEqual({});
  });

  it("solo con el frente: lee lo que hay, pero nada sale «verificado» salvo el número (que tiene dígito verificador)", () => {
    const r = interpretarDpi([FRENTE], GEO, HOY);
    expect(r.dpi?.estado).toBe("verificado");
    expect(r.nombreCompleto?.estado).toBe("revisar");
    expect(r.fechaNacimiento?.estado).toBe("revisar");
    expect(r.sexo?.estado).toBe("revisar");
    expect(r.departamento?.valor).toBe("Sacatepéquez");   // por el código del DPI, a revisar
    expect(r.departamento?.estado).toBe("revisar");
  });

  it("nombre sin etiquetas legibles (NOMBRE/APELLIDO son muy pequeñas): se reconoce por su posición", () => {
    const sin = `REPÚBLICA DE GUATEMALA, CENTROAMÉRICA\nRegistro Nacional de las Personas\n2048 17358 0301\nUATEMALA, CENTROAMÉRICA A\nDocumento Personal de Identificación -DPI-\nLUIS\nFERNANDO\nGÓMEZ\nPÉREZ\n=\nGTM GTM\nMASCULINO`;
    expect(interpretarDpi([sin], GEO).nombreCompleto?.valor).toBe("Luis Fernando Gómez Pérez");
  });

  it("un título deformado por el OCR («Codig Rondicode Dentif») no se cuela en el nombre", () => {
    const frente = FRENTE.replace("CÓDIGO UNICO DE IDENTIFICACIÓN\n2048 17358 0301", "2048 17358 0301\nCodig Rondicode Dentif\nCODIG RONDICODE DENTIF").replace("NOMBRE:\n", "").replace("APELLIDO:\n", "");
    const r = interpretarDpi([frente, REVERSO], GEO, HOY);   // con la franja, aun un título en mayúsculas queda fuera: el nombre empieza en LUIS
    expect(r.nombreCompleto).toMatchObject({ valor: "Luis Fernando Gómez Pérez", estado: "verificado" });
    // sin franja solo se puede descartar el título que el OCR dejó en minúsculas y mayúsculas mezcladas
    const soloMinusculas = frente.replace("\nCODIG RONDICODE DENTIF", "");
    expect(interpretarDpi([soloMinusculas], GEO, HOY).nombreCompleto?.valor).toBe("Luis Fernando Gómez Pérez");
  });

  it("ruido de dos letras en minúsculas junto a las etiquetas no se cuela en el nombre", () => {
    const frente = "NOMBRE:\nHi Rs Ll\nLUIS\nFERNANDO\nAPELLIDO:\nGÓMEZ\nPÉREZ\nDa\nSEXO: MASCULINO";
    expect(interpretarDpi([frente, REVERSO], GEO, HOY).nombreCompleto?.valor).toBe("Luis Fernando Gómez Pérez");
  });

  it("el frente no trae lugar: el encabezado «REPÚBLICA DE GUATEMALA» y «FECHA DE NACIMIENTO» no producen un departamento ni un municipio inventados", () => {
    const r = interpretarDpi([FRENTE], GEO, HOY);
    expect(r.municipio).toBeUndefined();
    expect(r.departamento).toMatchObject({ valor: "Sacatepéquez", estado: "revisar" });   // solo por el código del número
    const desordenado = "FECHA DE NACIMIENTO:\nREPÚBLICA DE GUATEMALA, CENTROAMÉRICA\n06ENE1990";
    expect(interpretarDpi([desordenado], GEO, HOY).departamento).toBeUndefined();
  });

  it("nombre cuando el número y el primer nombre quedan en la misma línea, y varias pasadas incompletas", () => {
    const a = "2048 17358 0301 LUIS\nFERNANDO\nGÓMEZ\nPÉREZ\nIA INALIDAD:\nGTM\nMASCULINO";
    const b = "CÓDIGO UNICO DE IDENTIFICACIÓN\n2048 17358 0301\nGÓMEZ\nPÉREZ\nMASCULINO";   // esta pasada perdió los nombres de pila
    expect(interpretarDpi([b, a, b], GEO).nombreCompleto?.valor).toBe("Luis Fernando Gómez Pérez");
  });

  it("la fecha de la franja (con dígito de control) manda aunque el OCR lea el frente con letras por dígitos", () => {
    const frenteSucio = FRENTE.replace("06ENE1990", "OSENE1990");   // el 6 leído como S: sin la franja daría el día 5, un error silencioso
    const r = interpretarDpi([frenteSucio, REVERSO], GEO, HOY);
    expect(r.fechaNacimiento).toMatchObject({ valor: "1990-01-06", estado: "verificado" });
  });

  it("sin la franja, una fecha con letras por dígitos queda por revisar y avisa", () => {
    const r = interpretarDpi([FRENTE.replace("06ENE1990", "OSENE1990")], GEO, HOY);
    expect(r.fechaNacimiento?.estado).toBe("revisar");
    expect(r.fechaNacimiento?.nota).toContain("confundió letras con números");
  });

  it("el sexo sale solo de una etiqueta, de la palabra completa o de la franja, no de una F suelta", () => {
    expect(interpretarDpi(["F NOMBRE F\nSexo: M"], GEO).sexo?.valor).toBe("M");
    expect(interpretarDpi(["ALGO F ALGO M"], GEO).sexo).toBeUndefined();
    expect(interpretarDpi(["GTM\nFEMENINO\nGTM"], GEO).sexo?.valor).toBe("F");
  });

  it("un DPI que no valida queda por revisar y no se presenta como verificado", () => {
    const r = interpretarDpi(["CUI 2048 17358 3030"], GEO);   // verificador bien, lugar imposible (departamento 30)
    expect(r.dpi?.estado).toBe("revisar");
    expect(r.dpi?.nota).toContain("código de departamento");
  });

  it("repara un dígito mal leído cuando la corrección es única, pero lo deja por revisar", () => {
    const mal = [...Array(13).keys()].flatMap((i) => [..."0123456789"].filter((d) => d !== CUI[i]).map((d) => CUI.slice(0, i) + d + CUI.slice(i + 1))).find((c) => repararCui(c) === CUI)!;
    const r = interpretarDpi([`CUI ${mal}`], GEO);
    expect(r.dpi).toMatchObject({ valor: CUI, estado: "revisar" });
    expect(r.dpi?.nota).toContain("Se corrigió");
  });

  it("fecha: toma la etiquetada de nacimiento y no la de vencimiento ni una futura", () => {
    const t = "FECHA DE NACIMIENTO 04/05/1990\nVENCIMIENTO 04/05/2030\nEMISION 10/10/2020";
    expect(interpretarDpi([t], GEO, HOY).fechaNacimiento?.valor).toBe("1990-05-04");
    expect(interpretarDpi(["Fecha de nacimiento: 31/02/1990"], GEO).fechaNacimiento).toBeUndefined();   // día imposible
    expect(interpretarDpi(["Fecha de nacimiento: 04/05/2090"], GEO, HOY).fechaNacimiento).toBeUndefined();   // futura
  });

  it("lugar: la etiqueta de vecindad mal leída («VECINDA(») no impide encontrarlo, y «Antigua Guatemala» no se confunde con «Guatemala»", () => {
    const r = interpretarDpi(["INTO:\nSACATEPEQUEZ\nANTIGUA GUATEMALA\nL:82 F:303 P:190\nVECINDA(\nSACATEPEQUEZ\nANTIGUA GUATEMALA"], GEO);
    expect(r.municipio).toMatchObject({ valor: "Antigua Guatemala", estado: "verificado" });
    expect(r.departamento).toMatchObject({ valor: "Sacatepéquez", estado: "verificado" });
  });

  it("lugar sin ninguna etiqueta legible: se propone, pero por revisar y avisando", () => {
    const r = interpretarDpi(["SACATEPEQUEZ\nANTIGUA GUATEMALA\nSOLTERO"], GEO);
    expect(r.municipio).toMatchObject({ valor: "Antigua Guatemala", estado: "revisar" });
    expect(r.municipio?.nota).toContain("No se leyó la etiqueta");
  });

  it("si la vecindad y el lugar de nacimiento difieren, gana la vecindad", () => {
    const r = interpretarDpi(["LUGAR DE NACIMIENTO:\nSAN MARCOS\nTACANA\nVECINDAD:\nPETEN\nFLORES"], GEO);
    expect(r.departamento?.valor).toBe("Petén");
    expect(r.municipio?.valor).toBe("Flores");
  });

  it("municipio repetido en el catálogo: se resuelve con el departamento del texto o el del número", () => {
    expect(interpretarDpi(["VECINDAD\nSAN JOSE\nPETEN"], GEO)).toMatchObject({ departamento: { valor: "Petén" }, municipio: { valor: "San José" } });
    const cui05 = (() => { const n = "20000000"; for (let d = 0; d < 10; d++) { const c = `${n}${d}0501`; if (validarCui(c).valido) return c; } return ""; })();
    const r = interpretarDpi([`CUI ${cui05}`, "VECINDAD\nSAN JOSE"], GEO);
    expect(r.municipio?.valor).toBe("San José");
    expect(r.departamento?.valor).toBe("Escuintla");
  });

  it("tolera errores del OCR en el nombre del municipio, pero lo deja por revisar", () => {
    const r = interpretarDpi(["VECINDAD\nALOTENANCO\nSACATEPEQUEZ"], GEO);
    expect(r.municipio).toMatchObject({ valor: "Alotenango", estado: "revisar" });
  });

  it("sin catálogo (por ejemplo al buscar un paciente por DPI) no intenta leer el lugar", () => {
    const r = interpretarDpi([FRENTE, REVERSO]);
    expect(r.departamento).toBeUndefined();
    expect(r.dpi?.valor).toBe(CUI);
  });

  it("una línea que es solo un lugar (p. ej. el lugar de nacimiento) no se toma como nombre", () => {
    const atras = `LUGAR DE NACIMIENTO\nSACATEPEQUEZ\nANTIGUA GUATEMALA\nMUNICIPIO\n${mrz({ linea3: "" })}`;
    const l = interpretarDpi([atras], GEO);
    expect(l.nombreCompleto?.valor ?? "").not.toMatch(/Sacatepequez|Antigua/i);
  });
  it("si el nombre del frente es un lugar, se usa el de la franja de lectura", () => {
    const l = interpretarDpi([`NOMBRE:\nSACATEPEQUEZ\nANTIGUA\nGUATEMALA\n${mrz()}`], GEO);
    expect(l.nombreCompleto?.valor).toBe("Luis Gomez");
  });
  it("una «S» en el día se lee como 5 pero se avisa que también podría ser 6", () => {
    const l = interpretarDpi(["FECHA DE NACIMIENTO\nOSENE1978"], GEO, new Date("2026-10-24"));
    expect(l.fechaNacimiento).toMatchObject({ valor: "1978-01-05", estado: "revisar" });
    expect(l.fechaNacimiento?.nota).toContain("06/01/1978");
  });
});
