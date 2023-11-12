import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import { Cron } from '@nestjs/schedule';
import { GameService } from '../api/game/game.service';
import { replaceEtat } from './utils/replaceEtat';
import { capitalizeFirstLetterOfEachWord } from './utils/capitalizeFirstLetterOfEachWord';
import { getSpecificText } from './utils/getSpecificText';
import { regexZone } from './const/regexZone';
import { regexCompleteness } from './const/regexCompleteness';
import { regexCondition } from './const/regexCondition';
import { regexDeleteElementOfTitle } from './const/regexDeleteElementOfTitle';
import { UpdateGameDto } from 'src/api/game/dto/game.dto';
import { Game } from '@prisma/client';
import { LoggerService } from '@nestjs/common';

@Injectable()
export class ScrappingService {
  private readonly logger: LoggerService;
  constructor(private gameService: GameService) {
    this.logger = new Logger('ScrappingService');
    this.logger.log('ScrappingService Initialized');
  }
  // @Cron('0 0 * * *') // This task runs every day at midnight
  @Cron('*/1 * * * *') // This task runs every minute
  // This function scrapes the eBay website for game data
  async scrapeEbay() {
    // Fetch all games from the database
    const games: Game[] = await this.gameService.getAll();

    // Randomize the starting point in the games array to avoid bias
    const start: number = Math.floor(Math.random() * games.length);
    const gamesRandomOrder: Game[] = [
      ...games.slice(start),
      ...games.slice(0, start),
    ];

    // Iterate over each game
    for (const game of gamesRandomOrder) {
      // Only update games with zone "PAL" or "JAP"
      if (game.zone === 'JAP' || game.zone === 'PAL') {
        // Define the search configuration for the current game
        const SEARCH_CONFIG: {
          title: string;
          console: string;
          searchTerm: string;
          location: string;
        } = {
          title: game.productName,
          console: game.consoleName,
          searchTerm: 'complet',
          location: '1',
        };

        // Function to create the URL for the eBay search
        const createUrl = (config: {
          title: string;
          console: string;
          searchTerm: string;
          location: string;
        }): string => {
          const { title, console, searchTerm, location } = config;
          return `https://www.ebay.fr/sch/i.html?_from=R40&_nkw=${title}+${console}&_sacat=0&LH_Sold=1&LH_${searchTerm}=1&rt=nc&LH_PrefLoc=${location}`;
        };

        // Create the URL and launch the browser
        const url: string = createUrl(SEARCH_CONFIG);
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.goto(url);

        // Scrape the data from the eBay page
        const data = await page.evaluate(
          (searchTerm: string, title: string) => {
            const tds = Array.from(document.querySelectorAll('.s-item'));

            return tds
              .map((td) => {
                try {
                  const price: string | null =
                    (td.querySelector('span.s-item__price') as HTMLElement)
                      ?.innerText || null;
                  const name: string | null =
                    (
                      td.querySelector('div.s-item__title') as HTMLElement
                    )?.innerText.toLowerCase() || null;
                  const date: string | null =
                    (
                      td.querySelector(
                        'div.s-item__title--tag span.POSITIVE',
                      ) as HTMLElement
                    )?.innerText.replace('Vendu le', '') || null;
                  const typeSold: string | null =
                    (
                      td.querySelector(
                        'span.s-item__purchaseOptionsWithIcon',
                      ) as HTMLElement
                    )?.innerText || null;
                  const country: string | null =
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
                    `[Scrapping Service] Error found in map: ${error}`,
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

        // If data was found, transform it
        if (data.length > 0) {
          const item = data[0];
          const matchTitleZone = item.name.match(regexZone);

          const matchTitleCompleteness = item.name.match(regexCompleteness);

          const matchCondition = item.name.match(regexCondition);

          const newTitle = item.name
            .replace(regexDeleteElementOfTitle, '')
            .trim();

          // Remove console name from title
          const regexConsoleName = new RegExp(game.consoleName, 'gi');
          const finalTitle = newTitle.replace(regexConsoleName, '').trim();

          const transformedItem = {
            title: capitalizeFirstLetterOfEachWord(getSpecificText(finalTitle)),
            priceSold: item.price ? item.price.split(' ')[0] : null,
            dateSold: item.date ? item.date : null,
            condition: matchCondition
              ? capitalizeFirstLetterOfEachWord(replaceEtat(matchCondition[0]))
              : null,
            completeness: matchTitleCompleteness
              ? capitalizeFirstLetterOfEachWord(matchTitleCompleteness[0])
              : null,
            zone: matchTitleZone
              ? capitalizeFirstLetterOfEachWord(matchTitleZone[0])
              : null,
            console: game.consoleName,
          };

          // If the item is not complete, do not push to the database.
          if (Object.values(transformedItem).every((value) => value !== null)) {
            const gameToUpdate = await this.gameService.getById(game.id);

            console.log(
              '🚀 ~ file: scrapping.service.ts:167 ~ ScrappingService ~ scrapeEbay ~ transformedItem:',
              transformedItem,
            );

            if (
              gameToUpdate.productName === transformedItem.title &&
              gameToUpdate.consoleName === transformedItem.console &&
              gameToUpdate.zone.toUpperCase() ===
                transformedItem.zone.toUpperCase()
            ) {
              await this.gameService.updateById(gameToUpdate.id, {
                cibPrice: parseFloat(
                  transformedItem.priceSold.replace(',', '.'),
                ),
                ebayDate: transformedItem.dateSold.substring(1),
              } as UpdateGameDto);
              await this.logger.log(
                `[Scrapping Service] This game is update: ${JSON.stringify(
                  gameToUpdate,
                )}`,
              );
            }
          }
        }

        // Close the browser and wait for 1 minute before the next iteration
        await browser.close();
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }
  }
}

// Notice Seul : https://www.ebay.fr/sch/i.html?_from=R40&_trksid=p2334524.m570.l1313&_nkw=+notice+seul+gamecube&_sacat=0&LH_TitleDesc=0&_odkw=Metroid+Prime+notice+seul+gamecube&_osacat=0&LH_Complete=1&LH_Sold=1
