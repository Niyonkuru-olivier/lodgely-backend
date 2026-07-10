import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('stats')
  async getStats() {
    return this.usersService.getStats();
  }

  @Get('users')
  async findAll() {
    return this.usersService.findAll();
  }

  @Get('users/:id')
  async findOne(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.findOne(id);
  }

  @Post('users')
  async create(@Body() body: { email: string; password: string; name: string; role?: string }) {
    return this.usersService.create(body);
  }

  @Patch('users/:id')
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { email?: string; name?: string; role?: string; password?: string },
  ) {
    return this.usersService.update(id, body);
  }

  @Delete('users/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    return this.usersService.remove(id);
  }
}
