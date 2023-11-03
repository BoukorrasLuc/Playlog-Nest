import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAccessoryDto, UpdateAccessoryDto } from './dto/accessory.dto';

@Injectable()
export class AccessoryService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.accessory.findMany();
  }

  async getById(id: string) {
    return this.prisma.accessory.findUnique({ where: { id } });
  }

  async updateById(id: string, data: UpdateAccessoryDto) {
    return this.prisma.accessory.update({ where: { id }, data });
  }

  async deleteById(id: string) {
    return this.prisma.accessory.delete({ where: { id } });
  }

  async create(data: CreateAccessoryDto) {
    return this.prisma.accessory.create({ data });
  }
}