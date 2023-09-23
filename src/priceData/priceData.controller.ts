import { Controller, Get, Param, Put, Body, Delete, Post } from '@nestjs/common';
import { PriceDataService } from '../priceData/priceData.service';
import { CreatePriceDataDto, UpdatePriceDataDto } from './dto/priceData.dto';

@Controller('priceData')
export class PriceDataController {
  constructor(private readonly priceDataService: PriceDataService) {}

  @Get()
  getAll() {
    return this.priceDataService.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.priceDataService.getById(id);
  }

  @Put(':id')
  updateById(@Param('id') id: string, @Body() data: UpdatePriceDataDto) {
    return this.priceDataService.updateById(id, data);
  }

  @Delete(':id')
  deleteById(@Param('id') id: string) {
    return this.priceDataService.deleteById(id);
  }

  @Post() 
  create(@Body() CreatePriceDataDto: CreatePriceDataDto){
    return this.priceDataService.create(CreatePriceDataDto);
  }
}