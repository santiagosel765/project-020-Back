// export interface YaloDocumentNotificationPayload {
//   type: string;
//   users: User[];
// }

// export interface User {
//   priority: string;
//   phone: string;
//   params: Params;
// }

// export interface Params {
//   responsable: string;
//   nombre_documento: string;
//   estado: string;
//   fecha_hora: string;
//   content: string;
// }

// ? {"type":"firmas_notificacion","users":[{"priority":"<priority>","phone":"+<phone>","params":{"responsable":"<responsable>","nombre_documento":"<nombre_documento>","estado":"<estado>","fecha_hora":"<fecha_hora>"}}]}


export interface YaloDocumentNotificationPayload {
  type:  string;
  users: User[];
}

export interface User {
  priority: string;
  phone:    string;
  params:   Params;
}

export interface Params {
  responsable:      string;
  nombre_documento: string;
  estado:           string;
  fecha:            string;
  buttons:          Button[];
}

export interface Button {
  sub_type:   string;
  index:      number;
  parameters: Parameter[];
}

export interface Parameter {
  text: string;
}
