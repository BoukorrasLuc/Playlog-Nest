import { ConflictException, Injectable } from '@nestjs/common';
import { SignupDto } from './dto/signupDto';
import { PrismaService } from 'src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(private readonly prismaService: PrismaService) {}
  async signup(SignupDto: SignupDto) {
    const { email, password, pseudo } = SignupDto;
    // Vérifier si l'utilisateur est deja inscrit
    const user = await this.prismaService.user.findUnique({
      where: {
        email,
      },
    });
    if (user) throw new ConflictException('User already exists');
    // Hasher le mot de passe
    const hash = await bcrypt.hash(password, 10);
    // Enregistrer l'utilisateur dans la bdd
    await this.prismaService.user.create({
      data: { email, pseudo, password: hash },
    });
    // retourner une réponse de succès
    return {
      message: 'User created successfully',
    };
  }
}
