/*
  Warnings:

  - You are about to alter the column `loosePrice` on the `Accessory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `cibPrice` on the `Accessory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `newPrice` on the `Accessory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `boxOnlyPrice` on the `Accessory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `manualOnlyPrice` on the `Accessory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `gradedPrice` on the `Accessory` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `loosePrice` on the `Game` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `newPrice` on the `Game` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `boxOnlyPrice` on the `Game` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `manualOnlyPrice` on the `Game` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `gradedPrice` on the `Game` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `loosePrice` on the `System` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `cibPrice` on the `System` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `newPrice` on the `System` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `boxOnlyPrice` on the `System` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `manualOnlyPrice` on the `System` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to alter the column `gradedPrice` on the `System` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.
  - You are about to drop the `ItemScrappeDatabase` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE `Accessory` MODIFY `loosePrice` DOUBLE NULL,
    MODIFY `cibPrice` DOUBLE NULL,
    MODIFY `newPrice` DOUBLE NULL,
    MODIFY `boxOnlyPrice` DOUBLE NULL,
    MODIFY `manualOnlyPrice` DOUBLE NULL,
    MODIFY `gradedPrice` DOUBLE NULL;

-- AlterTable
ALTER TABLE `Game` MODIFY `loosePrice` DOUBLE NULL,
    MODIFY `newPrice` DOUBLE NULL,
    MODIFY `boxOnlyPrice` DOUBLE NULL,
    MODIFY `manualOnlyPrice` DOUBLE NULL,
    MODIFY `gradedPrice` DOUBLE NULL;

-- AlterTable
ALTER TABLE `System` MODIFY `loosePrice` DOUBLE NULL,
    MODIFY `cibPrice` DOUBLE NULL,
    MODIFY `newPrice` DOUBLE NULL,
    MODIFY `boxOnlyPrice` DOUBLE NULL,
    MODIFY `manualOnlyPrice` DOUBLE NULL,
    MODIFY `gradedPrice` DOUBLE NULL;

-- DropTable
DROP TABLE `ItemScrappeDatabase`;
