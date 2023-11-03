import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ItemScrappeDatabaseDto } from './dto/item-scrappe-database.dto';

@Injectable()
export class ItemScrappeDatabaseService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.itemScrappeDatabase.findMany();
  }

  findOne(id: string) {
    return this.prisma.itemScrappeDatabase.findUnique({ where: { id } });
  }

  update(id: string, data: ItemScrappeDatabaseDto) {
    return this.prisma.itemScrappeDatabase.update({ where: { id }, data });
  }

  remove(id: string) {
    return this.prisma.itemScrappeDatabase.delete({ where: { id } });
  }

  create(data: ItemScrappeDatabaseDto) {
    return this.prisma.itemScrappeDatabase.create({ data });
  }
}
