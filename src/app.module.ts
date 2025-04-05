import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { LeaguesModule } from './modules/leagues/leagues.module';
import { User } from './entities/user.entity';
import { League } from './entities/league.entity';
import { LeagueOperator } from './entities/league-operator.entity';
import { LeagueParticipant } from './entities/league-participant.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'mysql',
        host: configService.get('DB_HOST'),
        port: configService.get('DB_PORT'),
        username: configService.get('DB_USERNAME'),
        password: configService.get('DB_PASSWORD'),
        database: configService.get('DB_DATABASE'),
        entities: [User, League, LeagueOperator, LeagueParticipant],
        synchronize: true, // 개발 환경에서만 사용하세요
      }),
      inject: [ConfigService],
    }),
    AuthModule,
    LeaguesModule,
  ],
})
export class AppModule {} 