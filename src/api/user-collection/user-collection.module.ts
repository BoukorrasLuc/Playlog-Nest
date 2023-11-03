import { Module } from '@nestjs/common';
import { UserCollectionService } from './user-collection.service';
import { UserCollectionController } from './user-collection.controller';
import { PrismaService } from '../../prisma/prisma.service';

@Module({
  controllers: [UserCollectionController],
  providers: [UserCollectionService, PrismaService],
})
export class UserCollectionModule {}