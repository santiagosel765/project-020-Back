export interface CuadroFirmaDB {
  id: number;
  titulo: string;
  descripcion: string;
  version: string;
  nombre_pdf: string;
  codigo: string;
  empresa_id: number;
  created_by: number;
  add_date?: Date;
  progress?: number;
  diasTranscurridosDocumento?: number;
  user: {
    id: number;
    primer_nombre: string;
    segundo_name: string;
    tercer_nombre: string;
    primer_apellido: string;
    segundo_apellido: string;
    apellido_casada: string;
    correo_institucional: string;
    gerencia: { id: number; nombre: string };
    posicion: { id: number; nombre: string };
  };
  estado_firma: {
    nombre: string;
    descripcion: string;
  };
  cuadro_firma_estado_historial: Array<{
    observaciones: string;
    fecha_observacion: Date;
    updated_at: Date;
    user: any;
    estado_firma: any;
  }>;
  cuadro_firma_user: Array<{
    estaFirmado: boolean | null;
    fecha_firma: Date | null;
    diasTranscurridos?: number;
    user: {
      id: number;
      primer_nombre: string;
      segundo_name: string;
      tercer_nombre: string;
      primer_apellido: string;
      segundo_apellido: string;
      apellido_casada: string;
      correo_institucional: string;
      codigo_empleado: string;
      gerencia: { id: number; nombre: string };
      posicion: { id: number; nombre: string };
    };
    responsabilidad_firma: {
      id: number;
      nombre: string;
      orden: number | null;
    };
  }>;
}
