import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';

@Injectable()
export class GameService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.game.findMany();
  }

  async getById(id: string) {
    return this.prisma.game.findUnique({ where: { id } });
  }

  async updateById(id: string, data: UpdateGameDto) {
    return this.prisma.game.update({ where: { id }, data });
  }

  async deleteById(id: string) {
    return this.prisma.game.delete({ where: { id } });
  }

  async create(data: CreateGameDto) {
    return this.prisma.game.create({ data });
  }
}