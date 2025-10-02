import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

import { UsersRepository } from '../domain/repositories/users.repository';
import { firma_user, user } from 'generated/prisma';

@Injectable()
export class PrismaUsersRepository implements UsersRepository {
  constructor(private prisma: PrismaService) {}

    async findUserById(userId: number): Promise<user> {
        try {
            const dbUser = await this.prisma.user.findFirst({ where: { id: userId } });
    
            if( !dbUser ) {
                throw new HttpException(`Usuario con ID "${userId}" no encontrado`, HttpStatus.NOT_FOUND);
            }
    
            return dbUser
            
        } catch (error) {
            throw new HttpException(`Problemas al consultar usuario con ID "${userId}": ${ error }`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async createFirmaUser(userId: number, fileKey: string): Promise<firma_user> {
        try {
            
            // ? Desactiva todas las demás firmas
            await this.prisma.firma_user.updateMany({
                where: {
                    user_id: userId
                },
                data: {
                    is_active: false,
                }
            })

            // ? Nueva firma activa por defecto
            const dbFirmaUser = await this.prisma.firma_user.create({
                data: {
                   user: { connect: { id: userId } },
                   file_key: fileKey,
                   created_at: new Date(),
                   is_active: true,
                }
            });

            return dbFirmaUser;
            
        } catch (error) {
            throw new HttpException(`Problemas al guardar firma del usuario: ${ error }`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }
    async getHistorialFirmasUser( userId: number ): Promise<firma_user[] | string> {
        try {
            
            // ? Desactiva todas las demás firmas
            const dbFirmas = await this.prisma.firma_user.findMany({ where: { user_id: userId } });

            if(dbFirmas.length === 0) {
                return 'El usuario no cuenta con firmas';
            }

            return dbFirmas;
            
        } catch (error) {
            return 'El usuario no cuenta con firmas';
            // throw new HttpException(`Problemas al firmas del usuario con ID "${userId}": ${ error }`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }

    async findFirmaUser( userId: number ): Promise<firma_user | string> {
        try {
            
            // ? Desactiva todas las demás firmas
            const dbFirma = await this.prisma.firma_user.findFirst({ where: { user_id: userId, is_active: true } });

            if(!dbFirma) 
                return 'El usuario no cuenta con firmas';
            return dbFirma;
            
        } catch (error) {
            return 'El usuario no cuenta con firmas';
            // throw new HttpException(`Problemas al firmas del usuario con ID "${userId}": ${ error }`, HttpStatus.INTERNAL_SERVER_ERROR);
        }
    }


}
