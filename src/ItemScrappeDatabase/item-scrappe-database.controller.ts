import { Controller, Get, Param, Put, Body, Delete } from '@nestjs/common';
import { ItemScrappeDatabaseService } from './item-scrappe-database.service';
import { ItemScrappeDatabaseDto } from './dto/item-scrappe-database.dto';

@Controller('item-scrappe-database')
export class ItemScrappeDatabaseController {
  constructor(private readonly itemScrappeDatabaseService: ItemScrappeDatabaseService) {}

  @Get()
  findAll() {
    return this.itemScrappeDatabaseService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.itemScrappeDatabaseService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() itemScrappeDatabaseDto: ItemScrappeDatabaseDto) {
    return this.itemScrappeDatabaseService.update(id, itemScrappeDatabaseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemScrappeDatabaseService.remove(id);
  }
}