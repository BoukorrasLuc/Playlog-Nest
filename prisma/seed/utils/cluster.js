const fs = require("fs");
const { logger } = require("./logger");

const DataJsAll = require("/seed/Data/priceChartingAllData.js").filter(obj => obj["genre"] === "Systems");

////////////////////////////////////////////

/// Only Game !

// const excludedGenres = [
//   "Accessories",
//   "Systems",
//   "Pokemon Card",
//   "Garbage Pail Kid Cards",
//   "Board & Card",
//   "YuGiOh Card",
//   "Magic Card",
//   "Magazine",
//   "Comic Book",
// ];

// const DataJsAll = require("./priceChartingAllData.js").filter(
//   (obj) => !excludedGenres.includes(obj["genre"])
// );


////////////////////////////////////////////

DataJsAll.forEach((obj) => logger.info(JSON.stringify(obj)));

fs.writeFile(
  "./prisma/priceCharting/DataCluster/clusterDataSystems.js",
  "module.exports = " + JSON.stringify(DataJsAll, null, 2),
  (err) => {
    if (err) {
      logger.error("Error writing file: " + err.message);
    } else {
      logger.info("Cluster file created successfully.");
    }
  }
);
