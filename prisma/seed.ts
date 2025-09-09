import { PrismaClient } from 'generated/prisma';
import { BcryptAdapter } from '../src/auth/adapters/bcrypt.adapter';

const prisma = new PrismaClient();

async function main() {
  const adminRole = await prisma.rol.upsert({
    where: { nombre: 'ADMIN' },
    update: {},
    create: { nombre: 'ADMIN' },
  });

  const adminUser = await prisma.user.upsert({
    where: { correo_institucional: 'admin@local' },
    update: {},
    create: {
      primer_nombre: 'Admin',
      primer_apellido: 'User',
      correo_institucional: 'admin@local',
      codigo_empleado: 'ADMIN',
      password: BcryptAdapter.hashPassword('Admin!123'),
      rol_usuario: { create: { rol_id: adminRole.id } },
    },
  });

  console.log('Seeded admin', adminUser.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
