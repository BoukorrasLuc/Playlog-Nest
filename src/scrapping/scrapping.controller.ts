import { Controller, Get } from '@nestjs/common';
import { ScrappingService } from './scrapping.service';

@Controller('scrapping')
export class ScrappingController {
  constructor(private readonly scrappingService: ScrappingService) {}

  @Get()
  async scrapeEbay() {
    return this.scrappingService.scrapeEbayVideoGamesManualOnly();
  }
}