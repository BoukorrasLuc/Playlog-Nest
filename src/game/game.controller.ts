// system.controller.ts
import { Controller, Get, Param, Put, Body, Delete, Post } from '@nestjs/common';
import { GameService } from '../game/game.service';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get()
  getAll() {
    return this.gameService.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.gameService.getById(id);
  }

  @Put(':id')
  updateById(@Param('id') id: string, @Body() data: UpdateGameDto) {
    return this.gameService.updateById(id, data);
  }

  @Delete(':id')
  deleteById(@Param('id') id: string) {
    return this.gameService.deleteById(id);
  }

  @Post() 
  create(@Body() CreateGameDto: CreateGameDto){
    return this.gameService.create(CreateGameDto);
  }
}