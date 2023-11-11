import { Injectable, Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { Cron, Timeout } from '@nestjs/schedule';
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


@Injectable()
export class ScrappingService {
  private readonly logger = new Logger(ScrappingService.name);
  constructor(private gameService: GameService) {}
  // @Cron('0 0 * * *') // Cette tâche s'exécute tous les jours à minuit
  @Cron('*/1 * * * *') // Cette tâche s'exécute tous les minutes
  // This function scrapes the eBay website for game data
  async scrapeEbay() {
    // Fetch all games from the database
    const games: Game[] = await this.gameService.getAll();

    // Randomize the starting point in the games array
    const start: number = Math.floor(Math.random() * games.length);
    const gamesRandomOrder: Game[] = [
      ...games.slice(start),
      ...games.slice(0, start),
    ];

    // Iterate over each game 
    for (const game of gamesRandomOrder) {
      // condition just for update game with zone "PAL" //
      if (game.zone === 'PAL') {
        console.log("🚀 ~ file: scrapping.service.ts:38 ~ ScrappingService ~ scrapeEbay ~ Game in Database:", game)
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
          console.log("🚀 ~ file: scrapping.service.ts:134 ~ ScrappingService ~ scrapeEbay ~ Result scrapping:", item)
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
            // ean: null,
            console: game.consoleName,
          };
          console.log(
            '🚀 ~ file: scrapping.service.ts:166 ~ ScrappingService ~ scrapeEbay ~ transformedItem:',
            transformedItem,
          );

          // Si l'objet n'est pas complet. je ne push pas en base.
          if (Object.values(transformedItem).every((value) => value !== null)) {
            const gameToUpdate = await this.gameService.getById(game.id);
            // Check if the game to update matches the current item based on title, console, and zone.
            // If it does, update the game's cibPrice and ebayDate with the item's priceSold and dateSold respectively.
            // The priceSold is converted from a string to a float, replacing any commas with dots for decimal notation.
            if (
              gameToUpdate.productName === transformedItem.title &&
              gameToUpdate.consoleName === transformedItem.console &&
              gameToUpdate.zone.toUpperCase() == transformedItem.zone.toUpperCase()
            ) {
              console.log(
                '🚀 ~ file: scrapping.service.ts:180 ~ ScrappingService ~ scrapeEbay ~ Update in database:',
                gameToUpdate,
              );
              await this.gameService.updateById(gameToUpdate.id, {
                cibPrice: parseFloat(
                  transformedItem.priceSold.replace(',', '.'),
                ),
                ebayDate: transformedItem.dateSold,
              } as UpdateGameDto);
            }
          }
        }

        // Close the browser and wait for 10 sec before the next iteration
        await browser.close();
        await new Promise((resolve) => setTimeout(resolve, 60000));
      }
    }
  }
}
