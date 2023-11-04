import { Controller, Get, Param, Put, Body, Delete, Post } from '@nestjs/common';
import { SystemService } from './system.service';
import { CreateSystemDto, UpdateSystemDto } from './dto/system.dto';
import { System } from '@prisma/client';

@Controller('system')
export class SystemController {
  constructor(private readonly systemService: SystemService) {}

  @Get()
  getAll(): Promise<System[]> {
    return this.systemService.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<System> {
    return this.systemService.getById(id);
  }

  @Put(':id')
  updateById(@Param('id') id: string, @Body() data: UpdateSystemDto): Promise<System> {
    return this.systemService.updateById(id, data);
  }

  @Delete(':id')
  deleteById(@Param('id') id: string) {
    return this.systemService.deleteById(id);
  }

  @Post() 
  create(@Body() CreateSystemDto: CreateSystemDto): Promise<System> {
    return this.systemService.create(CreateSystemDto);
  }
}