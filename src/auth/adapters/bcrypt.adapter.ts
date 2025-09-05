import bcrypt from 'bcrypt';

export class BcryptAdapter {

    static hashPassword( password: string ) {
        return bcrypt.hashSync(password, 10);
    }

    static compareHash(password: string, hashedPassword: string) {
        return bcrypt.compareSync(password, hashedPassword);
    }
}