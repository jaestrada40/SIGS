import re
import os
DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..') + '/'   # carpeta docs/gestion
def tables(path):
    L = open(path, encoding='utf-8').read().split('\n'); out = []; i = 0; prev = ''
    while i < len(L):
        if L[i].startswith('|') and i + 1 < len(L) and re.match(r'^\|[\s:|-]+\|$', L[i + 1]):
            hdr = [c.strip() for c in L[i].strip('|').split('|')]; rows = []; j = i + 2
            while j < len(L) and L[j].startswith('|'):
                rows.append([c.strip() for c in re.split(r'(?<!\\)\|', L[j].strip()[1:-1])]); j += 1
            out.append({'caption': prev.strip(), 'header': hdr, 'rows': rows}); i = j
        else:
            if L[i].strip(): prev = L[i]
            i += 1
    return out
if __name__ == '__main__':
    G = DIR
    for f in ['01_acta_y_alcance.md', '02_edt_cronograma_costos.md', '03_interesados_comunicaciones.md', '04_riesgos_calidad.md', '05_apendice_declaracion_ia.md']:
        for n, t in enumerate(tables(G + f)): print(f[:2], n, len(t['header']), 'x', len(t['rows']), '|', t['caption'][:60], '|', t['header'][:3])
