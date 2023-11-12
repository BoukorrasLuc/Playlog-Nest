const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { logger } = require("../seed/utils/logger");
const fs = require("fs");
const path = require("path");

const priceChartingPath = path.join(__dirname, "./DataClusterSeed/");

/**
 * Seed data to the database
 * @returns {Promise<void>}
 */

async function seedData() {
  try {
    const priceChartingFiles = fs.readdirSync(priceChartingPath);

    for (const file of priceChartingFiles) {
      const filePath = path.join(priceChartingPath, file);
      const data = require(filePath);
      await processFileData(prisma, data);
    }

    logger.info("[seedData] Successfully seeded database.");
  } catch (error) {
    logger.error(`[seedData] Error seeding data: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

// All Price is null 

async function processFileData(prisma, data) {
  for (const item of data) {
    let {
      id,
      upc,
      productName,
      consoleName,
      genre,
      releaseDate,
      // loosePrice,
      // cibPrice,
      // newPrice,
      // boxOnlyPrice,
      // manualOnlyPrice,
      // gradedPrice,
      asin,
    } = item;

    let zone = null;
    if (consoleName.includes("JP") || consoleName.includes("PAL")) {
      zone = consoleName.includes("JP") ? "JAP" : "PAL";
      consoleName = consoleName.replace(zone, "").trim();
    }

    const itemData = {
      id,
      upc,
      productName,
      consoleName,
      genre,
      releaseDate,
      // loosePrice,
      // cibPrice,
      // newPrice,
      // boxOnlyPrice,
      // manualOnlyPrice,
      // gradedPrice,
      asin,
      zone,
    };

    if (itemData.zone === "JP") {
      itemData.zone = "JAP";
    }

    if (itemData.consoleName.includes("JP")) {
      itemData.consoleName = itemData.consoleName.replace("JP", "").trim();
    }
    /////////////////////////////// Systems ///////////////////////////////////

    if (itemData.genre === "Systems") {
      if (itemData.zone === "JP") {
        itemData.zone = "JAP";
      }
      const existingItem = await prisma.system.findUnique({
        where: { id },
      });

      if (existingItem) {
        logger.info(
          `[seedData][Systems] Item with ID ${id} already exists, skipping.`
        );
        continue;
      }

      const upsertedItem = await prisma.system.upsert({
        where: { id },
        update: itemData,
        create: itemData,
      });

      console.info(
        `[seedData][Systems] Upserted item with ID ${upsertedItem.id}.`
      );
    }

    /////////////////////////////// Accessorys ///////////////////////////////////

    if (
      itemData.genre === "Accessories" ||
      itemData.genre === "Controllers" ||
      itemData.consoleName === "Strategy Guide" ||
      itemData.consoleName === "Amiibo" ||
      itemData.consoleName === "Amiibo Cards"
    ) {
      const existingItem = await prisma.accessory.findUnique({
        where: { id },
      });

      if (existingItem) {
        logger.info(
          `[seedData][Accessories] Item with ID ${id} already exists, skipping.`
        );
        continue;
      }

      const upsertedItem = await prisma.accessory.upsert({
        where: { id },
        update: itemData,
        create: itemData,
      });

      logger.info(
        `[seedData][Accessories] Upserted item with ID ${upsertedItem.id}.`
      );
    }

    //////////////////////////////////// Game ///////////////////////////////////

    const excludedGenres = [
      "Accessories",
      "Systems",
      "Pokemon Card",
      "Garbage Pail Kid Cards",
      "Garbage Pail Kid Card",
      "Garbage Pail Card",
      "Board & Card",
      "YuGiOh Card",
      "Magic Card",
      "Magic Cards",
      "Magazine",
      "Comic Book",
      "Controllers",
      "Soccer Card",
      "",
    ];

    const excludedConsoleName = ["Wholesale", "Amiibo Cards", "Amiibo"];
      
      // Todo : Improvement Genre === null. it's upload in bdd.
    
      if (
        !excludedGenres.includes(itemData.genre) &&
        !excludedConsoleName.includes(itemData.consoleName)
      ) {
        if (itemData.zone === "JP") {
          itemData.zone = "JAP";
        }
        const existingItem = await prisma.game.findUnique({
          where: { id },
        });

        if (existingItem) {
          logger.info(
            `[seedData][Game] Item with ID ${id} already exists, skipping.`
          );
          continue;
        }

        const upsertedItem = await prisma.game.upsert({
          where: { id },
          update: itemData,
          create: itemData,
        });

        logger.info(
          `[seedData][Game] Upserted item with ID ${upsertedItem.id}.`
        );
      }
    
  }
}

seedData();
