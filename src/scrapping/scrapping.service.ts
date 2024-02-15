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
  @Cron('* * * * *') // This task runs every minute
  // This function scrapes the eBay website for game data
  async scrapeEbay() {
    try {
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
        if (game.zone === 'PAL') {
          // console.log("🚀 ~ file: scrapping.service.ts:42 ~ ScrappingService ~ scrapeEbay ~ game:", game)
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

          try {
            const page = await browser.newPage();
            await page.goto(url);

            // Check if "Aucun résultat correspondant n'a été trouvé" was found, if so, skip this iteration
            const noResultsFound = await page.evaluate(() => {
              return (
                document.querySelector('.srp-save-null-search__heading')
                  ?.textContent === "Aucun résultat correspondant n'a été trouvé"
              );
            });
            if (noResultsFound) {
              // this.logger.log(
              //   '🚀 ~ file: scrapping.service.ts:76 ~ ScrappingService ~ scrapeEbay ~ noResultsFound:',
              //   noResultsFound,
              // );
              continue;
            }

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
                      return {};
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
                console: game.consoleName,
              };

              const { condition, ...otherProps } = transformedItem;

              if (Object.values(otherProps).every((value) => value !== null)) {
                // this.logger.log(
                //   '🚀 ~ file: scrapping.service.ts:167 ~ ScrappingService ~ scrapeEbay ~ transformedItem:',
                //   transformedItem,
                // );

                const gameToUpdate = await this.gameService.getById(game.id);

                if (
                  gameToUpdate.productName.toUpperCase() ===
                    transformedItem.title.toUpperCase() &&
                  gameToUpdate.consoleName.toUpperCase() ===
                    transformedItem.console.toUpperCase() &&
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
            // await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            this.logger.error(
              '🚀 ~ file: scrapping.service.ts:212 ~ ScrappingService ~ scrapeEbay ~ error:',
              error,
            );
          } finally {
            if (browser) {
              await browser.close();
            }
          }
        }
      }
    } catch (error) {
      this.logger.error(
        '🚀 ~ file: scrapping.service.ts:212 ~ ScrappingService ~ scrapeEbay ~ error:',
        error,
      );
    }
  }
}

// Dernier test sur dix resultats après vérification sur ebay: 

// ✅ [Nest] 24841  - 15/02/2024 19:09:38     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"2070569","asin":null,"upc":"5030917132179","productName":"Angry Birds Star Wars","consoleName":"Nintendo 3DS","genre":"Arcade","releaseDate":"2013-11-01","loosePrice":null,"cibPrice":22.07,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":"3 sept. 2023"}
// ⚠️ Pas la Bonne console, il a trouvé une wii u à la place [Nest] 24841  - 15/02/2024 19:10:17     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"2250861","asin":null,"upc":null,"productName":"Angry Birds Trilogy","consoleName":"Nintendo 3DS","genre":"Puzzle","releaseDate":"2012-08-25","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// ✅ [Nest] 24841  - 15/02/2024 19:10:55     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"52837","asin":"none","upc":"4944076000471","productName":"Cotton Boomerang","consoleName":"Sega Saturn","genre":"Shoot'em Up","releaseDate":"1998-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"JAP","ebayDate":null}
// ✅ [Nest] 24841  - 15/02/2024 19:10:57     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"52886","asin":"none","upc":"4974365091897","productName":"Deep Fear","consoleName":"Sega Saturn","genre":"Action & Adventure","releaseDate":"1998-07-16","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"JAP","ebayDate":null}
// ✅ [Nest] 24841  - 15/02/2024 19:10:59     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"52915","asin":"none","upc":"none","productName":"DoDonPachi","consoleName":"Sega Saturn","genre":"Action & Adventure","releaseDate":"1998-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"JAP","ebayDate":null}
// ✅ [Nest] 24841  - 15/02/2024 19:11:02     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"52916","asin":"none","upc":"none","productName":"DonPachi","consoleName":"Sega Saturn","genre":"Shoot'em Up","releaseDate":"1996-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"JAP","ebayDate":null}
// ✅ [Nest] 24841  - 15/02/2024 19:11:15     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"52989","asin":"B000069U6B","upc":"none","productName":"Layer Section","consoleName":"Sega Saturn","genre":"Shoot'em Up","releaseDate":"1995-09-14","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"JAP","ebayDate":null}
// ✅ [Nest] 24841  - 15/02/2024 19:11:45     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"53219","asin":"none","upc":"4964808200030","productName":"Metal Slug","consoleName":"Sega Saturn","genre":"Action & Adventure","releaseDate":"1997-04-04","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"JAP","ebayDate":null}
// ✅ [Nest] 24841  - 15/02/2024 19:11:55     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"53291","asin":"B000069T74","upc":"4974365090494","productName":"Panzer Dragoon II Zwei","consoleName":"Sega Saturn","genre":"Action & Adventure","releaseDate":"1996-03-22","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"JAP","ebayDate":null}
// ✅ [Nest] 24841  - 15/02/2024 19:12:00     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"53306","asin":"B000069TX4","upc":"4988602017663","productName":"Policenauts","consoleName":"Sega Saturn","genre":"Action & Adventure","releaseDate":"1998-09-13","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"JAP","ebayDate":null}
// ✅ [Nest] 24841  - 15/02/2024 19:12:23     LOG [ScrappingService] [Scrapping Service] This game is update: {"id":"53508","asin":"none","upc":"4984995800073","productName":"Strikers 1945","consoleName":"Sega Saturn","genre":"Shoot'em Up","releaseDate":"1996-06-28","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"JAP","ebayDate":null}