import { firma_user, user } from "generated/prisma";


export const USERS_REPOSITORY = 'USERS_REPOSITORY';

export abstract class UsersRepository {
  abstract findUserById(userId: number): Promise<user>;

  abstract createFirmaUser(userId: number, fileKey: string): Promise<firma_user>;
  
  abstract getHistorialFirmasUser( userId: number ): Promise<firma_user[] | string>;
  abstract findFirmaUser( userId: number ): Promise<firma_user | string>;
}
