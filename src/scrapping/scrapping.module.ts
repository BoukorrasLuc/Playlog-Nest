import { Module } from '@nestjs/common';
import { ScrappingService } from './scrapping.service';
import { ScrappingController } from './scrapping.controller';
import { ScheduleModule } from '@nestjs/schedule';
import {GameModule} from '../api/game/game.module';

@Module({
    imports: [
        ScheduleModule.forRoot(),GameModule,
      ],
  providers: [ScrappingService],
  controllers: [ScrappingController],
})
export class ScrappingModule {}