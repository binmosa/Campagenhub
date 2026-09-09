import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './jwt.strategy';
import { TurnstileGuard } from './turnstile.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreatorProfile } from '../creators/creator-profile.entity';
import { BrandProfile } from '../brands/brand-profile.entity';
import { ManagerProfile } from '../managers/manager-profile.entity';
import { Role } from '../roles/role.entity';
import { BrandTeam } from '../invitations/brand-team.entity';
import { User } from '../users/user.entity';

@Module({
  imports: [
    UsersModule,
    PassportModule,
    TypeOrmModule.forFeature([CreatorProfile, BrandProfile, ManagerProfile, Role, BrandTeam, User]),
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  providers: [AuthService, JwtStrategy, TurnstileGuard],
  controllers: [AuthController],
})
export class AuthModule {}
