import { PrismaClient, type user } from 'generated/prisma';
import { BcryptAdapter } from '../src/auth/adapters/bcrypt.adapter';

const prisma = new PrismaClient();

// ------- utilidades pequeñas -------
async function findFirstId(table: 'gerencia' | 'posicion', fallbackName?: string) {
  if (table === 'gerencia') {
    const g = await prisma.gerencia.findFirst({ select: { id: true }, where: { activo: true } });
    if (g) return g.id;
    if (fallbackName) {
      const g2 = await prisma.gerencia.upsert({
        where: { nombre: fallbackName },
        update: { activo: true },
        create: { nombre: fallbackName, activo: true },
        select: { id: true },
      });
      return g2.id;
    }
  }
  if (table === 'posicion') {
    const p = await prisma.posicion.findFirst({ select: { id: true }, where: { activo: true } });
    if (p) return p.id;
    if (fallbackName) {
      const p2 = await prisma.posicion.upsert({
        where: { nombre: fallbackName },
        update: { activo: true },
        create: { nombre: fallbackName, activo: true },
        select: { id: true },
      });
      return p2.id;
    }
  }
  return null;
}

async function upsertRole(nombre: string) {
  return prisma.rol.upsert({
    where: { nombre },
    update: { activo: true },
    create: { nombre, activo: true },
  });
}

async function upsertPage(data: { nombre: string; url: string }) {
  return prisma.pagina.upsert({
    where: { nombre: data.nombre },
    update: { url: data.url, activo: true },
    create: { nombre: data.nombre, url: data.url, activo: true },
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

// ------- datos de páginas / permisos -------
const PAGES_DATA = [
  { nombre: 'Asignaciones', url: '/admin/asignaciones' },
  { nombre: 'Documentos', url: '/admin/documentos' },
  { nombre: 'Mis Documentos', url: '/admin/mis-documentos' },
  { nombre: 'Usuarios', url: '/admin/usuarios' },
  { nombre: 'Roles', url: '/admin/roles' },
  { nombre: 'Páginas', url: '/admin/page' },
  { nombre: 'Permisos', url: '/admin/permission' },
  { nombre: 'Supervisión', url: '/admin/supervision' },
  { nombre: 'Mis Documentos General', url: '/general' },
  { nombre: 'Detalle Documento', url: '/documento/[id]' },
] as const;

const ADMIN_URLS = PAGES_DATA.map((p) => p.url);
const GESTOR_URLS = [
  '/general',
  '/admin/mis-documentos',
  '/admin/documentos',
  '/admin/asignaciones',
  '/admin/supervision',
];
const USUARIO_URLS = ['/general'];

// ------- rutina principal -------
async function main() {
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

  // 2) ROLES
  const roles = {
    ADMIN: await upsertRole('ADMIN'),
    GESTOR: await upsertRole('GESTOR'),
    USUARIO: await upsertRole('USUARIO'),
  };

  // 3) PÁGINAS y asignaciones
  for (const page of PAGES_DATA) await upsertPage(page);
  await setRolePagesByUrls(roles.ADMIN.id, ADMIN_URLS);
  await setRolePagesByUrls(roles.GESTOR.id, GESTOR_URLS);
  await setRolePagesByUrls(roles.USUARIO.id, USUARIO_URLS);

  // 4) Catálogos relacionados (IDs para foreign keys)
  const gerenciaId = await findFirstId('gerencia', 'Dirección General');
  const posicionIdAdmin = await findFirstId('posicion', 'Administrador');
  const posicionIdMgr = await findFirstId('posicion', 'Gerente');
  const posicionIdAnalyst = await findFirstId('posicion', 'Analista');

  // 5) USUARIOS 
  type SeedUser = {
    correo: string;
    codigo: string;
    pass: string;
    nombres: { p: string; s?: string | null; t?: string | null };
    apellidos: { p: string; s?: string | null; casada?: string | null };
    telefono?: string | null;
    posicion_id?: number | null;
    gerencia_id?: number | null;
    roles: Array<'ADMIN' | 'GESTOR' | 'USUARIO'>;
  };

  const usersBase: SeedUser[] = [
    {
      correo: 'admin@local',
      codigo: 'ADMIN',
      pass: 'Admin!123',
      nombres: { p: 'Admin', s: 'Super', t: null },
      apellidos: { p: 'User', s: null, casada: null },
      telefono: '+502 5555 0001',
      posicion_id: posicionIdAdmin,
      gerencia_id: gerenciaId,
      roles: ['ADMIN'],
    },
    {
      correo: 'gestor@local',
      codigo: 'GESTOR1',
      pass: 'Gestor!123',
      nombres: { p: 'María', s: 'Alejandra', t: null },
      apellidos: { p: 'Ramírez', s: 'González', casada: null },
      telefono: '+502 5555 0002',
      posicion_id: posicionIdMgr,
      gerencia_id: gerenciaId,
      roles: ['GESTOR'],
    },
    {
      correo: 'juan.perez@local',
      codigo: 'EMP001',
      pass: 'Usuario!123',
      nombres: { p: 'Juan', s: 'Carlos', t: null },
      apellidos: { p: 'Pérez', s: 'López', casada: null },
      telefono: '+502 5555 0003',
      posicion_id: posicionIdAnalyst,
      gerencia_id: gerenciaId,
      roles: ['USUARIO'],
    },
    {
      correo: 'sofia.lopez@local',
      codigo: 'EMP002',
      pass: 'Usuario!123',
      nombres: { p: 'Sofía', s: 'Valentina', t: null },
      apellidos: { p: 'López', s: 'Hernández', casada: null },
      telefono: '+502 5555 0004',
      posicion_id: posicionIdAnalyst,
      gerencia_id: gerenciaId,
      roles: ['USUARIO'],
    },
  ];

  const createdUsers: user[] = [];

  for (const u of usersBase) {
    const user = await prisma.user.upsert({
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
        password: BcryptAdapter.hashPassword(u.pass),
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
        password: BcryptAdapter.hashPassword(u.pass),
        activo: true,
      },
      select: { id: true, correo_institucional: true, codigo_empleado: true },
    });

    createdUsers.push(user as unknown as user);
  }

  // ADMIN 
  const adminUser = createdUsers.find((u) => (u as any).correo_institucional === 'admin@local')!;
  await prisma.user.updateMany({
    where: { id: { not: (adminUser as any).id } },
    data: { created_by: (adminUser as any).id },
  });

  // Asignación de roles a usuarios
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

  console.log(`✔ Usuarios creados: ${createdUsers.length}`);
  console.log(`✔ Admin listo (login: admin@local / Admin!123)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
