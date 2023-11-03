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
             console.log("🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item:", item)
             const gameToUpdate = await this.gameService.getById(game.id);
              console.log("🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate:", gameToUpdate)
              if (gameToUpdate) {
                await this.gameService.updateById(gameToUpdate.id, {
                  cibPrice: parseFloat(item.priceSold.replace(',', '.')),
                  ebayDate: item.dateSold,
                });
              }
            }
          }
      }

      // const loggerData = {
      //   GameInDataBase: game,
      //   Scrappe: data,
      //   item: item,
      //   gameToUpdate: gameToUpdate,
      //   Updated: transformedData,
      // };
      // this.logger.log("🚀 ~ file: scrapping.service.ts:171 ~ ScrappingService ~ scrapeEbay ~ loggerData:", JSON.stringify(loggerData, null, 2))


      // fs.writeFile("logger.json", JSON.stringify(loggerData, null, 2), function(err) {
      //   if (err) {
      //     Logger.log(err);
      //   }
      // });

      await browser.close();
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
}



// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Ratchet & Clank Nexus Ps3',
//   priceSold: '26,00',
//   dateSold: ' 3 nov. 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Playstation 4'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '36526',
//   asin: 'B00Z9LUDX4',
//   upc: '711719501220',
//   productName: 'Ratchet & Clank',
//   consoleName: 'Playstation 4',
//   genre: 'Action & Adventure',
//   releaseDate: '2016-04-12',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Snes Super',
//   priceSold: '116,94',
//   dateSold: ' 29 oct. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Super Nintendo'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '6922',
//   asin: 'B00002SW2L',
//   upc: '026483340389',
//   productName: 'Fatal Fury',
//   consoleName: 'Super Nintendo',
//   genre: 'Fighting',
//   releaseDate: '1991-11-25',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Dark Souls Iii 3',
//   priceSold: '15,95',
//   dateSold: ' 3 nov. 2023',
//   condition: 'Très Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Xbox One'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '36527',
//   asin: 'B00Z9LUCEY',
//   upc: '722674220095',
//   productName: 'Dark Souls III',
//   consoleName: 'Xbox One',
//   genre: 'RPG',
//   releaseDate: '2016-04-12',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Dark Souls Iii 3',
//   priceSold: '15,95',
//   dateSold: ' 3 nov. 2023',
//   condition: 'Très Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Playstation 4'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '36528',
//   asin: 'B00Z9LUFHS',
//   upc: '722674120838',
//   productName: 'Dark Souls III',
//   consoleName: 'Playstation 4',
//   genre: 'RPG',
//   releaseDate: '2016-04-12',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Canis Canem Edit',
//   priceSold: '34,99',
//   dateSold: ' 30 août 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Playstation 2'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '40767',
//   asin: 'B0009RWHZU',
//   upc: '5026555304801',
//   productName: 'Canis Canem Edit',
//   consoleName: 'Playstation 2',
//   genre: 'Action & Adventure',
//   releaseDate: '2006-10-25',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: 'PAL',
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Inazuma Eleven Strikers',
//   priceSold: '24,99',
//   dateSold: ' 10 août 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Wii'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '55240',
//   asin: 'none',
//   upc: 'none',
//   productName: 'Inazuma Eleven Strikers',
//   consoleName: 'Wii',
//   genre: 'Action & Adventure',
//   releaseDate: '2012-09-28',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: 'PAL',
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Wwe Day Of Reckoning 2 Gamecu',
//   priceSold: '22,87',
//   dateSold: ' 16 oct. 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Gamecube'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3654',
//   asin: 'B0002I0UIC',
//   upc: '785138380315',
//   productName: 'WWE Day of Reckoning',
//   consoleName: 'Gamecube',
//   genre: 'Wrestling',
//   releaseDate: '2004-08-30',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Alan Wake Remastered Ps5 Sony',
//   priceSold: '29,90',
//   dateSold: ' 4 oct. 2023',
//   condition: 'Très Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Playstation 5'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3654425',
//   asin: null,
//   upc: null,
//   productName: 'Alan Wake Remastered',
//   consoleName: 'Playstation 5',
//   genre: 'Action & Adventure',
//   releaseDate: '2021-10-05',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: 'PAL',
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Doom Eternal',
//   priceSold: '9,50',
//   dateSold: ' 15 oct. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Xbox One'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '69280',
//   asin: 'B07DJX3VZS',
//   upc: '093155174146',
//   productName: 'Doom Eternal',
//   consoleName: 'Xbox One',
//   genre: 'FPS',
//   releaseDate: '2020-03-20',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Just Dance Kids',
//   priceSold: '11,90',
//   dateSold: ' 7 oct. 2023',
//   condition: 'Très Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Wii'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '55260',
//   asin: 'none',
//   upc: 'none',
//   productName: 'Just Dance Kids',
//   consoleName: 'Wii',
//   genre: 'Action & Adventure',
//   releaseDate: '2011-11-04',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: 'PAL',
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Wwe Day Of Reckoning 2 Gamecu',
//   priceSold: '22,87',
//   dateSold: ' 16 oct. 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Gamecube'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3655',
//   asin: 'B000A3ON64',
//   upc: '785138380452',
//   productName: 'WWE Day of Reckoning 2',
//   consoleName: 'Gamecube',
//   genre: 'Wrestling',
//   releaseDate: '2005-08-29',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Tekken 5 Platinum',
//   priceSold: '6,99',
//   dateSold: ' 24 août 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Playstation 2'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '69293',
//   asin: null,
//   upc: null,
//   productName: 'Tekken 5',
//   consoleName: 'Playstation 2',
//   genre: 'Fighting',
//   releaseDate: '2005-03-31',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: 'JP',
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Mario Kart Ds',
//   priceSold: '13,00',
//   dateSold: ' 19 oct. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Nintendo DS'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '4080',
//   asin: 'B000A2R54M',
//   upc: '045496735906',
//   productName: 'Mario Kart DS',
//   consoleName: 'Nintendo DS',
//   genre: 'Racing',
//   releaseDate: '2005-11-14',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Naruto Ultimate Ninja 2',
//   priceSold: '7,90',
//   dateSold: ' 20 sept. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Playstation 2'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '5527',
//   asin: 'B000OKL8R0',
//   upc: '722674100656',
//   productName: 'Naruto Ultimate Ninja 2',
//   consoleName: 'Playstation 2',
//   genre: 'Fighting',
//   releaseDate: '2007-06-12',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Xiii Le',
//   priceSold: '14,00',
//   dateSold: ' 15 oct. 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Gamecube'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3659',
//   asin: 'B000093NQI',
//   upc: '008888150114',
//   productName: 'XIII',
//   consoleName: 'Gamecube',
//   genre: 'FPS',
//   releaseDate: '2003-11-24',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Xiii Le',
//   priceSold: '12,50',
//   dateSold: ' 8 oct. 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Gamecube'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3659',
//   asin: 'B000093NQI',
//   upc: '008888150114',
//   productName: 'XIII',
//   consoleName: 'Gamecube',
//   genre: 'FPS',
//   releaseDate: '2003-11-24',
//   loosePrice: null,
//   cibPrice: 14,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: ' 15 oct. 2023'
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Xiii Le',
//   priceSold: '15,50',
//   dateSold: ' 1 oct. 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Gamecube'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3659',
//   asin: 'B000093NQI',
//   upc: '008888150114',
//   productName: 'XIII',
//   consoleName: 'Gamecube',
//   genre: 'FPS',
//   releaseDate: '2003-11-24',
//   loosePrice: null,
//   cibPrice: 12,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: ' 8 oct. 2023'
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Xiii Gamecu',
//   priceSold: '15,12',
//   dateSold: ' 11 mai 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Gamecube'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3659',
//   asin: 'B000093NQI',
//   upc: '008888150114',
//   productName: 'XIII',
//   consoleName: 'Gamecube',
//   genre: 'FPS',
//   releaseDate: '2003-11-24',
//   loosePrice: null,
//   cibPrice: 15,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: ' 1 oct. 2023'
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Xiii Thirteen Gamecu Game',
//   priceSold: '28,99',
//   dateSold: ' 27 août 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Gamecube'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3659',
//   asin: 'B000093NQI',
//   upc: '008888150114',
//   productName: 'XIII',
//   consoleName: 'Gamecube',
//   genre: 'FPS',
//   releaseDate: '2003-11-24',
//   loosePrice: null,
//   cibPrice: 15,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: ' 11 mai 2023'
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Immortals Fenyx Rising Édition Gold',
//   priceSold: '12,50',
//   dateSold: ' 15 oct. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Nintendo Switch'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '1242489',
//   asin: 'B07SZW4L3M',
//   upc: '3307216144229',
//   productName: 'Immortals Fenyx Rising',
//   consoleName: 'Nintendo Switch',
//   genre: 'Action & Adventure',
//   releaseDate: '2020-12-03',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: 'PAL',
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Doom',
//   priceSold: '8,39',
//   dateSold: ' 10 août 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Playstation 4'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '36608',
//   asin: 'B00M3D8IYM',
//   upc: '093155170223',
//   productName: 'Doom',
//   consoleName: 'Playstation 4',
//   genre: 'FPS',
//   releaseDate: '2016-05-13',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Final Doom',
//   priceSold: '27,90',
//   dateSold: ' 7 sept. 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Playstation 4'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '36608',
//   asin: 'B00M3D8IYM',
//   upc: '093155170223',
//   productName: 'Doom',
//   consoleName: 'Playstation 4',
//   genre: 'FPS',
//   releaseDate: '2016-05-13',
//   loosePrice: null,
//   cibPrice: 8,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: ' 10 août 2023'
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Another World',
//   priceSold: '45,50',
//   dateSold: ' 22 oct. 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Amiga'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '4080680',
//   asin: null,
//   upc: null,
//   productName: 'Another World',
//   consoleName: 'Amiga',
//   genre: 'Action & Adventure',
//   releaseDate: null,
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: "Kirby's Epic Yarn",
//   priceSold: '43,53',
//   dateSold: ' 2 nov. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Wii'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '55286',
//   asin: 'none',
//   upc: '045496369606',
//   productName: "Kirby's Epic Yarn",
//   consoleName: 'Wii',
//   genre: 'Platformer',
//   releaseDate: '2011-02-25',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: 'PAL',
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Xmen Legends Rise Of Apocalypse 2',
//   priceSold: '57,00',
//   dateSold: ' 8 oct. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Gamecube'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3661',
//   asin: 'B0001I9YIK',
//   upc: '047875805774',
//   productName: 'X-men Legends',
//   consoleName: 'Gamecube',
//   genre: 'RPG',
//   releaseDate: '2004-09-21',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Gamecu',
//   priceSold: '37,78',
//   dateSold: ' 30 oct. 2023',
//   condition: 'Bon État',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Gamecube'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '3661',
//   asin: 'B0001I9YIK',
//   upc: '047875805774',
//   productName: 'X-men Legends',
//   consoleName: 'Gamecube',
//   genre: 'RPG',
//   releaseDate: '2004-09-21',
//   loosePrice: null,
//   cibPrice: 57,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: ' 8 oct. 2023'
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Doom Slayers Collection',
//   priceSold: '10,50',
//   dateSold: ' 15 oct. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Xbox One'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '36610',
//   asin: 'B00M3D8IPQ',
//   upc: '093155170216',
//   productName: 'Doom',
//   consoleName: 'Xbox One',
//   genre: 'FPS',
//   releaseDate: '2016-05-13',
//   loosePrice: null,
//   cibPrice: null,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: null
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Doom Eternal',
//   priceSold: '9,50',
//   dateSold: ' 15 oct. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Xbox One'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '36610',
//   asin: 'B00M3D8IPQ',
//   upc: '093155170216',
//   productName: 'Doom',
//   consoleName: 'Xbox One',
//   genre: 'FPS',
//   releaseDate: '2016-05-13',
//   loosePrice: null,
//   cibPrice: 10,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: ' 15 oct. 2023'
// }
// 🚀 ~ file: scrapping.service.ts:155 ~ ScrappingService ~ scrapeEbay ~ item: {
//   title: 'Doom 3',
//   priceSold: '7,00',
//   dateSold: ' 22 oct. 2023',
//   condition: 'Cib',
//   completeness: 'Complet',
//   zone: 'Pal',
//   console: 'Xbox One'
// }
// 🚀 ~ file: scrapping.service.ts:156 ~ ScrappingService ~ scrapeEbay ~ gameToUpdate: {
//   id: '36610',
//   asin: 'B00M3D8IPQ',
//   upc: '093155170216',
//   productName: 'Doom',
//   consoleName: 'Xbox One',
//   genre: 'FPS',
//   releaseDate: '2016-05-13',
//   loosePrice: null,
//   cibPrice: 9,
//   newPrice: null,
//   boxOnlyPrice: null,
//   manualOnlyPrice: null,
//   gradedPrice: null,
//   zone: null,
//   ebayDate: ' 15 oct. 2023'
// }