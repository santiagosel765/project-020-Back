

export interface CuadroFirmaDB  {
  id: number,
  titulo: string,
  descripcion: string,
  version: string,
  nombre_pdf: string,
  codigo: string,
  empresa_id: number,
  created_by: number,
  user: {
    id: number,
    primer_nombre: string,
    segundo_name: string,
    tercer_nombre: string,
    primer_apellido: string,
    segundo_apellido: string,
    apellido_casada: string,
    correo_institucional: string,
    gerencia: { id: number, nombre: string },
    posicion: { id: number, nombre: string }
  },
  estado_firma: {
    nombre: string,
    descripcion: string
  },
  cuadro_firma_estado_historial: Array<{
    observaciones: string,
    fecha_observacion: Date,
    updated_at: Date,
    user: any, // según tu modelo
    estado_firma: any // según tu modelo
  }>,
  cuadro_firma_user: Array<{
    user: {
      id: number,
      primer_nombre: string,
      segundo_name: string,
      tercer_nombre: string,
      primer_apellido: string,
      segundo_apellido: string,
      apellido_casada: string,
      correo_institucional: string,
      gerencia: { id: number, nombre: string },
      posicion: { id: number, nombre: string }
    },
    responsabilidad_firma: {
      id: number,
      nombre: string
    }
  }>
}