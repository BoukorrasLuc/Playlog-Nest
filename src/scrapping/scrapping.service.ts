import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
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
import { createLogger, format, transports } from 'winston';

const logger = createLogger({
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    format.json()
  ),
  transports: [
    new transports.File({ filename: 'src/scrapping/.logs.json' })
  ]
});

@Injectable()
export class ScrappingService {
  private readonly logger: LoggerService;
  constructor(private gameService: GameService) {
    this.logger = new Logger('ScrappingService');
    this.logger.log('ScrappingService Initialized');
  }

  // // @Cron('0 0 * * *') // This task runs every day at midnight
  // @Cron('* * * * *') // This task runs every minute
  // // This function scrapes the eBay website for game data


  

  async onApplicationBootstrap() {
    const gamesRandomOrder = await this.itemOfDatabase();

    // Iterate over each game
    for (const game of gamesRandomOrder) {
      // Scrape data for the current game
      await this.scrapeEbayVideoGamesManualOnly([game]);
      await this.scrapeEbayVideoGamesBoxOnly([game]);
      await this.scrapeEbayVideoGamesComplete([game]);
    }
  }

  async itemOfDatabase() {
    // Fetch all games from the database
    const games: Game[] = await this.gameService.getAll();

    // Randomize the starting point in the games array to avoid bias
    const start: number = Math.floor(Math.random() * games.length);
    const gamesRandomOrder: Game[] = [
      ...games.slice(start),
      ...games.slice(0, start),
    ];

    return gamesRandomOrder;
  }

  async scrapeEbayVideoGamesComplete(gameRandomOrder: any) {
    try {
      // Iterate over each game
      for (const game of gameRandomOrder) {
        // Only update games with zone "PAL" or "JAP"
        if (game.zone === 'PAL' || game.zone === 'JAP') {
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
                  ?.textContent ===
                "Aucun résultat correspondant n'a été trouvé"
              );
            });
            if (noResultsFound) {
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
                      logger.error(
                        `file: scrapping.service.ts:147 [Scrapping Service : scrapeEbayVideoGamesComplete] Error found in map: ${error}`,
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
              logger.info("🚀 ~ ScrappingService ~ scrapeEbayVideoGamesComplete ~ item:", item)

              // If the name of the scraped ad does not include the console name, skip this iteration
              if (
                !item.name
                  .toLocaleLowerCase()
                  .includes(game.consoleName.toLocaleLowerCase())
              ) {
                continue;
              }



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
              logger.info("🚀 ~ ScrappingService ~ scrapeEbayVideoGamesComplete ~ transformedItem:", transformedItem)

              const { condition, ...otherProps } = transformedItem;

              if (Object.values(otherProps).every((value) => value !== null)) {
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

                  const gameToUpdated = await this.gameService.getById(game.id);

                  logger.info(
                    `[Scrapping Service : scrapeEbayVideoGamesComplete] This game is update: ${JSON.stringify(
                      gameToUpdated,
                    )}`,
                  );
                }
              }
            }

            await browser.close();
          } catch (error) {
            logger.error(
              'file: scrapping.service.ts:244 [Scrapping Service : scrapeEbayVideoGamesComplete] error:',
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
      logger.error(
        'file: scrapping.service.ts:256 [Scrapping Service : scrapeEbayVideoGamesComplete] error:',
        error,
      );
    }
  }

  async scrapeEbayVideoGamesManualOnly(gameRandomOrder: any) {
    try {
      // Iterate over each game
      for (const game of gameRandomOrder) {
        // Only update games with zone "PAL" or "JAP"
        if (game.zone === 'PAL' || game.zone === 'JAP') {
          // Define the search configuration for the current game
          const SEARCH_CONFIG: {
            title: string;
            console: string;
            searchTerm: string;
            location: string;
          } = {
            title: game.productName,
            console: game.consoleName,
            searchTerm: 'notice seul',
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
                  ?.textContent ===
                "Aucun résultat correspondant n'a été trouvé"
              );
            });
            if (noResultsFound) {
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
                      logger.error(
                        `file: scrapping.service.ts:355 [Scrapping Service : scrapeEbayVideoGamesManualOnly] Error found in map: ${error}`,
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
              logger.info("🚀 ~ ScrappingService ~ scrapeEbayVideoGamesManualOnly ~ item:", item)

              // If the name of the scraped ad does not include the console name, skip this iteration
              if (
                !item.name
                  .toLocaleLowerCase()
                  .includes(game.consoleName.toLocaleLowerCase())
              ) {
                continue;
              }


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
              logger.info("🚀 ~ ScrappingService ~ scrapeEbayVideoGamesManualOnly ~ transformedItem:", transformedItem)

              const { condition, ...otherProps } = transformedItem;

              if (Object.values(otherProps).every((value) => value !== null)) {
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
                    manualOnlyPrice: parseFloat(
                      transformedItem.priceSold.replace(',', '.'),
                    ),
                    ebayDate: transformedItem.dateSold.substring(1),
                  } as UpdateGameDto);

                  const gameToUpdated = await this.gameService.getById(game.id);

                  logger.info(
                    `[Scrapping Service : scrapeEbayVideoGamesManualOnly] This game is update: ${JSON.stringify(
                      gameToUpdated,
                    )}`,
                  );
                }
              }
            }

            await browser.close();
          } catch (error) {
            logger.error(
              'file: scrapping.service.ts:453 [Scrapping Service : scrapeEbayVideoGamesManualOnly] error:',
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
      logger.error(
        'file: scrapping.service.ts:465 [Scrapping Service : scrapeEbayVideoGamesManualOnly] error:',
        error,
      );
    }
  }

  async scrapeEbayVideoGamesBoxOnly(gameRandomOrder: any) {
    try {
      // Iterate over each game
      for (const game of gameRandomOrder) {
        // Only update games with zone "PAL" or "JAP"
        if (game.zone === 'PAL' || game.zone === 'JAP') {
          // Define the search configuration for the current game
          const SEARCH_CONFIG: {
            title: string;
            console: string;
            searchTerm: string;
            location: string;
          } = {
            title: game.productName,
            console: game.consoleName,
            searchTerm: 'boite seul',
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
                  ?.textContent ===
                "Aucun résultat correspondant n'a été trouvé"
              );
            });
            if (noResultsFound) {
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
                      logger.error(
                        `file: scrapping.service.ts:564 [Scrapping Service : scrapeEbayVideoGamesBoxOnly] Error found in map: ${error}`,
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
              logger.info("🚀 ~ ScrappingService ~ scrapeEbayVideoGamesBoxOnly ~ item:", item)

              // If the name of the scraped ad does not include the console name, skip this iteration
              if (
                !item.name
                  .toLocaleLowerCase()
                  .includes(game.consoleName.toLocaleLowerCase())
              ) {
                continue;
              }

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
              logger.info("🚀 ~ ScrappingService ~ scrapeEbayVideoGamesBoxOnly ~ transformedItem:", transformedItem)

              const { condition, ...otherProps } = transformedItem;

              if (Object.values(otherProps).every((value) => value !== null)) {
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
                    boxOnlyPrice: parseFloat(
                      transformedItem.priceSold.replace(',', '.'),
                    ),
                    ebayDate: transformedItem.dateSold.substring(1),
                  } as UpdateGameDto);

                  const gameToUpdated = await this.gameService.getById(game.id);

                  logger.info(
                    `[Scrapping Service : scrapeEbayVideoGamesBoxOnly] This game is update: ${JSON.stringify(
                      gameToUpdated,
                    )}`,
                  );
                }
              }
            }

            await browser.close();
          } catch (error) {
            logger.error(
              'file: scrapping.service.ts:663 [Scrapping Service : scrapeEbayVideoGamesBoxOnly] error:',
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
      logger.error(
        'file: scrapping.service.ts:675 [Scrapping Service : scrapeEbayVideoGamesBoxOnly] error:',
        error,
      );
    }
  }
}
