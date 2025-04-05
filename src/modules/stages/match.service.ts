import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Match } from '../../entities/match.entity';
import { TournamentStageStrategy } from './strategies/tournament.strategy';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { Stage } from '../../entities/stage.entity';
import { UpdateMatchResultDto } from './dto/match.dto';
import { StageType } from '../../common/enums/stage-type.enum';

@Injectable()
export class MatchService {
  constructor(
    @InjectRepository(Match)
    private readonly matchRepository: Repository<Match>,
    @InjectRepository(Stage)
    private readonly stageRepository: Repository<Stage>,
    private readonly tournamentStrategy: TournamentStageStrategy,
    private readonly groupStageStrategy: GroupStageStrategy,
  ) {}

  async getMatchesByStage(stageId: number): Promise<Match[]> {
    const matches = await this.matchRepository.find({
      where: { stage: { id: stageId } },
      relations: {
        stage: true,
        group: true,
        player1: true,
        player2: true,
        result: true,
      },
      order: {
        stage: { order: 'ASC' },
        group: { number: 'ASC' },
        order: 'ASC',
      }
    });

    if (!matches.length) {
      throw new NotFoundException(`매치를 찾을 수 없습니다. 스테이지 ID: ${stageId}`);
    }

    return matches;
  }

  async getMatch(id: number): Promise<Match> {
    const match = await this.matchRepository.findOne({
      where: { id },
      relations: ['player1', 'player2', 'nextMatch', 'stage', 'result'],
    });

    if (!match) {
      throw new NotFoundException(`매치를 찾을 수 없습니다. ID: ${id}`);
    }

    return match;
  }

  async updateMatchResult(id: number, updateMatchResultDto: UpdateMatchResultDto): Promise<Match> {
    const match = await this.getMatch(id);
    const stage = await this.stageRepository.findOne({
      where: { id: match.stage.id }
    });

    if (!stage) {
      throw new NotFoundException('스테이지를 찾을 수 없습니다.');
    }

    // 리그전과 토너먼트 매치 구분
    if (stage.type === StageType.GROUP) {
      if (!updateMatchResultDto.scoreDetails) {
        throw new BadRequestException('매치 결과에는 세트 스코어가 필요합니다.');
      }
      await this.groupStageStrategy.updateMatchResult(match, updateMatchResultDto.scoreDetails);
    } else {
      if (!updateMatchResultDto.scoreDetails) {
        throw new BadRequestException('매치 결과에는 세트 스코어가 필요합니다.');
      }
      // 세트 스코어로 승자 결정
      const player1Sets = updateMatchResultDto.scoreDetails.filter(
        set => set.player1Score > set.player2Score
      ).length;
      const player2Sets = updateMatchResultDto.scoreDetails.filter(
        set => set.player2Score > set.player1Score
      ).length;

      if (!match.player1 || !match.player2) {
        throw new BadRequestException('매치에 두 플레이어가 모두 설정되어 있어야 합니다.');
      }

      const winnerId = player1Sets > player2Sets ? match.player1.id : match.player2.id;
      await this.tournamentStrategy.updateMatchResult(match, winnerId);
    }

    return this.getMatch(id);
  }
} 