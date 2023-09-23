/* eslint-disable max-len */
const puppeteer = require('puppeteer');
const fs = require('fs');
const { logger } = require('../../src/utils/logger');

/**

This script scrapes eBay to retrieve sold items matching certain search criteria and saves them to a file
@module scrapeSoldItems
*/

const SEARCH_CONFIG = {
  title: 'zelda ocarina',
  console: 'n64',
  searchTerm: 'complet',
  location: '1',
};

/**

Search criteria configuration object
@typedef {Object} SearchConfig
@property {string} title - the title of the item to search for
@property {string} console - the console the item belongs to
@property {string} searchTerm - the eBay search term to use
@property {string} location - the eBay location ID to use
*/
/**

Creates the eBay URL to search for sold items based on the given configuration object
@param {SearchConfig} config - the search criteria configuration object
@returns {string} the eBay URL to search for sold items
*/

const createUrl = (config) => {
  const {
    title, console, searchTerm, location,
  } = config;
  return `https://www.ebay.fr/sch/i.html?_from=R40&_nkw=${title}+${console}&_sacat=0&LH_Sold=1&LH_${searchTerm}=1&rt=nc&LH_PrefLoc=${location}`;
};

async function scrape(url, searchConfig) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto(url);

  const data = {};

  try {
    data.items = await page.evaluate(
      (searchTerm, title) => {
        const tds = Array.from(
          document.querySelectorAll('.s-item'),
        );

        return tds.map((td) => {
          try {
            const price = td.querySelector('span.s-item__price')?.innerText || null;
            const name = td.querySelector('div.s-item__title')?.innerText.toLowerCase() || null;
            const date = td.querySelector('div.s-item__title--tagblock')?.innerText.replace('\nObjet vendu', '') || null;
            const typeSold = td.querySelector('span.s-item__purchaseOptionsWithIcon')?.innerText || null;
            const country = td.querySelector('span.s-item__location.s-item__itemLocation')?.innerText || null;

            return {
              price,
              name,
              date,
              typeSold,
              country,
            };
          } catch (error) {
            logger.error(`[Scrape : items] Error found in map: ${error}`);
            return null;
          }
        }).filter(
          (item) => item != null
            && item.name.includes(searchTerm)
            && item.name.includes(title.toLowerCase()),
        );
      },
      searchConfig.searchTerm,
      searchConfig.title,
    );
  } catch (error) {
    logger.error(`[Scrape : items] Error found in page evaluate: ${error}`);
  }

  const content = `const items = ${JSON.stringify(
    data,
    null,
    2,
  )};\n\nmodule.exports = items;\n`;
  fs.writeFile('./prisma/scrappingEbay/DataScrapped-V1.js', content, (err) => {
    if (err) {
      logger.error(`[Scrape : items] Error found: ${err}`);
    } else {
      logger.info('[Scrape : items] The file has been saved!');
    }
  });



  await browser.close();
}

(async () => {
  try {
    const url = createUrl(SEARCH_CONFIG);
    await scrape(url, SEARCH_CONFIG);
  } catch (error) {
    logger.error(`[Scrape : items] Error found: ${error}`);
  }
})();

// Test url : https://www.ebay.fr/sch/i.html?_from=R40&_nkw=zelda+n64&_sacat=0&LH_Sold=1&LH_complet=1&rt=nc&LH_PrefLoc=1