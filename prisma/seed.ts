import { PrismaClient } from 'generated/prisma';
import { BcryptAdapter } from '../src/auth/adapters/bcrypt.adapter';

const prisma = new PrismaClient();

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

const GESTOR_URLS = [
  '/general',
  '/admin/mis-documentos',
  '/admin/documentos',
  '/admin/asignaciones',
  '/admin/supervision',
];

const USUARIO_URLS = ['/general'];

async function main() {
  const roleNames = ['ADMIN', 'GESTOR', 'USUARIO'] as const;
  type RoleName = (typeof roleNames)[number];
  const roles: Record<RoleName, { id: number; nombre: string }> = {} as any;

  for (const nombre of roleNames) {
    const role = await upsertRole(nombre);
    roles[nombre] = role;
    console.log(`Rol ${role.id} - ${role.nombre}`);
  }

  for (const page of PAGES_DATA) {
    await upsertPage(page);
  }

  const activePages = await prisma.pagina.count({ where: { activo: true } });
  console.log(`Active pages (conteo actual en BD): ${activePages}`);

  const allUrls = PAGES_DATA.map((p) => p.url);
  await setRolePagesByUrls(roles.ADMIN.id, allUrls);
  const adminAssigned = await prisma.pagina_rol.count({
    where: { rol_id: roles.ADMIN.id },
  });
  console.log(`ADMIN assigned pages (total actual): ${adminAssigned}`);

  await setRolePagesByUrls(roles.GESTOR.id, GESTOR_URLS);
  const gestorAssigned = await prisma.pagina_rol.count({
    where: { rol_id: roles.GESTOR.id },
  });
  console.log(`GESTOR assigned pages (total actual): ${gestorAssigned}`);

  await setRolePagesByUrls(roles.USUARIO.id, USUARIO_URLS);
  const usuarioAssigned = await prisma.pagina_rol.count({
    where: { rol_id: roles.USUARIO.id },
  });
  console.log(`USUARIO assigned pages (total actual): ${usuarioAssigned}`);

  const adminUser = await prisma.user.upsert({
    where: { correo_institucional: 'admin@local' },
    update: {
      primer_nombre: 'Admin',
      primer_apellido: 'User',
      codigo_empleado: 'ADMIN',
      password: BcryptAdapter.hashPassword('Admin!123'),
      activo: true,
    },
    create: {
      correo_institucional: 'admin@local',
      codigo_empleado: 'ADMIN',
      primer_nombre: 'Admin',
      primer_apellido: 'User',
      password: BcryptAdapter.hashPassword('Admin!123'),
      activo: true,
    },
  });
  await prisma.rol_usuario.upsert({
    where: {
      user_id_rol_id: { user_id: adminUser.id, rol_id: roles.ADMIN.id },
    },
    update: {},
    create: { user_id: adminUser.id, rol_id: roles.ADMIN.id },
  });
  console.log(`User admin id: ${adminUser.id}`);

  const gestorUser = await prisma.user.upsert({
    where: { correo_institucional: 'gestor@local' },
    update: {
      primer_nombre: 'Gestor',
      primer_apellido: 'User',
      codigo_empleado: 'GESTOR1',
      password: BcryptAdapter.hashPassword('Gestor!123'),
      activo: true,
    },
    create: {
      correo_institucional: 'gestor@local',
      codigo_empleado: 'GESTOR1',
      primer_nombre: 'Gestor',
      primer_apellido: 'User',
      password: BcryptAdapter.hashPassword('Gestor!123'),
      activo: true,
    },
  });
  await prisma.rol_usuario.upsert({
    where: {
      user_id_rol_id: { user_id: gestorUser.id, rol_id: roles.GESTOR.id },
    },
    update: {},
    create: { user_id: gestorUser.id, rol_id: roles.GESTOR.id },
  });
  console.log(`User gestor id: ${gestorUser.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
