import { Controller, Get } from '@nestjs/common';
import { ScrappingService } from './scrapping.service';

@Controller('scrapping')
export class ScrappingController {
  constructor(private readonly scrappingService: ScrappingService) {}

  @Get()
  async scrapeEbay() {
    const gamesRandomOrder = await this.scrappingService.itemOfDatabase();
    const manualOnly = this.scrappingService.scrapeEbayVideoGamesManualOnly(gamesRandomOrder);
    const complete = this.scrappingService.scrapeEbayVideoGamesComplete(gamesRandomOrder);
    return Promise.all([manualOnly, complete]);
  }
}