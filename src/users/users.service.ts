import {
  Injectable,
  HttpException,
  HttpStatus,
  BadRequestException,
  ConflictException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import { BcryptAdapter } from '../auth/adapters/bcrypt.adapter';
import { RolesService } from '../roles/roles.service';
import { AWSService } from 'src/aws/aws.service';
import { envs } from 'src/config/envs';
import { UpdateSignatureDto } from './dto/update-signature.dto';
import { MeResponseDto } from 'src/shared/dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Prisma } from 'generated/prisma';
import { extname } from 'path';

const userSummarySelect = {
  id: true,
  primer_nombre: true,
  segundo_name: true,
  tercer_nombre: true,
  primer_apellido: true,
  segundo_apellido: true,
  apellido_casada: true,
  correo_institucional: true,
  codigo_empleado: true,
  telefono: true,
  posicion_id: true,
  gerencia_id: true,
  activo: true,
  add_date: true,
  updated_at: true,
  url_foto: true,
} as const;

type UserSummary = Prisma.userGetPayload<{ select: typeof userSummarySelect }>;

type PasswordActor = { id: number; roleIds?: number[] };

const PROFILE_ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/jpg']);
const MAX_PROFILE_SIZE = 5 * 1024 * 1024; // 5MB

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private rolesService: RolesService,
    private awsService: AWSService,
  ) {}

  async create(createUserDto: CreateUserDto, file?: Express.Multer.File) {
    const { password, correo_institucional, codigo_empleado, ...rest } =
      createUserDto;
    if (!password)
      throw new BadRequestException('La contraseña es obligatoria');

    await this.ensureUniqueIdentifiers(correo_institucional, codigo_empleado);

    const hashedPassword = BcryptAdapter.hashPassword(password);
    const created = await this.prisma.user.create({
      data: {
        ...rest,
        correo_institucional,
        codigo_empleado,
        password: hashedPassword,
      },
      select: {
        id: true,
        correo_institucional: true,
        codigo_empleado: true,
      },
    });

    if (file) {
      this.validateProfileFile(file);
      const key = await this.uploadProfilePhoto(file, {
        codigo: created.codigo_empleado,
        correo: created.correo_institucional,
      });
      await this.prisma.user.update({
        where: { id: created.id },
        data: { url_foto: key, updated_at: new Date() },
      });
    }

    const finalUser = await this.prisma.user.findUnique({
      where: { id: created.id },
      select: userSummarySelect,
    });

    return this.mapUser(finalUser!);
  }

  async findAll() {
    const users = await this.prisma.user.findMany({
      where: { activo: true },
      orderBy: { id: 'asc' },
      select: userSummarySelect,
    });
    return Promise.all(users.map((user) => this.mapUser(user)));
  }

  async findOne(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id, activo: true },
      select: userSummarySelect,
    });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado');
    }
    return this.mapUser(user);
  }

  async update(
    id: number,
    updateUserDto: UpdateUserDto,
    file?: Express.Multer.File,
  ) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        activo: true,
        correo_institucional: true,
        codigo_empleado: true,
      },
    });
    if (!existing || existing.activo === false) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const { password, ...rest } = updateUserDto;

    const correo =
      rest.correo_institucional ?? existing.correo_institucional ?? '';
    const codigo = rest.codigo_empleado ?? existing.codigo_empleado ?? '';
    await this.ensureUniqueIdentifiers(correo, codigo, id);

    if (file) {
      this.validateProfileFile(file);
    }

    let photoKey: string | null = null;
    if (file) {
      photoKey = await this.uploadProfilePhoto(file, {
        codigo,
        correo,
        id,
      });
    }

    const data: Prisma.userUpdateInput = {
      ...rest,
      updated_at: new Date(),
    };
    if (photoKey) {
      data.url_foto = photoKey;
    }

    await this.prisma.user.update({
      where: { id },
      data,
    });

    const finalUser = await this.prisma.user.findUnique({
      where: { id },
      select: userSummarySelect,
    });

    return this.mapUser(finalUser!);
  }

  async changePassword(
    id: number,
    dto: ChangePasswordDto,
    actor: PasswordActor,
  ) {
    const { currentPassword, newPassword } = dto;
    if (!newPassword)
      throw new BadRequestException('La nueva contraseña es obligatoria');

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, password: true, activo: true },
    });
    if (!user || user.activo === false) {
      throw new NotFoundException('Usuario no encontrado');
    }

    const isSelf = actor?.id === id;
    if (isSelf) {
      if (!currentPassword) {
        throw new BadRequestException('Debe indicar la contraseña actual');
      }
      if (!user.password) {
        throw new BadRequestException(
          'El usuario no tiene una contraseña configurada',
        );
      }
      const matches = BcryptAdapter.compareHash(currentPassword, user.password);
      if (!matches) {
        throw new BadRequestException('La contraseña actual es incorrecta');
      }
    } else {
      const canOverride = await this.actorIsAdmin(actor);
      if (!canOverride) {
        throw new ForbiddenException('No tiene permisos para esta acción');
      }
    }

    const hashed = BcryptAdapter.hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { password: hashed, updated_at: new Date() },
    });

    return { status: 'ok' };
  }

  async softDelete(id: number) {
    const existing = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true, activo: true },
    });
    if (!existing || existing.activo === false) {
      throw new NotFoundException('Usuario no encontrado');
    }

    await this.prisma.user.update({
      where: { id },
      data: { activo: false, updated_at: new Date() },
    });

    return { status: 'ok' };
  }

  async me(id: number): Promise<MeResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        primer_nombre: true,
        correo_institucional: true,
      },
    });
    if (!user) {
      throw new HttpException('Usuario no encontrado', HttpStatus.NOT_FOUND);
    }

    const [pages, roles] = await Promise.all([
      this.rolesService.getPagesForUser(user.id),
      this.rolesService.getRoleNamesForUser(user.id),
    ]);

    const fileKey = `${envs.bucketSignaturesPrefix}/${id}/current.png`;
    const exists = await this.awsService.checkFileAvailabilityInBucket(fileKey);

    let url: string | null = null;
    if (exists) {
      const presigned = await this.awsService.getPresignedURLByKey(
        fileKey,
        'image/png',
      );
      url = presigned.data;
    }

    return {
      id: user.id,
      nombre: user.primer_nombre,
      correo: user.correo_institucional,
      pages,
      roles,
      signatureUrl: url,
      hasSignature: exists,
    };
  }

  async updateSignature(
    userId: number,
    file?: Express.Multer.File,
    dto?: UpdateSignatureDto,
  ) {
    let buffer: Buffer | undefined;
    let contentType: string | undefined;
    if (file) {
      if (!['image/png', 'image/jpeg'].includes(file.mimetype)) {
        throw new HttpException(
          'Tipo de archivo no permitido',
          HttpStatus.BAD_REQUEST,
        );
      }
      if (file.size > 2 * 1024 * 1024) {
        throw new HttpException(
          'El archivo supera el tamaño máximo de 2MB',
          HttpStatus.BAD_REQUEST,
        );
      }
      buffer = file.buffer;
      contentType = file.mimetype;
    } else if (dto?.dataUrl) {
      const matches = dto.dataUrl.match(
        /^data:(image\/png|image\/jpeg);base64,(.+)$/,
      );
      if (!matches) {
        throw new HttpException(
          'Formato de dataUrl inválido',
          HttpStatus.BAD_REQUEST,
        );
      }
      contentType = matches[1];
      buffer = Buffer.from(matches[2], 'base64');
      if (buffer.length > 2 * 1024 * 1024) {
        throw new HttpException(
          'El archivo supera el tamaño máximo de 2MB',
          HttpStatus.BAD_REQUEST,
        );
      }
    } else {
      throw new HttpException(
        'No se proporcionó archivo ni dataUrl',
        HttpStatus.BAD_REQUEST,
      );
    }

    const fileKey = `${envs.bucketSignaturesPrefix}/${userId}/current.png`;
    await this.awsService.uploadFile(buffer, 'signature', 'png', {
      customKey: fileKey,
      contentType: contentType ?? 'image/png',
    });
    const url = await this.awsService.getPresignedURLByKey(
      fileKey,
      'image/png',
    );
    return {
      status: 'success',
      data: {
        fileKey,
        url: url.data,
      },
    };
  }

  private async ensureUniqueIdentifiers(
    correo: string,
    codigo: string,
    excludeId?: number,
  ) {
    const conditions: Prisma.userWhereInput[] = [];
    if (correo) {
      conditions.push({ correo_institucional: correo });
    }
    if (codigo) {
      conditions.push({ codigo_empleado: codigo });
    }
    if (conditions.length === 0) return;
    const existing = await this.prisma.user.findFirst({
      where: {
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
        OR: conditions,
      },
      select: {
        id: true,
        correo_institucional: true,
        codigo_empleado: true,
      },
    });

    if (existing) {
      if (existing.correo_institucional === correo) {
        throw new ConflictException('El correo institucional ya está en uso');
      }
      if (existing.codigo_empleado === codigo) {
        throw new ConflictException('El código de empleado ya está en uso');
      }
    }
  }

  private validateProfileFile(file: Express.Multer.File) {
    if (!PROFILE_ALLOWED_MIME.has(file.mimetype)) {
      throw new BadRequestException('Tipo de archivo de imagen no permitido');
    }
    if (file.size > MAX_PROFILE_SIZE) {
      throw new BadRequestException(
        'El archivo supera el tamaño máximo permitido (5MB)',
      );
    }
  }

  private resolveProfileExtension(file: Express.Multer.File) {
    const ext = extname(file.originalname ?? '').replace('.', '').toLowerCase();
    if (ext) return ext;
    const [, subtype] = file.mimetype.split('/');
    return subtype || 'png';
  }

  private buildProfileIdentifier(params: {
    codigo?: string | null;
    correo?: string | null;
    id?: number;
  }) {
    const base =
      params.codigo?.trim() ||
      params.correo?.trim() ||
      (params.id ? `id-${params.id}` : `tmp-${Date.now()}`);
    return base.replace(/[^a-zA-Z0-9/_-]/g, '-');
  }

  private async uploadProfilePhoto(
    file: Express.Multer.File,
    params: { codigo?: string | null; correo?: string | null; id?: number },
  ) {
    const identifier = this.buildProfileIdentifier(params);
    const extension = this.resolveProfileExtension(file);
    const key = `users/${identifier}/profile.${extension}`;
    await this.awsService.uploadFile(file.buffer, 'profile', extension, {
      customKey: key,
      contentType: file.mimetype,
    });
    return key;
  }

  private async resolvePhotoUrl(raw?: string | null) {
    if (!raw) return null;
    if (/^https?:\/\//i.test(raw)) {
      return raw;
    }
    const url = await this.awsService.getPresignedGetUrl(raw);
    return url ?? null;
  }

  private async mapUser(user: UserSummary) {
    const { url_foto, ...rest } = user;
    const urlFoto = await this.resolvePhotoUrl(url_foto ?? undefined);
    return {
      ...rest,
      urlFoto,
    };
  }

  private async actorIsAdmin(actor?: PasswordActor) {
    if (!actor?.id) return false;

    if (actor.roleIds && actor.roleIds.length > 0) {
      const roles = await this.prisma.rol.findMany({
        where: { id: { in: actor.roleIds } },
        select: { nombre: true },
      });
      if (roles.some((r) => r.nombre?.toUpperCase() === 'ADMIN')) {
        return true;
      }
    }

    const dbActor = await this.prisma.user.findUnique({
      where: { id: actor.id },
      select: {
        rol_usuario: { select: { rol: { select: { nombre: true } } } },
      },
    });

    return (
      dbActor?.rol_usuario.some(
        (r) => r.rol.nombre?.toUpperCase() === 'ADMIN',
      ) ?? false
    );
  }
}
