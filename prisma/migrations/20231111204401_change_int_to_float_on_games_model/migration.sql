/*
  Warnings:

  - You are about to alter the column `cibPrice` on the `Game` table. The data in that column could be lost. The data in that column will be cast from `Int` to `Double`.

*/
-- AlterTable
ALTER TABLE `Game` MODIFY `cibPrice` DOUBLE NULL;
