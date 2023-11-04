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
    const gamesRandomOrder: Game[] = [...games.slice(start), ...games.slice(0, start)];

    // Iterate over each game
    for (const game of gamesRandomOrder) {
      // Define the search configuration for the current game
      const SEARCH_CONFIG: { title: string, console: string, searchTerm: string, location: string } = {
        title: game.productName,
        console: game.consoleName,
        searchTerm: 'complet',
        location: '1',
      };

      // Function to create the URL for the eBay search
      const createUrl = (config: { title: string, console: string, searchTerm: string, location: string }): string => {
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
        const transformedData = data
          .map((item) => {
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

        // If transformed data was found, update the game data in the database
        if (transformedData.length > 0) {
          for (const item of transformedData) {
            const gameToUpdate = await this.gameService.getById(game.id);

            // Check if the game to update matches the current item based on title, console, and zone.
            // If it does, update the game's cibPrice and ebayDate with the item's priceSold and dateSold respectively.
            // The priceSold is converted from a string to a float, replacing any commas with dots for decimal notation.
            if (
              gameToUpdate.productName === item.title &&
              gameToUpdate.consoleName === item.console &&
              gameToUpdate.zone == item.zone.toUpperCase()
            ) {

              this.logger.log(
                `[Scrapping Service] Item:  ${JSON.stringify(item)}`,
              );
              this.logger.log(
                `[Scrapping Service] GameToUpdate:  ${JSON.stringify(gameToUpdate)}`,
              );
              await this.gameService.updateById(gameToUpdate.id, {
                cibPrice: parseFloat(item.priceSold.replace(',', '.')),
                ebayDate: item.dateSold,
              } as UpdateGameDto);
            }
          }
        }
      }

      // Close the browser and wait for 1 minute before the next iteration
      await browser.close();
      await new Promise((resolve) => setTimeout(resolve, 10000));
    }
  }
}

// Todo anaylyser les logs pour améliorer le scrapping 😊


// [Nest] 79672  - 04/11/2023 13:26:51     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Conan","priceSold":"31,11","dateSold":" 21 sept. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:26:51     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45281","asin":"none","upc":"none","productName":"Conan","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2005-04-15","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 79672  - 04/11/2023 13:26:51     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Conan","priceSold":"24,22","dateSold":" 27 août 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:26:51     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45281","asin":"none","upc":"none","productName":"Conan","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2005-04-15","loosePrice":null,"cibPrice":31,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 21 sept. 2023"}
// [Nest] 79672  - 04/11/2023 13:26:52     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Conan","priceSold":"62,23","dateSold":" 6 août 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:26:52     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45281","asin":"none","upc":"none","productName":"Conan","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2005-04-15","loosePrice":null,"cibPrice":24,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 27 août 2023"}




// [Nest] 79672  - 04/11/2023 13:27:04     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Conflict Desert Storm","priceSold":"19,00","dateSold":" 30 août 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:27:04     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45282","asin":"none","upc":"none","productName":"Conflict Desert Storm","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2003-04-17","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 79672  - 04/11/2023 13:27:04     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Conflict Desert Storm","priceSold":"29,02","dateSold":" 31 oct. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:27:04     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45282","asin":"none","upc":"none","productName":"Conflict Desert Storm","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2003-04-17","loosePrice":null,"cibPrice":19,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 30 août 2023"}
// [Nest] 79672  - 04/11/2023 13:27:04     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Conflict Desert Storm","priceSold":"8,01","dateSold":" 14 sept. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:27:04     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45282","asin":"none","upc":"none","productName":"Conflict Desert Storm","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2003-04-17","loosePrice":null,"cibPrice":29,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 31 oct. 2023"}


// [Nest] 79672  - 04/11/2023 13:27:16     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Conflict Desert Storm 2","priceSold":"10,50","dateSold":" 8 oct. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:27:16     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45283","asin":"none","upc":"none","productName":"Conflict Desert Storm 2","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2004-02-06","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 79672  - 04/11/2023 13:27:17     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Conflict Desert Storm 2","priceSold":"4,98","dateSold":" 25 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:27:17     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45283","asin":"none","upc":"none","productName":"Conflict Desert Storm 2","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2004-02-06","loosePrice":null,"cibPrice":10,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 8 oct. 2023"}


// [Nest] 79672  - 04/11/2023 13:27:41     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Crash Nitro Kart","priceSold":"29,00","dateSold":" 31 août 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:27:41     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45285","asin":"none","upc":"none","productName":"Crash Nitro Kart","consoleName":"Gamecube","genre":"Racing","releaseDate":"2003-11-28","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 79672  - 04/11/2023 13:27:41     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Crash Nitro Kart","priceSold":"28,28","dateSold":" 8 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:27:41     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45285","asin":"none","upc":"none","productName":"Crash Nitro Kart","consoleName":"Gamecube","genre":"Racing","releaseDate":"2003-11-28","loosePrice":null,"cibPrice":29,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 31 août 2023"}


// [Nest] 79672  - 04/11/2023 13:27:54     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Crash Tag Team Racing","priceSold":"33,95","dateSold":" 22 août 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:27:54     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45286","asin":"none","upc":"none","productName":"Crash Tag Team Racing","consoleName":"Gamecube","genre":"Racing","releaseDate":"2005-11-11","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}


// [Nest] 79672  - 04/11/2023 13:28:07     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Crazy Taxi","priceSold":"38,50","dateSold":" 18 sept. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:28:07     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45287","asin":"none","upc":"none","productName":"Crazy Taxi","consoleName":"Gamecube","genre":"Racing","releaseDate":"2002-05-03","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 79672  - 04/11/2023 13:28:07     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Crazy Taxi","priceSold":"49,99","dateSold":" 22 sept. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:28:07     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45287","asin":"none","upc":"none","productName":"Crazy Taxi","consoleName":"Gamecube","genre":"Racing","releaseDate":"2002-05-03","loosePrice":null,"cibPrice":38,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 18 sept. 2023"}


// [Nest] 79672  - 04/11/2023 13:28:18     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Titeuf","priceSold":"19,95","dateSold":" 23 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"GameBoy Color"}
// [Nest] 79672  - 04/11/2023 13:28:18     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"704641","asin":null,"upc":null,"productName":"Titeuf","consoleName":"GameBoy Color","genre":"Party","releaseDate":"2001-06-07","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 79672  - 04/11/2023 13:28:18     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Titeuf","priceSold":"24,99","dateSold":" 22 août 2023","condition":"Très Bon État","completeness":"Complet","zone":"Pal","console":"GameBoy Color"}
// [Nest] 79672  - 04/11/2023 13:28:18     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"704641","asin":null,"upc":null,"productName":"Titeuf","consoleName":"GameBoy Color","genre":"Party","releaseDate":"2001-06-07","loosePrice":null,"cibPrice":19,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 23 oct. 2023"}

// [Nest] 79672  - 04/11/2023 13:28:32     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Dancing Stage Mario Mix","priceSold":"34,50","dateSold":" 27 août 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:28:32     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45289","asin":"none","upc":"none","productName":"Dancing Stage Mario Mix","consoleName":"Gamecube","genre":"Other","releaseDate":"2005-10-28","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}


// [Nest] 79672  - 04/11/2023 13:28:44     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Dark Summit","priceSold":"10,00","dateSold":" 8 oct. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:28:44     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45290","asin":"none","upc":"none","productName":"Dark Summit","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2002-05-24","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}


// [Nest] 79672  - 04/11/2023 13:29:21     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Digimon Rumble Arena 2","priceSold":"46,11","dateSold":" 30 oct. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:29:21     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45298","asin":"none","upc":"none","productName":"Digimon Rumble Arena 2","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2004-10-15","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 79672  - 04/11/2023 13:29:21     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Digimon Rumble Arena 2","priceSold":"44,95","dateSold":" 20 août 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:29:21     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45298","asin":"none","upc":"none","productName":"Digimon Rumble Arena 2","consoleName":"Gamecube","genre":"Action & Adventure","releaseDate":"2004-10-15","loosePrice":null,"cibPrice":46,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 30 oct. 2023"}


// [Nest] 79672  - 04/11/2023 13:29:22     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Theme Park","priceSold":"14,50","dateSold":" 10 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Saturn"}
// [Nest] 79672  - 04/11/2023 13:29:22     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"72718","asin":null,"upc":"5015839286971","productName":"Theme Park","consoleName":"Sega Saturn","genre":"Simulation","releaseDate":"1995-10-30","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}


// [Nest] 79672  - 04/11/2023 13:30:22     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Disney's Extreme Skate Adventure","priceSold":"22,08","dateSold":" 13 août 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Gamecube"}
// [Nest] 79672  - 04/11/2023 13:30:22     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"45303","asin":"none","upc":"none","productName":"Disney's Extreme Skate Adventure","consoleName":"Gamecube","genre":"Extreme Sports","releaseDate":"2003-09-05","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}