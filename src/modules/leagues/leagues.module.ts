import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LeaguesController } from './leagues.controller';
import { LeaguesService } from './leagues.service';
import { League } from '../../entities/league.entity';
import { User } from '../../entities/user.entity';
import { LeagueOperator } from '../../entities/league-operator.entity';
import { LeagueParticipant } from '../../entities/league-participant.entity';
import { LeagueTemplate } from '../../entities/league-template.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([League, User, LeagueOperator, LeagueParticipant, LeagueTemplate]),
  ],
  controllers: [LeaguesController],
  providers: [LeaguesService],
  exports: [LeaguesService, TypeOrmModule],
})
export class LeaguesModule {} 