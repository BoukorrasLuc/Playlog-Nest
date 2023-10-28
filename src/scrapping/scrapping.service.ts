import { Injectable,Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { Cron, Timeout } from '@nestjs/schedule';
import { GameService } from '../game/game.service';

@Injectable()
export class ScrappingService {
  private readonly logger = new Logger(ScrappingService.name);
  constructor(private gameService: GameService) {}
  // @Cron('0 0 * * *') // Cette tâche s'exécute tous les jours à minuit
  @Cron('*/1 * * * *') // Cette tâche s'exécute tous les minutes
  async scrapeEbay() {

    const games = await this.gameService.getAll();

    for (const game of games) {
      const SEARCH_CONFIG = {
        title: game.productName,
        console: game.consoleName,
        searchTerm: 'complet',
        location: '1',
      };

      const createUrl = (config) => {
        const {
          title, console, searchTerm, location,
        } = config;
        return `https://www.ebay.fr/sch/i.html?_from=R40&_nkw=${title}+${console}&_sacat=0&LH_Sold=1&LH_${searchTerm}=1&rt=nc&LH_PrefLoc=${location}`;
      };

      const url = createUrl(SEARCH_CONFIG);
      const browser = await puppeteer.launch();
      const page = await browser.newPage();
      await page.goto(url);

      const data = await page.evaluate(
        (searchTerm, title) => {
          const tds = Array.from(
            document.querySelectorAll('.s-item'),
          );

          return tds.map((td) => {
            try {
              const price = (td.querySelector('span.s-item__price') as HTMLElement)?.innerText || null;
              const name = (td.querySelector('div.s-item__title') as HTMLElement)?.innerText.toLowerCase() || null;
              const date = (td.querySelector('div.s-item__title--tag span.POSITIVE') as HTMLElement)?.innerText.replace('Vendu le', '') || null;
              const typeSold = (td.querySelector('span.s-item__purchaseOptionsWithIcon') as HTMLElement)?.innerText || null;
              const country = (td.querySelector('span.s-item__location.s-item__itemLocation') as HTMLElement)?.innerText || null;

              return {
                price,
                name,
                date,
                typeSold,
                country,
              };
            } catch (error) {
              console.error(`[Scrape : items] Error found in map: ${error}`);
              return null;
            }
          }).filter(
            (item) => item != null
              && item.name.includes(searchTerm)
              && item.name.includes(title.toLowerCase()),
          );
        },
        SEARCH_CONFIG.searchTerm,
        SEARCH_CONFIG.title,
      );

      const content = `const items = ${JSON.stringify(
        data,
        null,
        2,
      )};\n\nmodule.exports = items;\n`;
      fs.writeFile(`./prisma/scrappingEbay/DataScrapped-${game.productName}-${game.consoleName}.js`, content, (err) => {
        if (err) {
          console.error(`[Scrape : items] Error found: ${err}`);
        } else {
          console.info('[Scrape : items] The file has been saved!');
        }
      });

      await browser.close();
      await new Promise(resolve => setTimeout(resolve, 60000)); // Wait for 1 minute before next iteration
    }
  }
}
