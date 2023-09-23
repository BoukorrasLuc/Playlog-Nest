const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
// const { console } = require("../../utils/console");
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

    console.info("[seedData] Successfully seeded database.");
  } catch (error) {
    console.error(`[seedData] Error seeding data: ${error.message}`);
  } finally {
    await prisma.$disconnect();
  }
}

async function processFileData(prisma, data) {
  for (const item of data) {
    const {
      id,
      upc,
      productName,
      consoleName,
      genre,
      releaseDate,
      loosePrice,
      cibPrice,
      newPrice,
      boxOnlyPrice,
      manualOnlyPrice,
      gradedPrice,
      asin,
    } = item;

    const itemData = {
      id,
      upc,
      productName,
      consoleName,
      genre,
      releaseDate,
      loosePrice,
      cibPrice,
      newPrice,
      boxOnlyPrice,
      manualOnlyPrice,
      gradedPrice,
      asin,
    };

    /////////////////////////////// Systems ///////////////////////////////////

    if (itemData.genre === "Systems") {
      const existingItem = await prisma.system.findUnique({
        where: { id },
      });

      if (existingItem) {
        console.info(
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
        console.info(
          `[seedData][Accessories] Item with ID ${id} already exists, skipping.`
        );
        continue;
      }

      const upsertedItem = await prisma.accessory.upsert({
        where: { id },
        update: itemData,
        create: itemData,
      });

      console.info(
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
        const existingItem = await prisma.game.findUnique({
          where: { id },
        });

        if (existingItem) {
          console.info(
            `[seedData][Game] Item with ID ${id} already exists, skipping.`
          );
          continue;
        }

        const upsertedItem = await prisma.game.upsert({
          where: { id },
          update: itemData,
          create: itemData,
        });

        console.info(
          `[seedData][Game] Upserted item with ID ${upsertedItem.id}.`
        );
      }
    
  }
}

seedData();
