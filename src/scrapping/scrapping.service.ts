import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { Cron, Timeout } from '@nestjs/schedule';
import { GameService } from '../api/game/game.service';
import { replaceEtat } from './utils/replaceEtat';
import { capitalizeFirstLetterOfEachWord } from './utils/capitalizeFirstLetterOfEachWord';
import { getSpecificText } from './utils/getSpecificText';

@Injectable()
export class ScrappingService {
  private readonly logger = new Logger(ScrappingService.name);
  constructor(private gameService: GameService) {}
  // @Cron('0 0 * * *') // Cette tâche s'exécute tous les jours à minuit
  @Cron('*/1 * * * *') // Cette tâche s'exécute tous les minutes
  async scrapeEbay() {
    const games = await this.gameService.getAll();

    // Randomize the starting point in the games array
    const start = Math.floor(Math.random() * games.length);
    const gamesRandomOrder = [...games.slice(start), ...games.slice(0, start)];

    for (const game of gamesRandomOrder) {
      const SEARCH_CONFIG = {
        title: game.productName,
        console: game.consoleName,
        searchTerm: 'complet',
        location: '1',
      };

      const createUrl = (config) => {
        const { title, console, searchTerm, location } = config;
        return `https://www.ebay.fr/sch/i.html?_from=R40&_nkw=${title}+${console}&_sacat=0&LH_Sold=1&LH_${searchTerm}=1&rt=nc&LH_PrefLoc=${location}`;
      };

      const url = createUrl(SEARCH_CONFIG);
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.goto(url);

      const data = await page.evaluate(
        (searchTerm, title) => {
          const tds = Array.from(document.querySelectorAll('.s-item'));

          return tds
            .map((td) => {
              try {
                const price =
                  (td.querySelector('span.s-item__price') as HTMLElement)
                    ?.innerText || null;
                const name =
                  (
                    td.querySelector('div.s-item__title') as HTMLElement
                  )?.innerText.toLowerCase() || null;
                const date =
                  (
                    td.querySelector(
                      'div.s-item__title--tag span.POSITIVE',
                    ) as HTMLElement
                  )?.innerText.replace('Vendu le', '') || null;
                const typeSold =
                  (
                    td.querySelector(
                      'span.s-item__purchaseOptionsWithIcon',
                    ) as HTMLElement
                  )?.innerText || null;
                const country =
                  (
                    td.querySelector(
                      'span.s-item__location.s-item__itemLocation',
                    ) as HTMLElement
                  )?.innerText || null;

                return {
                  price,
                  name,
                  date,
                  typeSold,
                  country,
                };
              } catch (error) {
                this.logger.error(
                  `[Scrape : items] Error found in map: ${error}`,
                );
                return null;
              }
            })
            .filter(
              (item) =>
                item != null &&
                item.name.includes(searchTerm) &&
                item.name.includes(title.toLowerCase()),
            );
        },
        SEARCH_CONFIG.searchTerm,
        SEARCH_CONFIG.title,
      );
      let transformedData = [];

      if (data.length > 0) {
        const transformedData = data
          .map((item) => {
            const regexZone = /(pal|ntsc-j|jap|japan)/i;
            const matchTitleZone = item.name.match(regexZone);

            const regexCompleteness = /(complet|loose|hs)/i;
            const matchTitleCompleteness = item.name.match(regexCompleteness);

            const regexCondition =
              /(très bon état|tres bon etat|tbe|be|mint|cib)/i;
            const matchCondition = item.name.match(regexCondition);

            const regexDeleteElementOfTitle =
              /nintendo|complete|complet|-|jeux|jeu|pal|nus|ntsc-j|japan|fah|[]|fra|boîte|notice|n64|Ps1|64|ovp|fr|32x|cib|32 x|(\(|\))|,|retrogaming|32 x|tbe|be|euro|eur|version|neu|japon|jap|limited edition|collector|deluxe|en boite|boite|\b(19[89]\d|2000)\b|\//gi;
            const newTitle = item.name
              .replace(regexDeleteElementOfTitle, '')
              .trim();

            // Remove console name from title
            const regexConsoleName = new RegExp(game.consoleName, 'gi');
            const finalTitle = newTitle.replace(regexConsoleName, '').trim();

            const transformedItem = {
              title: capitalizeFirstLetterOfEachWord(
                getSpecificText(finalTitle),
              ),
              priceSold: item.price ? item.price.split(' ')[0] : null,
              dateSold: item.date ? item.date : null,
              condition: matchCondition
                ? capitalizeFirstLetterOfEachWord(
                    replaceEtat(matchCondition[0]),
                  )
                : null,
              completeness: matchTitleCompleteness
                ? capitalizeFirstLetterOfEachWord(matchTitleCompleteness[0])
                : null,
              zone: matchTitleZone
                ? capitalizeFirstLetterOfEachWord(matchTitleZone[0])
                : null,
              // ean: null,
              console: game.consoleName,
            };


            return Object.values(transformedItem).every(
              (value) => value !== null,
            )
              ? transformedItem
              : null;
          })
          .filter((item) => item !== null);

          if (transformedData.length > 0) {
            for (const item of transformedData) {
              const gameToUpdate = await this.gameService.getById(game.id);
              if (gameToUpdate) {
                await this.gameService.updateById(gameToUpdate.id, {
                  cibPrice: parseFloat(item.priceSold.replace(',', '.')),
                  ebayDate: item.dateSold,
                });
              }
            }
          }
      }

      this.logger.log({
        game: game,
        data: data,
        transformedData: transformedData,
      });

      await browser.close();
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}
