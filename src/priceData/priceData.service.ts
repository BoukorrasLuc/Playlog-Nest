import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePriceDataDto, UpdatePriceDataDto } from './dto/priceData.dto';

@Injectable()
export class PriceDataService {
  constructor(private prisma: PrismaService) {}

  async getAll() {
    return this.prisma.priceData.findMany();
  }

  async getById(id: string) {
    return this.prisma.priceData.findUnique({ where: { id } });
  }

  async updateById(id: string, data: UpdatePriceDataDto) {
    return this.prisma.priceData.update({ where: { id }, data });
  }

  async deleteById(id: string) {
    return this.prisma.priceData.delete({ where: { id } });
  }

  async create(data: CreatePriceDataDto) {
    return this.prisma.priceData.create({ data });
  }
}