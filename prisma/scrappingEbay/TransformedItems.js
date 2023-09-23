/* eslint-disable max-len */
const fs = require('fs');
const path = require('path');
const uuid = require('uuid');
const { logger } = require('../../src/utils/logger');

/**

@module scrapeData
@description This module transforms data scrapped with Puppeteer and writes it to a file.
*/

/**

The path where the output file will be saved.
@constant {string}
*/

const outputFilePath = path.join(__dirname, './DataScrapped-V2.js');

/**

Returns a new object with only relevant data from a scrapped object.
@function
@param {object} item - A scrapped object containing various properties.
@returns {object} - A new object with selected data.
*/

const transformItem = (item) => {
  const regexZone = /(pal|ntsc-j|jap|japan)/i;
  const matchTitleZone = item.name.match(regexZone);

  const regexCompleteness = /(complet|loose|hs)/i;
  const matchTitleCompleteness = item.name.match(regexCompleteness);

  const regexCondition = /(très bon état|tres bon etat|tbe|be|mint|cib)/i;
  const matchCondition = item.name.match(regexCondition);

  const regexDeleteElementOfTitle =
    /nintendo|complete|complet|-|jeux|jeu|pal|nus|ntsc-j|japan|fah|fra|boîte|notice|n64|64|ovp|fr|32x|cib|32 x|(\(|\))|,|retrogaming|32 x|tbe|be|euro|eur|version|neu|japon|jap|limited edition|collector|deluxe|en boite|boite|\b(19[89]\d|2000)\b|\//gi;
  const newTitle = item.name.replace(regexDeleteElementOfTitle, '').trim();

  const regexConsoleOfTitle = /\bNintendo\s*64\b/i;
  const matchConsoleOfTitle = item.name.match(regexConsoleOfTitle);

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

  // Todo Improvement Console !!
  return {
    id: uuid.v4(),
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
    console: matchConsoleOfTitle
      ? capitalizeFirstLetterOfEachWord('Nintendo 64')
      : null,
  };
};

const transformItems = (items) =>
  items.filter((item) => item.country !== 'de États-Unis').map(transformItem);

const writeToFile = (filePath, data) => {
  fs.writeFile(filePath, data, (err) => {
    if (err) {
      logger.error(`An error occurred while writing the file: ${err}`);
    } else {
      logger.info(`the file ${filePath} has been successfully created.`);
    }
  });
};

const items = require('../scrappingEbay/DataScrapped-V1');

const transformedItems = transformItems(items.items);

// const filteredItems = transformedItems
//   .reduce((acc, item) => {
//     const existingItem = acc.find((i) => i.zone === item.zone);
//     if (!existingItem) {
//       acc.push(item);
//     }
//     return acc;
//   }, [])
//   .slice(0, 10);

const outputData = `module.exports = ${JSON.stringify(
  transformedItems,
  null,
  2,
)};`;

writeToFile(outputFilePath, outputData);
