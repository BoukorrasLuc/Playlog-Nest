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
            console.log(
              '🚀 ~ file: scrapping.service.ts:76 ~ ScrappingService ~ scrapeEbay ~ noResultsFound:',
              noResultsFound,
            );
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
              console.log(
                '🚀 ~ file: scrapping.service.ts:167 ~ ScrappingService ~ scrapeEbay ~ transformedItem:',
                transformedItem,
              );

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
          await new Promise((resolve) => setTimeout(resolve, 10000));
        } catch (error) {
          console.log(
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
  }
}

// Notice Seul : https://www.ebay.fr/sch/i.html?_from=R40&_trksid=p2334524.m570.l1313&_nkw=+notice+seul+gamecube&_sacat=0&LH_TitleDesc=0&_odkw=Metroid+Prime+notice+seul+gamecube&_osacat=0&LH_Complete=1&LH_Sold=1

// Bug avec cette url. https://www.ebay.fr/sch/i.html?_from=R40&_trksid=p2334524.m570.l1313&_nkw=Colin+Mcrae+Rally+gameboy+color+complet&_sacat=0&LH_TitleDesc=0&rt=nc&_odkw=Colin+Mcrae+Rally+game+boy+complet&_osacat=0&LH_Complete=1&LH_Sold=1

// Aucun résultat correspondant n'a été trouvé du coup c'est prends la premiere annonce qui ne correspondant du coup. Du coup la il a enregistrer la mauvaise annonce. le nom du jeux correspondant mais pas la console.
// Résultats correspondant à moins de mots

// Débug Ok.
