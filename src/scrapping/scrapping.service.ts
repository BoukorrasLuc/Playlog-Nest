import { Injectable,Logger } from '@nestjs/common';
import puppeteer from 'puppeteer';
import * as fs from 'fs';
import { Cron, Timeout } from '@nestjs/schedule';
import { GameService } from '../game/game.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class ScrappingService {
  private readonly logger = new Logger(ScrappingService.name);
  constructor(private gameService: GameService) {}
  // @Cron('0 0 * * *') // Cette tâche s'exécute tous les jours à minuit
  @Cron('*/1 * * * *') // Cette tâche s'exécute tous les minutes
  async scrapeEbay() {

    const games = await this.gameService.getAll();

    for (const game of games) {
      const SEARCH_CONFIG = {
        title: game.productName,
        console: game.consoleName,
        searchTerm: 'complet',
        location: '1',
      };

      const createUrl = (config) => {
        const {
          title, console, searchTerm, location,
        } = config;
        return `https://www.ebay.fr/sch/i.html?_from=R40&_nkw=${title}+${console}&_sacat=0&LH_Sold=1&LH_${searchTerm}=1&rt=nc&LH_PrefLoc=${location}`;
      };

      const url = createUrl(SEARCH_CONFIG);
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      await page.goto(url);

      const data = await page.evaluate(
        (searchTerm, title) => {
          const tds = Array.from(
            document.querySelectorAll('.s-item'),
          );

          return tds.map((td) => {
            try {
              const price = (td.querySelector('span.s-item__price') as HTMLElement)?.innerText || null;
              const name = (td.querySelector('div.s-item__title') as HTMLElement)?.innerText.toLowerCase() || null;
              const date = (td.querySelector('div.s-item__title--tag span.POSITIVE') as HTMLElement)?.innerText.replace('Vendu le', '') || null;
              const typeSold = (td.querySelector('span.s-item__purchaseOptionsWithIcon') as HTMLElement)?.innerText || null;
              const country = (td.querySelector('span.s-item__location.s-item__itemLocation') as HTMLElement)?.innerText || null;

              return {
                price,
                name,
                date,
                typeSold,
                country,
              };
            } catch (error) {
              this.logger.error(`[Scrape : items] Error found in map: ${error}`);
              return null;
            }
          }).filter(
            (item) => item != null
              && item.name.includes(searchTerm)
              && item.name.includes(title.toLowerCase()),
          );
        },
        SEARCH_CONFIG.searchTerm,
        SEARCH_CONFIG.title,
      );

      console.log("🚀 ~ file: scrapping.service.ts:77 ~ ScrappingService ~ scrapeEbay ~ data:", data)
      if (data.length > 0) {

        const transformedData = data.map(item => {
          const regexZone = /(pal|ntsc-j|jap|japan)/i;
          const matchTitleZone = item.name.match(regexZone);
      
          const regexCompleteness = /(complet|loose|hs)/i;
          const matchTitleCompleteness = item.name.match(regexCompleteness);
      
          const regexCondition = /(très bon état|tres bon etat|tbe|be|mint|cib)/i;
          const matchCondition = item.name.match(regexCondition);
      
          const regexDeleteElementOfTitle =
            /nintendo|complete|complet|-|jeux|jeu|pal|nus|ntsc-j|japan|fah|fra|boîte|notice|n64|64|ovp|fr|32x|cib|32 x|(\(|\))|,|retrogaming|32 x|tbe|be|euro|eur|version|neu|japon|jap|limited edition|collector|deluxe|en boite|boite|\b(19[89]\d|2000)\b|\//gi;
          const newTitle = item.name.replace(regexDeleteElementOfTitle, '').trim();
      
          // const regexConsoleOfTitle = /\bNintendo\s*64\b/i;
          // const matchConsoleOfTitle = item.name.match(regexConsoleOfTitle);
      
          function getSpecificText(text) {
            const words = text.split(' ');
      
            let result = '';
      
            let lastWordHasMoreThanTwoSpaces = false;
            for (let i = 0; i < words.length; i++) {
              const currentWord = words[i];
      
              if (currentWord.trim().length > 0) {
                if (lastWordHasMoreThanTwoSpaces) {
                  break;
                } else {
                  result += `${currentWord} `;
                }
              } else if (
                currentWord.trim().length === 0 &&
                !lastWordHasMoreThanTwoSpaces
              ) {
                lastWordHasMoreThanTwoSpaces = true;
              }
            }
      
            return result.trim();
          }
      
          function capitalizeFirstLetterOfEachWord(text) {
            const words = text.split(' ');
      
            const capitalizedWords = words.map(
              (word) => word.charAt(0).toUpperCase() + word.slice(1),
            );
      
            const result = capitalizedWords.join(' ');
      
            return result;
          }
      
          function replaceEtat(str) {
            str = str.replace(/\b(be)\b/g, 'bon état');
            str = str.replace(/\b(tbe)\b/g, 'très bon état');
            return str;
          }

          return {
            title: capitalizeFirstLetterOfEachWord(getSpecificText(newTitle)),
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
            ean: null,
            console: game.consoleName
          };
        });
        const content = `const items = ${JSON.stringify(
          transformedData,
          null,
          2,
        )};\n\nmodule.exports = items;\n`;
        fs.writeFile(`./prisma/scrappingEbay/DataScrapped-${game.productName}-${game.consoleName}.js`, content, (err) => {
          if (err) {
            this.logger.error(`[Scrape : items] Error found: ${err}`);
          } else {
            this.logger.log(`[Scrape : items] The file has been saved : ${game.productName} - ${game.consoleName}`);
          }
        });
      }

      await browser.close();
      await new Promise(resolve => setTimeout(resolve, 30000)); // Wait for 1 minute before next iteration
    }
  }
}
