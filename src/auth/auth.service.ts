import { Injectable } from '@nestjs/common';
import { SignupDto } from './dto/signupDto';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class AuthService {
    constructor(private readonly prismaService: PrismaService){}
    signup(SignupDto: SignupDto) {
       // Vérifier si l'utilisateur est deja inscrit
       // Hasher le mot de passe
       // Enregistrer l'utilisateur dans la bdd 
       // retourner une réponse de succès
    }
}
