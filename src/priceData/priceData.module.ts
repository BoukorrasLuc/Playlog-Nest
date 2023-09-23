import { Module } from '@nestjs/common';
import { PriceDataService } from './priceData.service';
import { PriceDataController } from './priceData.controller';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  controllers: [PriceDataController],
  providers: [PriceDataService,PrismaService],
})
export class PriceDataModule {}