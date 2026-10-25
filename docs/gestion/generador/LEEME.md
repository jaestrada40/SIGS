# Generador de los documentos de gestión

Los documentos `02` a `04`, la parte A del `01` y el Word IEEE se generan con estos scripts para que los números (ruta crítica, PERT, valor ganado, reservas) nunca se transcriban a mano.

**Para recalcular con datos reales:** edita en `plan.py` la lista `EDT` (horas planificadas, fechas y % de avance), `ACT` (duraciones y predecesoras) y, cuando tengas las horas reales, agrega el costo real (AC) para calcular CPI y EAC. Luego, desde esta carpeta:

```bash
python3 plan.py        # calcula plan.json (EDT, PDM, CPM, PERT, valor ganado)
python3 gen_03_04.py   # interesados, comunicaciones, riesgos y calidad (genera reserva.json)
python3 gen_02.py      # EDT, cronograma y costos
python3 gen_01.py      # parte A del acta
python3 figs.py        # genera fig/f.html con las 4 figuras (SVG)
python3 gen_docx.py    # arma el Word IEEE (necesita python-docx y las PNG de figuras/)
```

Las PNG de `figuras/` salen de abrir `fig/f.html` en un navegador y capturar cada figura (`#edt`, `#pdm`, `#gantt`, `#poder`). `gen_docx.py` y `gen_01.py` escriben en rutas absolutas del proyecto; ajústalas si mueves la carpeta. `gen_docx.py` necesita que exista `fig/` o se cambie `FIG`; aquí apunta a `figuras/`.
