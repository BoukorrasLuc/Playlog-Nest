-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `nom` VARCHAR(191) NULL,
    `prenom` VARCHAR(191) NULL,
    `pseudo` VARCHAR(191) NULL,
    `password` VARCHAR(191) NOT NULL,
    `avatar` VARCHAR(191) NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ItemScrappeDatabase` (
    `id` VARCHAR(191) NOT NULL,
    `ean` VARCHAR(191) NULL,
    `title` VARCHAR(191) NULL,
    `systems` VARCHAR(191) NULL,
    `condition` VARCHAR(191) NULL,
    `completeness` VARCHAR(191) NULL,
    `zone` VARCHAR(191) NULL,
    `priceSold` VARCHAR(191) NULL,
    `dateSold` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `PriceData` (
    `id` VARCHAR(191) NOT NULL,
    `asin` VARCHAR(191) NULL,
    `upc` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NULL,
    `consoleName` VARCHAR(191) NULL,
    `genre` VARCHAR(191) NULL,
    `releaseDate` VARCHAR(191) NULL,
    `loosePrice` INTEGER NULL,
    `cibPrice` INTEGER NULL,
    `newPrice` INTEGER NULL,
    `boxOnlyPrice` INTEGER NULL,
    `manualOnlyPrice` INTEGER NULL,
    `gradedPrice` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `System` (
    `id` VARCHAR(191) NOT NULL,
    `asin` VARCHAR(191) NULL,
    `upc` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NULL,
    `consoleName` VARCHAR(191) NULL,
    `genre` VARCHAR(191) NULL,
    `releaseDate` VARCHAR(191) NULL,
    `loosePrice` INTEGER NULL,
    `cibPrice` INTEGER NULL,
    `newPrice` INTEGER NULL,
    `boxOnlyPrice` INTEGER NULL,
    `manualOnlyPrice` INTEGER NULL,
    `gradedPrice` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Accessory` (
    `id` VARCHAR(191) NOT NULL,
    `asin` VARCHAR(191) NULL,
    `upc` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NULL,
    `consoleName` VARCHAR(191) NULL,
    `genre` VARCHAR(191) NULL,
    `releaseDate` VARCHAR(191) NULL,
    `loosePrice` INTEGER NULL,
    `cibPrice` INTEGER NULL,
    `newPrice` INTEGER NULL,
    `boxOnlyPrice` INTEGER NULL,
    `manualOnlyPrice` INTEGER NULL,
    `gradedPrice` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Game` (
    `id` VARCHAR(191) NOT NULL,
    `asin` VARCHAR(191) NULL,
    `upc` VARCHAR(191) NULL,
    `productName` VARCHAR(191) NULL,
    `consoleName` VARCHAR(191) NULL,
    `genre` VARCHAR(191) NULL,
    `releaseDate` VARCHAR(191) NULL,
    `loosePrice` INTEGER NULL,
    `cibPrice` INTEGER NULL,
    `newPrice` INTEGER NULL,
    `boxOnlyPrice` INTEGER NULL,
    `manualOnlyPrice` INTEGER NULL,
    `gradedPrice` INTEGER NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserCollection` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `systemId` VARCHAR(191) NULL,
    `accessoryId` VARCHAR(191) NULL,
    `gameId` VARCHAR(191) NULL,
    `acquisitionDate` DATETIME(3) NULL,
    `acquisitionPrice` DOUBLE NULL,
    `condition` VARCHAR(191) NULL,
    `completeness` VARCHAR(191) NULL,
    `notes` VARCHAR(191) NULL,

    UNIQUE INDEX `UserCollection_userId_systemId_key`(`userId`, `systemId`),
    UNIQUE INDEX `UserCollection_userId_accessoryId_key`(`userId`, `accessoryId`),
    UNIQUE INDEX `UserCollection_userId_gameId_key`(`userId`, `gameId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserCollection` ADD CONSTRAINT `UserCollection_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCollection` ADD CONSTRAINT `UserCollection_systemId_fkey` FOREIGN KEY (`systemId`) REFERENCES `System`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCollection` ADD CONSTRAINT `UserCollection_accessoryId_fkey` FOREIGN KEY (`accessoryId`) REFERENCES `Accessory`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `UserCollection` ADD CONSTRAINT `UserCollection_gameId_fkey` FOREIGN KEY (`gameId`) REFERENCES `Game`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
