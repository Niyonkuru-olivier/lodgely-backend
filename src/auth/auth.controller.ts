import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  UseGuards,
  Request,
  BadRequestException,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { PasswordResetService } from './password-reset.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { isValidEmail, normalizeEmail } from '../common/utils/email.util';

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private passwordResetService: PasswordResetService,
  ) {}

  @Post('register')
  async register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  async login(@Body() body: any) {
    return this.authService.login(body);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email?: string }) {
    if (!body?.email?.trim()) {
      throw new BadRequestException('Email is required');
    }

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) {
      throw new BadRequestException('Please provide a valid email address');
    }

    return this.passwordResetService.forgotPassword(email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: { token: string; password: string }) {
    return this.passwordResetService.resetPassword(body.token, body.password);
  }

  @UseGuards(JwtAuthGuard)
  @Get('profile')
  async getProfile(@Request() req: any) {
    return this.authService.getProfile(req.user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('profile')
  async updateProfile(
    @Request() req: any,
    @Body()
    body: {
      name?: string;
      email?: string;
      currentPassword?: string;
      newPassword?: string;
    },
  ) {
    return this.authService.updateProfile(req.user.id, body);
  }
}
