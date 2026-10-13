import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';

import { PrismaService } from '../prisma.service.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';

import { Buffer } from 'node:buffer';
import {randomBytes, scryptSync, timingSafeEqual} from 'crypto';


@Injectable()
export class AuthService {
    constructor(private readonly prisma: PrismaService) {}

    private hashPassword(password: string): string {
        const salt = randomBytes(16).toString('hex');

        //using scrypt algorithm to combine salt + password becoming encoding string
        const hash = scryptSync(password,salt, 64).toString("hex");

        //return scrypt:salt:hash
        return `scrypt:${salt}:${hash}`;
    }

    private verifyPassword(password: string, storedHash: string):boolean {
        //scrypt:salt:hash
        const parts = storedHash.split(':');

        if (parts.length != 3 || parts[0] !== 'scrypt'){
            return false;
        }
        const [, salt, originalKeyHex] = parts

        const derivedKey = scryptSync(password, salt, 64);
        const originalKey = Buffer.from(originalKeyHex,'hex');

        return timingSafeEqual(derivedKey, originalKey);

    }

    async register(dto: RegisterDto){   //dto receive data with the structure of RegisterDto
        const { email, password, targetBand } = dto;

        if(!email || !password){
            throw new BadRequestException("Please provide email and password");
        }

        const userExist = await this.prisma.user.findUnique(
            {where: {email: email},}
        );
        if(userExist){
            throw new ConflictException("This email is already registered!");
        }
        const passwordHash = this.hashPassword(password);

        const newUser = await this.prisma.user.create({
            data: {
                email: email,
                passwordHash: passwordHash,
                targetBand: targetBand ?? 6.5,
                status: 'ACTIVE',
                role: 'STUDENT'
            },

            select: {
                id: true,
                email: true,
                role: true,
                targetBand: true,
                status: true,
            },
        });
        return {
            message: 'Register Successful',
            user: newUser,
        };
    }
    async login(dto : LoginDto){        //dto receive data with the structure of LoginDto
        const {email, password}  = dto

        const user = await this.prisma.user.findUnique({
            where: {email:email},
        });

        if(!user){
            throw new UnauthorizedException("Email or password is not correct");
        }
        const isPasswordCorrect = this.verifyPassword(password,user.passwordHash);
        if(!isPasswordCorrect){
            throw new UnauthorizedException("Email or password is not correct");
        }

        const payload = {       //payload provide the info that backend want to give token in login
            sub: user.id,
            email: user.email,
            role: user.role,
        };
        const accessToken = Buffer.from(JSON.stringify(payload)).toString('base64');    
                                //present authentication information when calling API
        return{
            message : "Login successfully",
            accessToken: accessToken,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                targetBand: user.targetBand,
            },
        };
    }
    async getProfile(userId: number){
        const user = await this.prisma.user.findUnique({
            where: {id: userId},
            select: {
                id: true,
                email: true,
                role: true,
                targetBand: true,
                status: true,
            },
        });
        if(!user){
            throw new UnauthorizedException("This user doesnt exist!");
        }
        return user;
    }
}



