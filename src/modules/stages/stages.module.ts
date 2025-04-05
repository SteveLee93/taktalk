import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Stage } from '../../entities/stage.entity';
import { Match } from '../../entities/match.entity';
import { Group } from '../../entities/group.entity';
import { PlayerInGroup } from '../../entities/player-in-group.entity';
import { MatchResult } from '../../entities/match-result.entity';
import { User } from '../../entities/user.entity';
import { StagesController } from './stages.controller';
import { StagesService } from './stages.service';
import { MatchController } from './match.controller';
import { MatchService } from './match.service';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { TournamentStageStrategy } from './strategies/tournament.strategy';
import { LeaguesModule } from '../leagues/leagues.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Stage,
      Match,
      Group,
      PlayerInGroup,
      MatchResult,
      User,
    ]),
    LeaguesModule,
  ],
  controllers: [StagesController, MatchController],
  providers: [StagesService, MatchService, GroupStageStrategy, TournamentStageStrategy],
  exports: [StagesService],
})
export class StagesModule {} 