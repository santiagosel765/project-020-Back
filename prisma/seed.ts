import { PrismaClient, type user } from '../generated/prisma';
import { BcryptAdapter } from '../src/auth/adapters/bcrypt.adapter';

const prisma = new PrismaClient();

/* ----------------------------- utilidades -------------------------------- */

// Resetea la secuencia (id) de una tabla dada (public.<table>, columna id)
async function resetIdSequence(table: string) {
  // Usa pg_get_serial_sequence para no depender del nombre físico de la secuencia
  const schemaTable = `public."${table}"`;
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('${schemaTable}', 'id'), 1, false);`,
  );
}

// Limpia tablas (deleteMany) respetando FK y luego reinicia su secuencia
async function clearTableAndResetSeq(table: string, deleter: () => Promise<any>) {
  await deleter();
  await resetIdSequence(table);
}

async function upsertRole(nombre: string) {
  return prisma.rol.upsert({
    where: { nombre },
    update: { activo: true },
    create: { nombre, activo: true },
  });
}

async function upsertPage(data: { nombre: string; url: string; icon: string; order: number }) {
  return prisma.pagina.upsert({
    where: { nombre: data.nombre },
    update: { url: data.url, icon: data.icon, order: data.order, activo: true },
    create: { nombre: data.nombre, url: data.url, icon: data.icon, order: data.order, activo: true },
  });
}

async function getPagesByUrls(urls: string[]) {
  return prisma.pagina.findMany({
    where: { url: { in: urls } },
    select: { id: true },
  });
}

async function setRolePagesByUrls(rolId: number, urls: string[]) {
  const pages = await getPagesByUrls(urls);
  const pageIds = pages.map((p) => p.id);
  if (pageIds.length === 0) return;

  const existing = await prisma.pagina_rol.findMany({
    where: { rol_id: rolId, pagina_id: { in: pageIds } },
    select: { pagina_id: true },
  });
  const existingIds = new Set(existing.map((e) => e.pagina_id));
  const missing = pageIds.filter((id) => !existingIds.has(id));

  if (missing.length > 0) {
    await prisma.pagina_rol.createMany({
      data: missing.map((pagina_id) => ({ rol_id: rolId, pagina_id })),
      skipDuplicates: true,
    });
  }
}

async function ensureCatalogValue<T extends 'gerencia' | 'posicion' | 'empresa'>(
  table: T,
  nombre: string,
) {
  if (table === 'gerencia') {
    return prisma.gerencia.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre, activo: true },
    });
  }
  if (table === 'posicion') {
    return prisma.posicion.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre, activo: true },
    });
  }
  // empresa
  return prisma.empresa.upsert({
    where: { nombre },
    update: { activo: true },
    create: { nombre, activo: true },
  });
}

async function findFirstId(table: 'gerencia' | 'posicion', fallbackName?: string) {
  if (table === 'gerencia') {
    const g = await prisma.gerencia.findFirst({ select: { id: true }, where: { activo: true } });
    if (g) return g.id;
    if (fallbackName) {
      const g2 = await ensureCatalogValue('gerencia', fallbackName);
      return g2.id;
    }
  }
  if (table === 'posicion') {
    const p = await prisma.posicion.findFirst({ select: { id: true }, where: { activo: true } });
    if (p) return p.id;
    if (fallbackName) {
      const p2 = await ensureCatalogValue('posicion', fallbackName);
      return p2.id;
    }
  }
  return null;
}

/* ------------------------------- páginas ---------------------------------- */

const PAGES_DATA: Array<{ nombre: string; url: string; icon: string; order: number }> = [
  { nombre: 'Asignaciones',           url: '/admin/asignaciones',   icon: 'ClipboardList',    order: 1  },
  { nombre: 'Documentos',             url: '/admin/documentos',     icon: 'FileText',         order: 2  },
  { nombre: 'Mis Documentos',         url: '/admin/mis-documentos', icon: 'FolderOpen',       order: 3  },
  { nombre: 'Usuarios',               url: '/admin/usuarios',       icon: 'Users',            order: 4  },
  { nombre: 'Roles',                  url: '/admin/roles',          icon: 'Shield',           order: 5  },
  { nombre: 'Páginas',                url: '/admin/page',           icon: 'LayoutDashboard',  order: 6  },
  { nombre: 'Permisos',               url: '/admin/permission',     icon: 'KeyRound',         order: 7  },
  { nombre: 'Supervisión',            url: '/admin/supervision',    icon: 'Eye',              order: 8  },
  { nombre: 'Mis Documentos General', url: '/general',              icon: 'Folder',           order: 9  },
  { nombre: 'Detalle Documento',      url: '/documento/[id]',       icon: 'FileSearch',       order: 10 },
];

const ADMIN_URLS   = PAGES_DATA.map((p) => p.url);
const GESTOR_URLS  = ['/general', '/admin/mis-documentos', '/admin/documentos', '/admin/asignaciones', '/admin/supervision'];
const REVISOR_URLS = ['/general', '/admin/mis-documentos', '/admin/supervision'];
const APROBADOR_URLS = ['/general', '/admin/mis-documentos'];
const USUARIO_URLS = ['/general'];

/* ------------------------------- seed ------------------------------------- */

async function main() {
  console.log('⏳ Limpiando tablas y reiniciando secuencias…');

  // 1) Limpieza de datos (transaccional) respetando FK
  //    ⚠️ No tocamos catálogos: empresa, gerencia, posicion, responsabilidad_firma, estado_firma, plantilla, pagina
  await prisma.$transaction([
    prisma.notificacion_user.deleteMany({}),
    prisma.notificacion.deleteMany({}),
    prisma.cuadro_firma_estado_historial.deleteMany({}),
    prisma.documento.deleteMany({}),
    prisma.cuadro_firma_user.deleteMany({}),
    prisma.cuadro_firma.deleteMany({}),
    prisma.rol_usuario.deleteMany({}),
    prisma.pagina_rol.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

  // 2) Reiniciar secuencias de las tablas limpiadas
  const resetTables = [
    'notificacion_user',
    'notificacion',
    'cuadro_firma_estado_historial',
    'documento',
    // cuadro_firma es compuesta por datos + relaciones, pero su PK es id
    'cuadro_firma',
    'pagina_rol',   // aunque la pk es compuesta, no pasa nada con setval si no existe; lo ignorará
    'rol_usuario',  // igual, pk compuesta
    'user',
  ];
  for (const t of resetTables) {
    try {
      await resetIdSequence(t);
    } catch {
      // Para tablas con PK compuesta (sin secuencia) no hacemos nada
    }
  }

  console.log('✔ Limpieza y secuencias listas');

  // 3) Asegurar catálogos mínimos (por si la BD está vacía)
  const empresa = await ensureCatalogValue('empresa', 'Fundación Génesis Empresarial');

  const gerenciaId =
    (await findFirstId('gerencia')) ??
    (await ensureCatalogValue('gerencia', 'Dirección General')).id;

  const posicionIdAdmin =
    (await findFirstId('posicion')) ??
    (await ensureCatalogValue('posicion', 'CEO')).id;

  const posicionIdMgr = (await ensureCatalogValue('posicion', 'Gerente')).id;
  const posicionIdAnalyst = (await ensureCatalogValue('posicion', 'Analista')).id;

  // 4) ROLES
  const roles = {
    ADMIN:     await upsertRole('ADMIN'),
    GESTOR:    await upsertRole('GESTOR'),
    REVISOR:   await upsertRole('REVISOR'),
    APROBADOR: await upsertRole('APROBADOR'),
    USUARIO:   await upsertRole('USUARIO'),
  };

  // 5) PÁGINAS + permisos
  for (const page of PAGES_DATA) await upsertPage(page);

  await setRolePagesByUrls(roles.ADMIN.id, ADMIN_URLS);
  await setRolePagesByUrls(roles.GESTOR.id, GESTOR_URLS);
  await setRolePagesByUrls(roles.REVISOR.id, REVISOR_URLS);
  await setRolePagesByUrls(roles.APROBADOR.id, APROBADOR_URLS);
  await setRolePagesByUrls(roles.USUARIO.id, USUARIO_URLS);

  // 6) Usuarios
  type SeedUser = {
    correo: string;
    codigo: string;
    pass: string;
    nombres: { p: string; s?: string | null; t?: string | null };
    apellidos: { p: string; s?: string | null; casada?: string | null };
    telefono?: string | null;
    posicion_id?: number | null;
    gerencia_id?: number | null;
    roles: Array<keyof typeof roles>;
  };

  const usersBase: SeedUser[] = [
    {
      correo: 'admin@local.com',
      codigo: 'ADMIN',
      pass: 'Admin!123',
      nombres: { p: 'Admin', s: 'Super' },
      apellidos: { p: 'User' },
      telefono: '+502 5555 0001',
      posicion_id: posicionIdAdmin,
      gerencia_id: gerenciaId,
      roles: ['ADMIN'],
    },
    {
      correo: 'gestor@local.com',
      codigo: 'GESTOR1',
      pass: 'Gestor!123',
      nombres: { p: 'María', s: 'Alejandra' },
      apellidos: { p: 'Ramírez', s: 'González' },
      telefono: '+502 5555 0002',
      posicion_id: posicionIdMgr,
      gerencia_id: gerenciaId,
      roles: ['GESTOR'],
    },
    {
      correo: 'revisor@local.com',
      codigo: 'REV001',
      pass: 'Revisor!123',
      nombres: { p: 'Carlos', s: 'Enrique' },
      apellidos: { p: 'Díaz', s: 'Morales' },
      telefono: '+502 5555 0003',
      posicion_id: posicionIdAnalyst,
      gerencia_id: gerenciaId,
      roles: ['REVISOR'],
    },
    {
      correo: 'aprobador@local.com',
      codigo: 'APR001',
      pass: 'Aprobador!123',
      nombres: { p: 'Sofía', s: 'Valentina' },
      apellidos: { p: 'López', s: 'Hernández' },
      telefono: '+502 5555 0004',
      posicion_id: posicionIdMgr,
      gerencia_id: gerenciaId,
      roles: ['APROBADOR'],
    },
    {
      correo: 'usuario@local.com',
      codigo: 'USR001',
      pass: 'Usuario!123',
      nombres: { p: 'Juan', s: 'Carlos' },
      apellidos: { p: 'Pérez', s: 'López' },
      telefono: '+502 5555 0005',
      posicion_id: posicionIdAnalyst,
      gerencia_id: gerenciaId,
      roles: ['USUARIO'],
    },
  ];

  const createdUsers: user[] = [];

  for (const u of usersBase) {
  const hashed = await BcryptAdapter.hashPassword(u.pass); 

    const dbUser = await prisma.user.upsert({
      where: { correo_institucional: u.correo },
      update: {
        primer_nombre: u.nombres.p,
        segundo_name: u.nombres.s ?? null,
        tercer_nombre: u.nombres.t ?? null,
        primer_apellido: u.apellidos.p,
        segundo_apellido: u.apellidos.s ?? null,
        apellido_casada: u.apellidos.casada ?? null,
        codigo_empleado: u.codigo,
        telefono: u.telefono ?? null,
        posicion_id: u.posicion_id ?? null,
        gerencia_id: u.gerencia_id ?? null,
        password: hashed, 
        activo: true,
      },
      create: {
        correo_institucional: u.correo,
        codigo_empleado: u.codigo,
        primer_nombre: u.nombres.p,
        segundo_name: u.nombres.s ?? null,
        tercer_nombre: u.nombres.t ?? null,
        primer_apellido: u.apellidos.p,
        segundo_apellido: u.apellidos.s ?? null,
        apellido_casada: u.apellidos.casada ?? null,
        telefono: u.telefono ?? null,
        posicion_id: u.posicion_id ?? null,
        gerencia_id: u.gerencia_id ?? null,
        password: hashed, 
        activo: true,
      },
      select: { id: true, correo_institucional: true, codigo_empleado: true },
    });

    createdUsers.push(dbUser as unknown as user);
  }

  // 7) created_by = admin
  const admin = createdUsers.find((u) => (u as any).correo_institucional === 'admin@local.com')!;
  if (admin) {
    await prisma.user.updateMany({
      where: { id: { not: (admin as any).id } },
      data: { created_by: (admin as any).id },
    });
  }

  // 8) Rol-usuario
  for (const u of usersBase) {
    const dbUser = await prisma.user.findUnique({
      where: { correo_institucional: u.correo },
      select: { id: true },
    });
    if (!dbUser) continue;
    for (const r of u.roles) {
      await prisma.rol_usuario.upsert({
        where: { user_id_rol_id: { user_id: dbUser.id, rol_id: roles[r].id } },
        update: {},
        create: { user_id: dbUser.id, rol_id: roles[r].id },
      });
    }
  }

  console.log('✔ Usuarios creados:', createdUsers.length);
  console.log('✔ Admin listo -> login: admin@local.com  /  Admin!123');
  console.log('✔ Empresa base:', empresa.nombre);
  console.log('🎉 Seed completado con éxito');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
