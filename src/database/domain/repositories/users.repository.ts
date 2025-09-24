import { user } from "generated/prisma";


export const USERS_REPOSITORY = 'USERS_REPOSITORY';

export abstract class UsersRepository {
  abstract findUserById(userId: number): Promise<user>;
  
}
