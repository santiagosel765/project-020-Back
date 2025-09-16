export function slugNombre(v: string) {
  return (v || '').trim().replace(/\s+/g, '_'); // igual a la generación actual
}

type Item = {
  userId: number;
  nombre: string;
  puesto?: string;
  gerencia?: string;
};

export function generarFilasFirmas(
  items: Item[] | Item | undefined,
  rol: 'REVISA' | 'APRUEBA',
  etiquetaIzquierda: string // 'Revisado por:' | 'Aprobado por:'
): string {
  const arr = Array.isArray(items) ? items : items ? [items] : [];

  return arr.map((it) => {
    const nombre = it?.nombre || '';
    const puesto = it?.puesto || '';
    const gerencia = it?.gerencia || '';

    // ✅ Solo la FECHA queda como placeholder (ancla para firmar)
    const fechaToken = `FECHA_${rol}_${slugNombre(nombre || rol)}`;

    return `
<tr>
  <td style="width:92px;padding:6px 4px;"><b>${etiquetaIzquierda}</b></td>
  <td style="padding:6px 4px;">${nombre}</td>
  <td style="padding:6px 4px;">${puesto}</td>
  <td style="padding:6px 4px;">${gerencia}</td>
  <td style="padding:6px 4px;"></td>
  <td style="padding:6px 4px;">${fechaToken}</td>
</tr>`;
  }).join('');
}
