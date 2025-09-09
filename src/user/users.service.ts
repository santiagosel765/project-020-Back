import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  // Crear usuario
  async create(createUserDto: CreateUserDto) {
    const now = new Date();
    const data = {
      primer_nombre: createUserDto.primer_nombre,
      segundo_nombre: createUserDto.segundo_nombre,
      tercer_nombre: createUserDto.tercer_nombre,
      primer_apellido: createUserDto.primer_apellido,
      segundo_apellido: createUserDto.segundo_apellido,
      apellido_casada: createUserDto.apellido_casada,
      codigo_empleado: createUserDto.codigo_empleado,
      posicion_id: createUserDto.posicion_id,
      gerencia_id: createUserDto.gerencia_id,
      correo_institucional: createUserDto.correo_institucional,
      telefono: createUserDto.telefono,
      created_by: createUserDto.created_by,
      add_date: now,
      updated_at: now,
      foto_perfil: createUserDto.foto_perfil
        ? Buffer.from(createUserDto.foto_perfil, 'base64')
        : null,
      imagen_firma: createUserDto.imagen_firma
        ? Buffer.from(createUserDto.imagen_firma, 'base64')
        : null,
      isActive: true,
      isDeleted: false, // siempre se crea activo y no borrado
    };

    return this.prisma.user.create({ data });
  }

  // Listar todos los usuarios (solo los no borrados)
  async findAll() {
    return this.prisma.user.findMany({
      where: { isDeleted: false },
    });
  }

  // Obtener un usuario por ID (solo si no está borrado)
  async findOne(id: string) {
    return this.prisma.user.findFirst({
      where: { id, isDeleted: false },
    });
  }

  // Actualizar usuario (si no está borrado)
  async update(id: string, updateData: Partial<CreateUserDto>) {
    const data: any = { ...updateData, updated_at: new Date() };

    if (updateData.foto_perfil) {
      data.foto_perfil = Buffer.from(updateData.foto_perfil, 'base64');
    }
    if (updateData.imagen_firma) {
      data.imagen_firma = Buffer.from(updateData.imagen_firma, 'base64');
    }

    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  // Eliminar usuario (soft delete → marca como eliminado)
  async remove(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isDeleted: true, updated_at: new Date() },
    });
  }

  // Deshabilitar usuario
  async disable(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: false, updated_at: new Date() },
    });
  }

  // Habilitar usuario
  async enable(id: string) {
    return this.prisma.user.update({
      where: { id },
      data: { isActive: true, updated_at: new Date() },
    });
  }
}
