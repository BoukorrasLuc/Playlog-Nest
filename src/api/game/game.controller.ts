import { Controller, Get, Param, Put, Body, Delete, Post } from '@nestjs/common';
import { GameService } from './game.service';
import { CreateGameDto, UpdateGameDto } from './dto/game.dto';
import { Game } from '@prisma/client';

@Controller('game')
export class GameController {
  constructor(private readonly gameService: GameService) {}

  @Get()
  getAll(): Promise<Game[]> {
    return this.gameService.getAll();
  }

  @Get(':id')
  getById(@Param('id') id: string): Promise<Game> {
    return this.gameService.getById(id);
  }

  @Put(':id')
  updateById(@Param('id') id: string, @Body() data: UpdateGameDto): Promise<Game> {
    return this.gameService.updateById(id, data);
  }

  @Delete(':id')
  deleteById(@Param('id') id: string) {
    return this.gameService.deleteById(id);
  }

  @Post() 
  create(@Body() CreateGameDto: CreateGameDto): Promise<Game> {
    return this.gameService.create(CreateGameDto);
  }
}