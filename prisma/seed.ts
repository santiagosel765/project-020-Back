import { PrismaClient } from 'generated/prisma';
import { BcryptAdapter } from '../src/auth/adapters/bcrypt.adapter';

const prisma = new PrismaClient();

async function main() {
  const roleNames = ['ADMIN', 'GESTOR', 'USUARIO'] as const;
  type RoleName = (typeof roleNames)[number];
  const roles: Record<RoleName, { id: number; nombre: string }> = {} as any;

  for (const nombre of roleNames) {
    const role = await prisma.rol.upsert({
      where: { nombre },
      update: { activo: true },
      create: { nombre, activo: true },
    });
    roles[nombre] = role;
    console.log(`Rol ${role.id} - ${role.nombre}`);
  }

  const pagesData = [
    { nombre: 'Dashboard', url: '/admin/dashboard' },
    { nombre: 'Conexiones', url: '/admin/connection' },
    { nombre: 'Procesos', url: '/admin/proccess' },
    { nombre: 'Roles', url: '/admin/roles' },
    { nombre: 'Paginas', url: '/admin/page' },
    { nombre: 'Permisos', url: '/admin/permission' },
    { nombre: 'Usuarios', url: '/admin/users' },
    { nombre: 'busqueda Dpi', url: '/admin/searchDpi' },
    { nombre: 'Novedades', url: '/admin/novelty' },
    { nombre: 'Master Novedades', url: '/admin/newNovelty' },
  ] as const;

  const pages: Record<string, { id: number }> = {};

  for (const p of pagesData) {
    const page = await prisma.pagina.upsert({
      where: { nombre: p.nombre },
      update: { url: p.url, activo: true },
      create: { nombre: p.nombre, url: p.url, activo: true },
    });
    pages[p.nombre] = page;
  }

  const totalPages = await prisma.pagina.count();
  console.log(`Total pages: ${totalPages}`);

  const allPageIds = Object.values(pages).map((p) => p.id);
  const gestorPageIds = ['Dashboard', 'Usuarios', 'Permisos'].map(
    (n) => pages[n].id,
  );

  await prisma.$transaction(async (tx) => {
    const current = await tx.pagina_rol.findMany({
      where: { rol_id: roles.ADMIN.id },
    });
    const currentIds = new Set(current.map((pr) => pr.pagina_id));
    const toAdd = allPageIds.filter((id) => !currentIds.has(id));
    const toRemove = Array.from(currentIds).filter(
      (id) => !allPageIds.includes(id),
    );

    if (toRemove.length > 0) {
      await tx.pagina_rol.deleteMany({
        where: { rol_id: roles.ADMIN.id, pagina_id: { in: toRemove } },
      });
    }

    if (toAdd.length > 0) {
      await tx.pagina_rol.createMany({
        data: toAdd.map((pagina_id) => ({
          rol_id: roles.ADMIN.id,
          pagina_id,
        })),
        skipDuplicates: true,
      });
    }
  });
  const adminAssigned = await prisma.pagina_rol.count({
    where: { rol_id: roles.ADMIN.id },
  });
  console.log(`ADMIN assigned pages: ${adminAssigned}`);

  await prisma.$transaction(async (tx) => {
    const current = await tx.pagina_rol.findMany({
      where: { rol_id: roles.GESTOR.id },
    });
    const currentIds = new Set(current.map((pr) => pr.pagina_id));
    const toAdd = gestorPageIds.filter((id) => !currentIds.has(id));
    const toRemove = Array.from(currentIds).filter(
      (id) => !gestorPageIds.includes(id),
    );

    if (toRemove.length > 0) {
      await tx.pagina_rol.deleteMany({
        where: { rol_id: roles.GESTOR.id, pagina_id: { in: toRemove } },
      });
    }

    if (toAdd.length > 0) {
      await tx.pagina_rol.createMany({
        data: toAdd.map((pagina_id) => ({
          rol_id: roles.GESTOR.id,
          pagina_id,
        })),
        skipDuplicates: true,
      });
    }
  });
  const gestorAssigned = await prisma.pagina_rol.count({
    where: { rol_id: roles.GESTOR.id },
  });
  console.log(`GESTOR assigned pages: ${gestorAssigned}`);

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

