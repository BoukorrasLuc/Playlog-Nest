import { Controller, Get, Param, Put, Body, Delete, Post } from '@nestjs/common';
import { AccessoryService } from '../accessory/accessory.service';
import { CreateAccessoryDto, UpdateAccessoryDto } from './dto/accessory.dto';

@Controller('accessory')
export class AccessoryController {
  constructor(private readonly accessoryService: AccessoryService) {}

  @Get()
  getAll() {
    return this.accessoryService.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.accessoryService.getById(id);
  }

  @Put(':id')
  updateById(@Param('id') id: string, @Body() data: UpdateAccessoryDto) {
    return this.accessoryService.updateById(id, data);
  }

  @Delete(':id')
  deleteById(@Param('id') id: string) {
    return this.accessoryService.deleteById(id);
  }

  @Post() 
  create(@Body() CreateAccessoryDto: CreateAccessoryDto){
    return this.accessoryService.create(CreateAccessoryDto);
  }
}