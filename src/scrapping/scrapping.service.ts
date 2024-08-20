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

/**
 * This logger configuration creates a Winston logger instance.
 * The logger is configured to format log messages with a timestamp and in JSON format.
 * The log messages are saved to a file named '.logs.json' located in the 'src/scrapping' directory.
 * 
 * @returns A configured Winston logger instance.
 */
const logger = createLogger({
  format: format.combine(
    format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss',
    }),
    format.json(),
  ),
  transports: [new transports.File({ filename: 'src/scrapping/logs/price_updates.json' })],
});

@Injectable()
export class ScrappingService {
  private readonly logger: LoggerService;
  constructor(private gameService: GameService) {
    this.logger = new Logger('ScrappingService');
    this.logger.log('ScrappingService Initialized');
  }



  /**
   * This function is called when the application is fully initialized.
   * It fetches a randomized order of games from the database and iterates over each game.
   * For each game, it scrapes data from eBay for different conditions: manual only, box only, and complete.
   */
  async onApplicationBootstrap() {
    const gamesRandomOrder = await this.itemOfDatabase();

    // Iterate over each game
    for (const game of gamesRandomOrder) {
      // Scrape data for the current game
      // await this.scrapeEbayVideoGamesManualOnly([game]);
      // await this.scrapeEbayVideoGamesBoxOnly([game]);
      await this.scrapeEbayVideoGamesComplete([game]);
    }
  }

  /**
   * This function fetches all games from the database and returns them in a randomized order.
   * It first retrieves all games, then randomizes the starting point in the games array to avoid bias.
   * 
   * @returns A promise that resolves to an array of games in random order.
   */
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

  /**
   * This function scrapes eBay for complete video games based on a randomized order of games.
   * It iterates over each game, constructs a search URL, and scrapes the data from the eBay page.
   * If the scraped data matches the game details, it updates the game information in the database.
   * 
   * @param gameRandomOrder - An array of games in random order.
   */
  async scrapeEbayVideoGamesComplete(gameRandomOrder: any) {
    try {
      // Iterate over each game
      for (const game of gameRandomOrder) {
        // Only update games with zone "PAL" or "JAP"
        if (game.zone === 'PAL' || game.zone === 'JAP') {
          /**
           * Defines the search configuration for the current game.
           */
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

          /**
           * Function to create the URL for the eBay search.
           * 
           * @param config - The search configuration object.
           * @returns The constructed eBay search URL.
           */
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
          const browser = await puppeteer.launch({ headless: true });

          try {
            const page = await browser.newPage();
            await page.goto(url);

            /**
             * Check if "Aucun résultat correspondant n'a été trouvé" was found, if so, skip this iteration.
             * 
             * @returns A boolean indicating whether no results were found.
             */
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

            /**
             * Scrape the data from the eBay page.
             * 
             * @param searchTerm - The search term used in the eBay search.
             * @param title - The title of the game.
             * @returns An array of scraped data objects.
             */
            
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
                            'span.s-item__caption--signal.POSITIVE span',
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
              this.logger.log(
                '🚀 ~ ScrappingService ~ scrapeEbayVideoGamesComplete ~ item:',
                item,
              );

              /**
               * If the name of the scraped ad does not include the console name, skip this iteration.
               * This ensures that only relevant items are processed.
               */
              if (
                !item.name
                  .toLocaleLowerCase()
                  .includes(game.consoleName.toLocaleLowerCase())
              ) {
                continue;
              }

              /**
               * This block matches the zone information in the title of the item.
               * It uses a regular expression to find the zone details within the item's name.
               * 
               * @param item.name - The title of the item to be matched against the zone regex.
               * @returns An array containing the matched zone information, or null if no match is found.
               */
              const matchTitleZone = item.name.match(regexZone);

              /**
               * This block matches the completeness information in the title of the item.
               * It uses a regular expression to find the completeness details within the item's name.
               * 
               * @param item.name - The title of the item to be matched against the completeness regex.
               * @returns An array containing the matched completeness information, or null if no match is found.
               */
              const matchTitleCompleteness = item.name.match(regexCompleteness);

              /**
               * This block matches the condition information in the title of the item.
               * It uses a regular expression to find the condition details within the item's name.
               * 
               * @param item.name - The title of the item to be matched against the condition regex.
               * @returns An array containing the matched condition information, or null if no match is found.
               */
              const matchCondition = item.name.match(regexCondition);

              /**
               * This block removes unnecessary elements from the title of the item.
               * It uses a regular expression to identify and delete specific parts of the title.
               * After the replacements, it trims any leading or trailing whitespace from the title.
               * 
               * @param item.name - The original title of the item.
               * @returns The cleaned and trimmed title.
               */
              const newTitle = item.name
                .replace(regexDeleteElementOfTitle, '')
                .trim();

              /**
               * Remove console name from title.
               * This is done to clean up the title and make it more readable.
               */
              const regexConsoleName = new RegExp(game.consoleName, 'gi');
              const finalTitle = newTitle.replace(regexConsoleName, '').trim();

              /**
               * Transform the scraped item into a structured format.
               * This includes capitalizing the first letter of each word in the title,
               * extracting the price, date, condition, completeness, and zone.
               */
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
              this.logger.log(
                '🚀 ~ ScrappingService ~ scrapeEbayVideoGamesComplete ~ transformedItem:',
                transformedItem,
              );

              // Destructure the condition from the transformed item
              const { condition, ...otherProps } = transformedItem;

              /**
               * Check if all other properties of the transformed item are not null.
               * If they are valid, proceed to update the game information in the database.
               */
              if (Object.values(otherProps).every((value) => value !== null)) {
                const gameToUpdate = await this.gameService.getById(game.id);

                /**
                 * Check if the game to update matches the transformed item.
                 * If it matches, update the game information in the database.
                 */
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
                      null,
                      2 // Indentation level for pretty-printing
                    )}`,
                  );
                }
              }
            }

            await browser.close();
          } catch (error) {
            this.logger.error(
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
      this.logger.error(
        'file: scrapping.service.ts:256 [Scrapping Service : scrapeEbayVideoGamesComplete] error:',
        error,
      );
    }
  }

/**
 * This function scrapes eBay for video game manuals based on a randomized order of games.
 * It iterates over each game, constructs a search URL, and scrapes the data from the eBay page.
 * If the scraped data matches the game details, it updates the game information in the database.
 * 
 * @param gameRandomOrder - An array of games in random order.
 */
async scrapeEbayVideoGamesManualOnly(gameRandomOrder: any) {
  try {
    // Iterate over each game
    for (const game of gameRandomOrder) {
      // Only update games with zone "PAL" or "JAP"
      if (game.zone === 'PAL' || game.zone === 'JAP') {
        /**
         * Defines the search configuration for the current game.
         */
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

        /**
         * Function to create the URL for the eBay search.
         * 
         * @param config - The search configuration object.
         * @returns The constructed eBay search URL.
         */
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
        const browser = await puppeteer.launch({ headless: true });

        try {
          const page = await browser.newPage();
          await page.goto(url);

          /**
           * Check if "Aucun résultat correspondant n'a été trouvé" was found, if so, skip this iteration.
           * 
           * @returns A boolean indicating whether no results were found.
           */
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

          /**
           * Scrape the data from the eBay page.
           * 
           * @param searchTerm - The search term used in the eBay search.
           * @param title - The title of the game.
           * @returns An array of scraped data objects.
           */
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
                          'span.s-item__caption--signal.POSITIVE span',
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

          /**
           * If data was found, transform it
           */
          if (data.length > 0) {
            /**
             * The first item from the data array
             */
            const item = data[0];
            this.logger.log(
              '🚀 ~ ScrappingService ~ scrapeEbayVideoGamesManualOnly ~ item:',
              item,
            );

            /**
             * If the name of the scraped ad does not include the console name, skip this iteration
             */
            if (
              !item.name
                .toLocaleLowerCase()
                .includes(game.consoleName.toLocaleLowerCase())
            ) {
              continue;
            }

            /**
             * Match the zone in the title
             */
            const matchTitleZone = item.name.match(regexZone);

            /**
             * Match the completeness in the title
             */
            const matchTitleCompleteness = item.name.match(regexCompleteness);

            /**
             * Match the condition in the title
             */
            const matchCondition = item.name.match(regexCondition);

            /**
             * Create a new title by removing certain elements from the original title
             */
            const newTitle = item.name
              .replace(regexDeleteElementOfTitle, '')
              .trim();

            /**
             * Remove console name from title
             */
            const regexConsoleName = new RegExp(game.consoleName, 'gi');
            const finalTitle = newTitle.replace(regexConsoleName, '').trim();

            /**
             * Transformed item with updated properties
             */
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
            this.logger.log(
              '🚀 ~ ScrappingService ~ scrapeEbayVideoGamesManualOnly ~ transformedItem:',
              transformedItem,
            );

            /**
             * Destructure the transformed item to separate condition from other properties
             */
            const { condition, ...otherProps } = transformedItem;

            /**
             * If all other properties are not null, proceed to update the game
             */
            if (Object.values(otherProps).every((value) => value !== null)) {
              /**
               * Fetch the game to update from the database
               */
              const gameToUpdate = await this.gameService.getById(game.id);

              /**
               * If the game details match the transformed item, update the game in the database
               */
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

                /**
                 * Fetch the updated game from the database
                 */
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
          this.logger.error(
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
    this.logger.error(
      'file: scrapping.service.ts:465 [Scrapping Service : scrapeEbayVideoGamesManualOnly] error:',
      error,
    );
  }
}

/**
 * This function scrapes eBay for video game boxes based on a randomized order of games.
 * It iterates over each game, constructs a search URL, and scrapes the data from the eBay page.
 * If the scraped data matches the game details, it updates the game information in the database.
 * 
 * @param gameRandomOrder - An array of games in random order.
 */
async scrapeEbayVideoGamesBoxOnly(gameRandomOrder: any) {
  try {
    // Iterate over each game
    for (const game of gameRandomOrder) {
      // Only update games with zone "PAL" or "JAP"
      if (game.zone === 'PAL' || game.zone === 'JAP') {
        /**
         * Defines the search configuration for the current game.
         */
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

        /**
         * Function to create the URL for the eBay search.
         * 
         * @param config - The search configuration object.
         * @returns The constructed eBay search URL.
         */
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
        const browser = await puppeteer.launch({ headless: true });

        try {
          const page = await browser.newPage();
          await page.goto(url);

          /**
           * Check if "Aucun résultat correspondant n'a été trouvé" was found, if so, skip this iteration.
           * 
           * @returns A boolean indicating whether no results were found.
           */
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

          /**
           * Scrape the data from the eBay page.
           * 
           * @param searchTerm - The search term used in the eBay search.
           * @param title - The title of the game.
           * @returns An array of scraped data objects.
           */
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
                          'span.s-item__caption--signal.POSITIVE span',
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

          /**
           * If data was found, transform it
           */
          if (data.length > 0) {
            /**
             * The first item from the data array
             */
            const item = data[0];
            this.logger.log(
              '🚀 ~ ScrappingService ~ scrapeEbayVideoGamesBoxOnly ~ item:',
              item,
            );

            /**
             * If the name of the scraped ad does not include the console name, skip this iteration
             */
            if (
              !item.name
                .toLocaleLowerCase()
                .includes(game.consoleName.toLocaleLowerCase())
            ) {
              continue;
            }

            /**
             * Match the zone in the title
             */
            const matchTitleZone = item.name.match(regexZone);

            /**
             * Match the completeness in the title
             */
            const matchTitleCompleteness = item.name.match(regexCompleteness);

            /**
             * Match the condition in the title
             */
            const matchCondition = item.name.match(regexCondition);

            /**
             * Create a new title by removing certain elements from the original title
             */
            const newTitle = item.name
              .replace(regexDeleteElementOfTitle, '')
              .trim();

            /**
             * Remove console name from title
             */
            const regexConsoleName = new RegExp(game.consoleName, 'gi');
            const finalTitle = newTitle.replace(regexConsoleName, '').trim();

            /**
             * Transforms the scraped item data into a structured object.
             */
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
            this.logger.log(
              '🚀 ~ ScrappingService ~ scrapeEbayVideoGamesBoxOnly ~ transformedItem:',
              transformedItem,
            );

            /**
             * Destructure the transformed item to separate condition from other properties
             */
            const { condition, ...otherProps } = transformedItem;

            /**
             * Check if all required properties are not null
             */
            if (Object.values(otherProps).every((value) => value !== null)) {
              /**
               * Fetch the game to update from the database
               */
              const gameToUpdate = await this.gameService.getById(game.id);

              /**
               * Check if the game details match the transformed item details
               */
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

                /**
                 * Fetch the updated game from the database
                 */
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
          this.logger.error(
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
    this.logger.error(
      'file: scrapping.service.ts:675 [Scrapping Service : scrapeEbayVideoGamesBoxOnly] error:',
      error,
    );
  }
}
}
