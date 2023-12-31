# Playlog Project

The primary purpose of this project is to determine the value of your geek collection, mainly focusing on the video game universe. It includes over 30,000 items related to the video game world, including consoles, accessories, and video games. In the future, we plan to expand into the realm of collectible cards, such as Pokemon, Magic, and others.

The dataClusterSeed directory is a sorting of data collected from PriceCharting. You can visit their website for more information : https://www.pricecharting.com/

Currently, the focus is on video games, consoles, and accessories.

When running the command `npm run seedP`, not all prices from PriceCharting are added as they are in US prices.

That's why a cron job has been set up to scrape successful sales from eBay. ⚠️ Please note that the current cron job scrapes every 10 seconds per item to get a lot of results for improvement. This could potentially lead to a large amount of data being processed and may saturate your computer's memory. Please ensure your system has sufficient resources to handle this load. ⚠️

Initially, the scraping service only dealt with complete boxed video games...

This first version is functional. There are a few minor adjustments to be made to improve eBay scraping and updating prices and sales dates on eBay.

The project is named Playlog, a combination of 'player' and 'log' from console.log.

😊 All ideas, help, or shares for the project are welcome. 😊

## Commands to launch the backend project

1. To build the project, use the following command:

1.1 Replace the env.example file with your .env file

1.2 Install the necessary packages with the command

```bash
npm install
```

1.3 Launch the seeds to populate your MySQL database with the command

```bash
npm run seedP
```

1.4 Run the following command to start the project in watch mode

```bash
npm run start:dev
```

## Database Schema

For a better understanding of the project, here is the database schema:

![Database Schema](/img/Database.png)

## Next feature 

1.1: Enhance the eBay scraping process to achieve better results. Make the scraping generic for all item types, including video games, consoles, and accessories.

1.2: Currently, scraping only works for the prices of complete items, but it should also be extended to cover loose items or even empty boxes. In short, there is a lot of room for improvement in this area.

1.3 Redis for Scraping ? 

2.0: Consider providing an SQL file once the majority of item data has been updated.