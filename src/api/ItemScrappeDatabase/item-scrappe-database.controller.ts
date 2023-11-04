import { Controller, Get, Param, Put, Body, Delete, Post} from '@nestjs/common';
import { ItemScrappeDatabaseService } from './item-scrappe-database.service';
import { ItemScrappeDatabaseDto } from './dto/item-scrappe-database.dto';

@Controller('item-scrappe-database')
export class ItemScrappeDatabaseController {
  constructor(private readonly itemScrappeDatabaseService: ItemScrappeDatabaseService) {}

  @Get()
  findAll(): Promise<ItemScrappeDatabaseDto[]> {
    return this.itemScrappeDatabaseService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ItemScrappeDatabaseDto> {
    return this.itemScrappeDatabaseService.findOne(id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() itemScrappeDatabaseDto: ItemScrappeDatabaseDto): Promise<ItemScrappeDatabaseDto> {
    return this.itemScrappeDatabaseService.update(id, itemScrappeDatabaseDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.itemScrappeDatabaseService.remove(id);
  }

  @Post()
  create(@Body() itemScrappeDatabaseDto: ItemScrappeDatabaseDto): Promise<ItemScrappeDatabaseDto> {
    return this.itemScrappeDatabaseService.create(itemScrappeDatabaseDto);
  }
}