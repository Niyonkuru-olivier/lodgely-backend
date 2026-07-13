import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { AccommodationsModule } from './accommodations/accommodations.module';
import { UsersModule } from './users/users.module';
import { EmailModule } from './email/email.module';

@Module({
  imports: [EmailModule, AuthModule, AccommodationsModule, UsersModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
