import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { User } from '@prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

import { SignupDto } from './dto/signupDto';
import { SigninDto } from './dto/signinDto';
import getCleanUser from 'src/utils/getCleanUser';

const INVALID_CREDENTIALS = 'Invalid email or password';

@Injectable()
export class AuthService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prismaService: PrismaService,
    private readonly jwtService: JwtService,
  ) {}


  async signup(SignupDto: SignupDto) {
    const { email, password, pseudo } = SignupDto;

    let user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
    if (user) throw new ConflictException('User already exists');

    const hash = await bcrypt.hash(password, 10);

    

    const createdUser = await this.prismaService.user.create({
      data: { email, pseudo, password: hash },
    });
    // Todo renvoyé un email de confirmation.

    return {
      user: getCleanUser(createdUser),
      message: 'User created successfully',
    };
  }

  async signin(signinDto: SigninDto) {
    const { email, password } = signinDto;

    const user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });

    if (!user) throw new BadRequestException(INVALID_CREDENTIALS);

    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword)
      throw new BadRequestException(INVALID_CREDENTIALS);

    const token = await this.generateToken(user);

    return {
      token,
      user: getCleanUser(user) 
    };
  }

  async generateToken(user: User) {
    const payload = {
      sub: user.id,
      email: user.email,
    };

    const secret = this.configService.get('JWT_SECRET');

    const token = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
      secret: secret,
    });

    return token;
  }
}
