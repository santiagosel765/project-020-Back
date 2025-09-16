import { FirmanteUserDto } from '../dto/create-cuadro-firma.dto';

function htmlEscape(s: string): string {
  // Evita inyectar HTML en nombres/puestos/gerencias
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function generarFilasFirmas(
  firmantes: FirmanteUserDto[] | undefined,
  tipo: 'APRUEBA' | 'REVISA',
  labelPrimeraFila: string,
): string {
  const filas =
    Array.isArray(firmantes) && firmantes.length > 0 ? firmantes : [undefined];

  return filas
    .map((f, index) => {
      const rowLabel = index === 0 ? labelPrimeraFila : '';
      const nombre = (f?.nombre ?? '').trim();
      const puesto = f?.puesto ?? '';
      const gerencia = f?.gerencia ?? '';

      const slug = nombre ? nombre.replace(/\s+/g, '_') : tipo;

      const cellNombre = nombre ? htmlEscape(nombre) : `NOMBRE_${tipo}_${slug}`;
      const cellPuesto = puesto ? htmlEscape(puesto) : `PUESTO_${tipo}_${slug}`;
      const cellGerencia = gerencia
        ? htmlEscape(gerencia)
        : `GERENCIA_${tipo}_${slug}`;
      const cellFecha = `FECHA_${tipo}_${slug}`;

      return `
<tr class="tr-firmas">
  <td class="row-label">${htmlEscape(rowLabel)}</td>
  <td>${cellNombre}</td>
  <td>${cellPuesto}</td>
  <td>${cellGerencia}</td>
  <td class="td-firma"></td>
  <td>${cellFecha}</td>
</tr>`.trim();
    })
    .join('');
}
