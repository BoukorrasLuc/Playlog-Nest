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

    // Iterate over each game // Todo delete !
    for (const game of gamesRandomOrder) {
      // condition just for update game with zone "PAL" // 
      if (game.zone === 'PAL') {
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
            // enregistrer le 1er éléments du resultat du scrapping // Todo improvemnt // Maybe une moyenne des prix de vente. A réflechire. 
            if (transformedData[0]) {
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
                    `[Scrapping Service] GameToUpdate:  ${JSON.stringify(
                      gameToUpdate,
                    )}`,
                  );
                  await this.gameService.updateById(gameToUpdate.id, {
                    cibPrice: parseFloat(item.priceSold.replace(',', '.')),
                    ebayDate: item.dateSold,
                  } as UpdateGameDto);
                }
              }
            }
          }
        }

        // Close the browser and wait for 10 sec before the next iteration
        await browser.close();
        await new Promise((resolve) => setTimeout(resolve, 10000));
      }
    }
  }
}

// [Nest] 22647  - 06/11/2023 19:23:14     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Dreamfall Chapters","priceSold":"5,51","dateSold":" 10 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Playstation 4"}
// [Nest] 22647  - 06/11/2023 19:23:14     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"68978","asin":"B07D6WH9YF","upc":null,"productName":"Dreamfall Chapters","consoleName":"Playstation 4","genre":"Action & Adventure","releaseDate":"2017-05-05","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:25:27     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Jojo's Bizarre Adventure","priceSold":"203,00","dateSold":" 17 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Dreamcast"}
// [Nest] 22647  - 06/11/2023 19:25:27     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61310","asin":"none","upc":"none","productName":"Jojo's Bizarre Adventure","consoleName":"Sega Dreamcast","genre":"Action & Adventure","releaseDate":"2000-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:26:15     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Starsky & Hutch","priceSold":"14,00","dateSold":" 13 oct. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"GameBoy Advance"}
// [Nest] 22647  - 06/11/2023 19:26:15     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"56646","asin":"none","upc":"none","productName":"Starsky & Hutch","consoleName":"GameBoy Advance","genre":"Action & Adventure","releaseDate":"2003-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:26:41     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Metropolis Street Racer","priceSold":"9,00","dateSold":" 17 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Dreamcast"}
// [Nest] 22647  - 06/11/2023 19:26:41     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61316","asin":"none","upc":"none","productName":"Metropolis Street Racer","consoleName":"Sega Dreamcast","genre":"Racing","releaseDate":"2000-11-03","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:26:54     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Mortal Kombat Gold","priceSold":"57,64","dateSold":" 26 août 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Dreamcast"}
// [Nest] 22647  - 06/11/2023 19:26:54     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61317","asin":"none","upc":"none","productName":"Mortal Kombat Gold","consoleName":"Sega Dreamcast","genre":"Action & Adventure","releaseDate":"1999-11-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:27:17     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Titeuf","priceSold":"19,95","dateSold":" 23 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"GameBoy Color"}
// [Nest] 22647  - 06/11/2023 19:27:17     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"704641","asin":null,"upc":null,"productName":"Titeuf","consoleName":"GameBoy Color","genre":"Party","releaseDate":"2001-06-07","loosePrice":null,"cibPrice":24,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 22 août 2023"}
// [Nest] 22647  - 06/11/2023 19:27:17     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Titeuf","priceSold":"24,99","dateSold":" 22 août 2023","condition":"Très Bon État","completeness":"Complet","zone":"Pal","console":"GameBoy Color"}
// [Nest] 22647  - 06/11/2023 19:27:17     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"704641","asin":null,"upc":null,"productName":"Titeuf","consoleName":"GameBoy Color","genre":"Party","releaseDate":"2001-06-07","loosePrice":null,"cibPrice":19,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 23 oct. 2023"}
// [Nest] 22647  - 06/11/2023 19:27:54     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Monster Hunter 3 Ultimate","priceSold":"9,98","dateSold":" 22 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Nintendo 3DS"}
// [Nest] 22647  - 06/11/2023 19:27:54     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"705179","asin":null,"upc":null,"productName":"Monster Hunter 3 Ultimate","consoleName":"Nintendo 3DS","genre":"Action & Adventure","releaseDate":"2011-12-10","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:27:54     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Monster Hunter 3 Ultimate","priceSold":"19,50","dateSold":" 27 août 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Nintendo 3DS"}
// [Nest] 22647  - 06/11/2023 19:27:54     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"705179","asin":null,"upc":null,"productName":"Monster Hunter 3 Ultimate","consoleName":"Nintendo 3DS","genre":"Action & Adventure","releaseDate":"2011-12-10","loosePrice":null,"cibPrice":9,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 22 oct. 2023"}
// [Nest] 22647  - 06/11/2023 19:27:54     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Monster Hunter 3 Ultimate","priceSold":"17,50","dateSold":" 27 août 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Nintendo 3DS"}
// [Nest] 22647  - 06/11/2023 19:27:54     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"705179","asin":null,"upc":null,"productName":"Monster Hunter 3 Ultimate","consoleName":"Nintendo 3DS","genre":"Action & Adventure","releaseDate":"2011-12-10","loosePrice":null,"cibPrice":19,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 27 août 2023"}
// [Nest] 22647  - 06/11/2023 19:28:32     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"The Nomad Soul","priceSold":"39,00","dateSold":" 1 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Dreamcast"}
// [Nest] 22647  - 06/11/2023 19:28:32     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61325","asin":"none","upc":"none","productName":"The Nomad Soul","consoleName":"Sega Dreamcast","genre":"Action & Adventure","releaseDate":"2000-06-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:28:32     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"The Nomad Soul","priceSold":"56,00","dateSold":" 17 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Dreamcast"}
// [Nest] 22647  - 06/11/2023 19:28:32     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61325","asin":"none","upc":"none","productName":"The Nomad Soul","consoleName":"Sega Dreamcast","genre":"Action & Adventure","releaseDate":"2000-06-01","loosePrice":null,"cibPrice":39,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 1 oct. 2023"}
// [Nest] 22647  - 06/11/2023 19:28:43     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Pokemon X","priceSold":"29,99","dateSold":" 23 août 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Nintendo 3DS"}
// [Nest] 22647  - 06/11/2023 19:28:43     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"70588","asin":"B00B7JT5F4","upc":"0045496524210","productName":"Pokemon X","consoleName":"Nintendo 3DS","genre":"RPG","releaseDate":"2013-10-12","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:28:44     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Outtrigger","priceSold":"44,66","dateSold":" 2 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Dreamcast"}
// [Nest] 22647  - 06/11/2023 19:28:44     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61326","asin":"none","upc":"none","productName":"Outtrigger","consoleName":"Sega Dreamcast","genre":"Action & Adventure","releaseDate":"2001-08-03","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:29:04     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Wario Ware Gold","priceSold":"16,50","dateSold":" 22 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Nintendo 3DS"}
// [Nest] 22647  - 06/11/2023 19:29:04     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"66724","asin":"B07BHGPMCW","upc":"045496477783","productName":"Wario Ware Gold","consoleName":"Nintendo 3DS","genre":"Other","releaseDate":"2018-07-27","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:29:39     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Micro Machines","priceSold":"26,50","dateSold":" 22 oct. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Nintendo 64"}
// [Nest] 22647  - 06/11/2023 19:29:39     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"40106","asin":"none","upc":"none","productName":"Micro Machines","consoleName":"Nintendo 64","genre":"Racing","releaseDate":"1997-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:29:39     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Micro Machines","priceSold":"26,81","dateSold":" 1 oct. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Nintendo 64"}
// [Nest] 22647  - 06/11/2023 19:29:39     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"40106","asin":"none","upc":"none","productName":"Micro Machines","consoleName":"Nintendo 64","genre":"Racing","releaseDate":"1997-01-01","loosePrice":null,"cibPrice":26,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 22 oct. 2023"}
// [Nest] 22647  - 06/11/2023 19:29:42     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Halo 3","priceSold":"6,90","dateSold":" 13 août 2023","condition":"Très Bon État","completeness":"Complet","zone":"Pal","console":"Xbox 360"}
// [Nest] 22647  - 06/11/2023 19:29:42     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"60724","asin":"none","upc":"none","productName":"Halo 3","consoleName":"Xbox 360","genre":"FPS","releaseDate":"2007-09-26","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:29:59     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Phantasy Star Online Ver. 2","priceSold":"100,00","dateSold":" 17 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Dreamcast"}
// [Nest] 22647  - 06/11/2023 19:29:59     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61332","asin":"none","upc":"5060004761326","productName":"Phantasy Star Online Ver. 2","consoleName":"Sega Dreamcast","genre":"RPG","releaseDate":"2002-03-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 17 sept. 2023"}
// [Nest] 22647  - 06/11/2023 19:30:11     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Power Stone 2","priceSold":"96,00","dateSold":" 17 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Dreamcast"}
// [Nest] 22647  - 06/11/2023 19:30:11     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61333","asin":"none","upc":"none","productName":"Power Stone 2","consoleName":"Sega Dreamcast","genre":"Fighting","releaseDate":"2000-08-24","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 17 sept. 2023"}
// [Nest] 22647  - 06/11/2023 19:30:15     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Mission Impossible","priceSold":"20,50","dateSold":" 27 août 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Nintendo 64"}
// [Nest] 22647  - 06/11/2023 19:30:15     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"40109","asin":"none","upc":"none","productName":"Mission Impossible","consoleName":"Nintendo 64","genre":"Action & Adventure","releaseDate":"1997-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:30:15     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Mission Impossible","priceSold":"19,99","dateSold":" 9 août 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Nintendo 64"}
// [Nest] 22647  - 06/11/2023 19:30:15     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"40109","asin":"none","upc":"none","productName":"Mission Impossible","consoleName":"Nintendo 64","genre":"Action & Adventure","releaseDate":"1997-01-01","loosePrice":null,"cibPrice":20,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 27 août 2023"}
// [Nest] 22647  - 06/11/2023 19:30:36     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Batman","priceSold":"56,00","dateSold":" 10 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"NES"}
// [Nest] 22647  - 06/11/2023 19:30:36     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"38092","asin":"none","upc":"none","productName":"Batman","consoleName":"NES","genre":"Platformer","releaseDate":"1990-09-14","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:30:37     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Miitopia","priceSold":"5,01","dateSold":" 10 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Nintendo 3DS"}
// [Nest] 22647  - 06/11/2023 19:30:37     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"70599","asin":null,"upc":"0045496475390","productName":"Miitopia","consoleName":"Nintendo 3DS","genre":"Action & Adventure","releaseDate":"2017-07-28","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:31:01     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Ready 2 Rumble Boxing","priceSold":"20,50","dateSold":" 17 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Dreamcast"}
// [Nest] 22647  - 06/11/2023 19:31:01     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61337","asin":"none","upc":"none","productName":"Ready 2 Rumble Boxing","consoleName":"Sega Dreamcast","genre":"Sports","releaseDate":"1999-10-14","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 17 sept. 2023"}
// [Nest] 22647  - 06/11/2023 19:31:36     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Bionic Commando","priceSold":"43,06","dateSold":" 15 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"NES"}
// [Nest] 22647  - 06/11/2023 19:31:36     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"38097","asin":"none","upc":"none","productName":"Bionic Commando","consoleName":"NES","genre":"Action & Adventure","releaseDate":"1990-10-26","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:31:43     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Venetica","priceSold":"14,97","dateSold":" 23 sept. 2023","condition":"Très Bon État","completeness":"Complet","zone":"Pal","console":"Xbox 360"}
// [Nest] 22647  - 06/11/2023 19:31:43     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"60997","asin":"none","upc":"none","productName":"Venetica","consoleName":"Xbox 360","genre":"RPG","releaseDate":"2009-12-18","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:32:05     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Jurassic Park","priceSold":"29,06","dateSold":" 24 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Game Gear"}
// [Nest] 22647  - 06/11/2023 19:32:05     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"2183430","asin":null,"upc":null,"productName":"Jurassic Park","consoleName":"Sega Game Gear","genre":"Action & Adventure","releaseDate":"1993-05-17","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:32:08     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Joe Montana Football","priceSold":"27,15","dateSold":" 3 sept. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Sega Master System"}
// [Nest] 22647  - 06/11/2023 19:32:08     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61000","asin":null,"upc":null,"productName":"Joe Montana Football","consoleName":"Sega Master System","genre":"Sports","releaseDate":"1991-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:32:16     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Transbot","priceSold":"25,01","dateSold":" 1 oct. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Sega Master System"}
// [Nest] 22647  - 06/11/2023 19:32:16     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"70639","asin":null,"upc":null,"productName":"Transbot","consoleName":"Sega Master System","genre":"Action & Adventure","releaseDate":null,"loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:32:16     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Transbot","priceSold":"17,10","dateSold":" 3 sept. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Sega Master System"}
// [Nest] 22647  - 06/11/2023 19:32:16     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"70639","asin":null,"upc":null,"productName":"Transbot","consoleName":"Sega Master System","genre":"Action & Adventure","releaseDate":null,"loosePrice":null,"cibPrice":25,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 1 oct. 2023"}
// [Nest] 22647  - 06/11/2023 19:32:16     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Transbot","priceSold":"20,00","dateSold":" 3 sept. 2023","condition":"Très Bon État","completeness":"Complet","zone":"Pal","console":"Sega Master System"}
// [Nest] 22647  - 06/11/2023 19:32:16     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"70639","asin":null,"upc":null,"productName":"Transbot","consoleName":"Sega Master System","genre":"Action & Adventure","releaseDate":null,"loosePrice":null,"cibPrice":17,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 3 sept. 2023"}
// [Nest] 22647  - 06/11/2023 19:32:17     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Joe Montana Football","priceSold":"27,15","dateSold":" 3 sept. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Sega Game Gear"}
// [Nest] 22647  - 06/11/2023 19:32:17     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"2183431","asin":null,"upc":"4974365624033","productName":"Joe Montana Football","consoleName":"Sega Game Gear","genre":"Sports","releaseDate":"1992-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:32:25     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Boulder Dash","priceSold":"40,33","dateSold":" 25 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"NES"}
// [Nest] 22647  - 06/11/2023 19:32:25     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"38101","asin":"none","upc":"none","productName":"Boulder Dash","consoleName":"NES","genre":"Action & Adventure","releaseDate":"1990-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:32:29     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Krusty's Fun House","priceSold":"56,00","dateSold":" 3 sept. 2023","condition":"Très Bon État","completeness":"Complet","zone":"Pal","console":"Sega Game Gear"}
// [Nest] 22647  - 06/11/2023 19:32:29     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"2183432","asin":null,"upc":"5023483012730","productName":"Krusty's Fun House","consoleName":"Sega Game Gear","genre":"Puzzle","releaseDate":"1993-01-01","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:32:44     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Alien Trilogy","priceSold":"31,50","dateSold":" 15 oct. 2023","condition":"Bon État","completeness":"Complet","zone":"Pal","console":"Sega Saturn"}
// [Nest] 22647  - 06/11/2023 19:32:44     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61006","asin":"none","upc":"none","productName":"Alien Trilogy","consoleName":"Sega Saturn","genre":"Action & Adventure","releaseDate":"1996-09-04","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:32:44     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Alien Trilogy","priceSold":"35,63","dateSold":" 30 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Saturn"}
// [Nest] 22647  - 06/11/2023 19:32:44     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61006","asin":"none","upc":"none","productName":"Alien Trilogy","consoleName":"Sega Saturn","genre":"Action & Adventure","releaseDate":"1996-09-04","loosePrice":null,"cibPrice":31,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":" 15 oct. 2023"}
// [Nest] 22647  - 06/11/2023 19:32:58     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Andretti Racing","priceSold":"14,50","dateSold":" 3 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Saturn"}
// [Nest] 22647  - 06/11/2023 19:32:58     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61007","asin":"none","upc":"none","productName":"Andretti Racing","consoleName":"Sega Saturn","genre":"Racing","releaseDate":"1997-02-07","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:33:49     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Minecraft","priceSold":"10,00","dateSold":" 15 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Xbox 360"}
// [Nest] 22647  - 06/11/2023 19:33:49     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"60777","asin":"none","upc":"0885370611670","productName":"Minecraft","consoleName":"Xbox 360","genre":"Other","releaseDate":"2012-05-09","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:34:00     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Castlevania","priceSold":"116,00","dateSold":" 10 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"NES"}
// [Nest] 22647  - 06/11/2023 19:34:00     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"38108","asin":"none","upc":"none","productName":"Castlevania","consoleName":"NES","genre":"Action & Adventure","releaseDate":"1988-12-19","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:34:14     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Battle Arena Toshinden Remix","priceSold":"18,50","dateSold":" 22 oct. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Sega Saturn"}
// [Nest] 22647  - 06/11/2023 19:34:14     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"61013","asin":"none","upc":"none","productName":"Battle Arena Toshinden Remix","consoleName":"Sega Saturn","genre":"Fighting","releaseDate":"1996-03-29","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// [Nest] 22647  - 06/11/2023 19:34:33     LOG [ScrappingService] [Scrapping Service] Item:  {"title":"Hey! Pikmin","priceSold":"11,20","dateSold":" 17 sept. 2023","condition":"Cib","completeness":"Complet","zone":"Pal","console":"Nintendo 3DS"}
// [Nest] 22647  - 06/11/2023 19:34:33     LOG [ScrappingService] [Scrapping Service] GameToUpdate:  {"id":"70924","asin":null,"upc":null,"productName":"Hey! Pikmin","consoleName":"Nintendo 3DS","genre":"Action & Adventure","releaseDate":"2017-07-28","loosePrice":null,"cibPrice":null,"newPrice":null,"boxOnlyPrice":null,"manualOnlyPrice":null,"gradedPrice":null,"zone":"PAL","ebayDate":null}
// (node:22647) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 exit listeners added to [process]. Use emitter.setMaxListeners() to increase limit
// (Use `node --trace-warnings ...` to show where the warning was created)
// (node:22647) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGINT listeners added to [process]. Use emitter.setMaxListeners() to increase limit
// (node:22647) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGTERM listeners added to [process]. Use emitter.setMaxListeners() to increase limit
// (node:22647) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGHUP listeners added to [process]. Use emitter.setMaxListeners() to increase limit
// (node:22647) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 exit listeners added to [process]. Use emitter.setMaxListeners() to increase limit
// (node:22647) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGINT listeners added to [process]. Use emitter.setMaxListeners() to increase limit
// (node:22647) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGTERM listeners added to [process]. Use emitter.setMaxListeners() to increase limit
// (node:22647) MaxListenersExceededWarning: Possible EventEmitter memory leak detected. 11 SIGHUP listeners added to [process]. Use emitter.setMaxListeners() to increase limit