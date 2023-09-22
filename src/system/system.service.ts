import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSystemDto, UpdateSystemDto } from './dto/system.dto';

@Injectable()
export class SystemService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.system.findMany();
  }

  async getById(id: string) {
    return this.prisma.system.findUnique({ where: { id } });
  }

  async updateById(id: string, data: UpdateSystemDto) {
    return this.prisma.system.update({ where: { id }, data });
  }

  async deleteById(id: string) {
    return this.prisma.system.delete({ where: { id } });
  }

  async create(data: CreateSystemDto) {
    return this.prisma.system.create({ data });
  }
}