import { Controller, Get, Param, Put, Body, Delete, Post} from '@nestjs/common';
import { UserCollectionService } from './user-collection.service';
import { UserCollectionDto } from './dto/user-collection.dto';

@Controller('user-collection')
export class UserCollectionController {
  constructor(private readonly userCollectionService: UserCollectionService) {}

  @Get()
  findAll() {
    return this.userCollectionService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.userCollectionService.findOne(+id);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() userCollectionDto: UserCollectionDto) {
    return this.userCollectionService.update(+id, userCollectionDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.userCollectionService.remove(+id);
  }

  @Post()
  create(@Body() userCollectionDto: UserCollectionDto) {
    return this.userCollectionService.create(userCollectionDto);
  }
}