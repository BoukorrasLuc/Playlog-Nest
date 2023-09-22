import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserCollectionDto } from './dto/user-collection.dto';

@Injectable()
export class UserCollectionService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.userCollection.findMany();
  }

  findOne(id: number) {
    return this.prisma.userCollection.findUnique({ where: { id } });
  }

  update(id: number, data: UserCollectionDto) {
    return this.prisma.userCollection.update({ where: { id }, data });
  }

  remove(id: number) {
    return this.prisma.userCollection.delete({ where: { id } });
  }

  create(data: UserCollectionDto) {
    return this.prisma.userCollection.create({ data });
  }
}