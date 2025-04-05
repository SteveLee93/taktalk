import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import { Stage } from '../../entities/stage.entity';
import { Match } from '../../entities/match.entity';
import { MatchResult } from '../../entities/match-result.entity';
import { League } from '../../entities/league.entity';
import { User } from '../../entities/user.entity';
import { StageType } from '../../common/enums/stage-type.enum';
import { CreateStageDto, UpdateMatchResultDto } from './dto/stage.dto';
import { GroupStageStrategy } from './strategies/group-stage.strategy';
import { TournamentStageStrategy } from './strategies/tournament.strategy';
import { StageStrategy } from './strategies/stage-strategy.interface';
import { MatchStatus } from '../../entities/match.entity';
import { Group } from '../../entities/group.entity';
import { PlayerInGroup } from '../../entities/player-in-group.entity';
import { ConfirmGroupsDto } from './dto/confirm-groups.dto';
import { BaseStageOptions, GroupStageOptions, TournamentOptions } from '../../common/types/stage-options.type';
import { UpdateStageDto } from './dto/update-stage.dto';
import { MatchService } from './match.service';

@Injectable()
export class StagesService {
  private strategies: Map<StageType, StageStrategy>;

  constructor(
    @InjectRepository(Stage)
    private stageRepository: Repository<Stage>,
    @InjectRepository(Match)
    private matchRepository: Repository<Match>,
    @InjectRepository(MatchResult)
    private matchResultRepository: Repository<MatchResult>,
    @InjectRepository(League)
    private leagueRepository: Repository<League>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(Group)
    private groupRepository: Repository<Group>,
    @InjectRepository(PlayerInGroup)
    private playerInGroupRepository: Repository<PlayerInGroup>,
    private groupStageStrategy: GroupStageStrategy,
    private tournamentStageStrategy: TournamentStageStrategy,
    private matchService: MatchService,
  ) {
    this.strategies = new Map<StageType, StageStrategy>([
      [StageType.GROUP, groupStageStrategy],
      [StageType.TOURNAMENT, tournamentStageStrategy],
    ]);
  }

  async createStage(createStageDto: CreateStageDto): Promise<Stage> {
    const league = await this.leagueRepository.findOne({
      where: { id: createStageDto.leagueId },
      relations: ['participants', 'participants.user'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    // 동일한 순서의 단계가 있는지 확인
    const existingStage = await this.stageRepository.findOne({
      where: { league: { id: league.id }, order: createStageDto.order },
    });

    if (existingStage) {
      throw new BadRequestException('해당 순서의 단계가 이미 존재합니다.');
    }

    const stage = this.stageRepository.create({
      ...createStageDto,
      league,
    });

    const savedStage = await this.stageRepository.save(stage);

    // 전략 패턴을 사용하여 단계별 로직 실행
    const strategy = this.strategies.get(createStageDto.type);
    if (!strategy) {
      throw new BadRequestException('지원하지 않는 단계 타입입니다.');
    }

    const players = league.participants
      .filter(p => p.status === 'approved')
      .map(p => p.user);

    await strategy.createGroups(savedStage, players);
    await strategy.createMatches(savedStage);

    return savedStage;
  }

  async getStage(id: number): Promise<Stage> {
    const stage = await this.stageRepository.findOne({
      where: { id },
      relations: [
        'league',
        'groups',
        'groups.players',
        'groups.players.user',
        'matches',
        'matches.player1',
        'matches.player2',
        'matches.result',
        'matches.result.winner',
        'matches.result.match',
        'league.participants',
        'league.participants.user'
      ],
      order: {
        matches: {
          order: 'ASC'
        }
      }
    });

    if (!stage) {
      throw new NotFoundException('단계를 찾을 수 없습니다.');
    }

    return stage;
  }

  async updateStage(id: number, updateStageDto: UpdateStageDto): Promise<Stage> {
    const stage = await this.stageRepository.findOne({
      where: { id },
      relations: ['matches'],
    });

    if (!stage) {
      throw new NotFoundException('단계를 찾을 수 없습니다.');
    }

    // 매치가 있는 경우 수정 불가
    if (stage.matches && stage.matches.length > 0) {
      throw new BadRequestException('이미 시작된 단계는 수정할 수 없습니다.');
    }

    // 동일한 순서의 다른 단계가 있는지 확인
    if (updateStageDto.order) {
      const existingStage = await this.stageRepository.findOne({
        where: {
          league: { id: stage.league.id },
          order: updateStageDto.order,
          id: Not(id),
        },
      });

      if (existingStage) {
        throw new BadRequestException('해당 순서의 단계가 이미 존재합니다.');
      }
    }

    // 업데이트할 필드만 선택적으로 적용
    if (updateStageDto.name) stage.name = updateStageDto.name;
    if (updateStageDto.order) stage.order = updateStageDto.order;
    if (updateStageDto.type) stage.type = updateStageDto.type;
    if (updateStageDto.options) stage.options = updateStageDto.options;

    return this.stageRepository.save(stage);
  }

  async updateMatchResult(
    matchId: number,
    updateMatchResultDto: UpdateMatchResultDto,
  ): Promise<void> {
    // 트랜잭션 시작
    await this.matchRepository.manager.transaction(async transactionalEntityManager => {
      // 기존 매치와 결과를 함께 조회
      const match = await transactionalEntityManager
        .getRepository(Match)
        .findOne({
          where: { id: matchId },
          relations: ['stage', 'player1', 'player2', 'result'],
        });

      if (!match) {
        throw new NotFoundException('경기를 찾을 수 없습니다.');
      }

      if (!match.player1 || !match.player2) {
        throw new BadRequestException('매치에 두 플레이어가 모두 설정되어 있어야 합니다.');
      }

      // 세트 스코어 계산
      const player1Sets = updateMatchResultDto.scoreDetails.filter(
        set => set.player1Score > set.player2Score
      ).length;
      const player2Sets = updateMatchResultDto.scoreDetails.filter(
        set => set.player2Score > set.player1Score
      ).length;

      // 승자 결정
      const winner = player1Sets > player2Sets ? match.player1 : match.player2;

      // 기존 결과가 있으면 삭제
      if (match.result) {
        await transactionalEntityManager
          .getRepository(MatchResult)
          .delete(match.result.id);
        
        // 매치의 result 관계도 제거
        match.result = null as any;  // null 대신 undefined 사용
        await transactionalEntityManager
          .getRepository(Match)
          .save(match);
      }

      // 새로운 결과 생성
      const matchResultRepo = transactionalEntityManager.getRepository(MatchResult);
      const result = new MatchResult();
      result.match = match;
      result.winner = winner;
      
      result.scoreDetails = {
        sets: updateMatchResultDto.scoreDetails.map(score => ({
          player1Score: score.player1Score,
          player2Score: score.player2Score,
        })),
        finalScore: {
          player1Sets,
          player2Sets,
        }
      };

      // result 저장
      const savedResult = await matchResultRepo.save(result);

      // match 업데이트
      match.status = MatchStatus.COMPLETED;
      match.result = savedResult;
      await transactionalEntityManager
        .getRepository(Match)
        .save(match);

      // 토너먼트의 경우 다음 라운드 매치 업데이트
      if (match.stage.type === StageType.TOURNAMENT) {
        const nextMatch = await this.findNextTournamentMatch(match);
        if (nextMatch) {
          if (!nextMatch.player1) {
            nextMatch.player1 = winner;
          } else if (!nextMatch.player2) {
            nextMatch.player2 = winner;
          }
          await transactionalEntityManager
            .getRepository(Match)
            .save(nextMatch);
        }
      }
    });
  }

  private async findNextTournamentMatch(currentMatch: Match): Promise<Match | null> {
    const matches = await this.matchRepository.find({
      where: { stage: { id: currentMatch.stage.id } },
      order: { id: 'ASC' },
    });

    const currentMatchIndex = matches.findIndex(m => m.id === currentMatch.id);
    const nextMatchIndex = Math.floor(currentMatchIndex / 2) + Math.floor(matches.length / 2);

    return nextMatchIndex < matches.length ? matches[nextMatchIndex] : null;
  }

  async confirmGroups(id: number, confirmGroupsDto: ConfirmGroupsDto): Promise<Stage> {
    const stage = await this.stageRepository.findOne({
      where: { id },
      relations: ['groups', 'groups.players'],
    });

    if (!stage) {
      throw new NotFoundException('스테이지를 찾을 수 없습니다.');
    }

    if (stage.type !== StageType.GROUP) {
      throw new BadRequestException('예선 단계에서만 조 편성이 가능합니다.');
    }

    // 기존 조 및 참가자 정보 삭제
    if (stage.groups) {
      await Promise.all(
        stage.groups.map(async (group) => {
          await this.playerInGroupRepository.delete({ group: { id: group.id } });
          await this.groupRepository.delete(group.id);
        }),
      );
    }

    // 새로운 조 생성
    await Promise.all(
      confirmGroupsDto.groups.map(async (playerIds, index) => {
        // Group 엔티티 생성
        const group = new Group();
        group.stage = stage;
        group.name = `${index + 1}조`;
        group.number = index + 1;
        
        const savedGroup = await this.groupRepository.save(group);

        // 조별 참가자 등록
        await Promise.all(
          playerIds.map(async (playerId) => {
            const user = await this.userRepository.findOne({
              where: { id: playerId },
            });
            
            if (!user) {
              throw new BadRequestException(`사용자 ID ${playerId}를 찾을 수 없습니다.`);
            }

            const playerInGroup = new PlayerInGroup();
            playerInGroup.group = savedGroup;
            playerInGroup.user = user;
            
            await this.playerInGroupRepository.save(playerInGroup);
          }),
        );

        return savedGroup;
      }),
    );

    // 조별 매치 생성
    const strategy = this.strategies.get(StageType.GROUP);
    if (strategy) {
      await strategy.createMatches(stage);
    }

    // 그룹 순서 설정
    stage.groups.forEach((group, index) => {
      group.number = index + 1;
    });
    await this.groupRepository.save(stage.groups);

    // 업데이트된 스테이지 조회 및 반환
    const updatedStage = await this.stageRepository.findOne({
      where: { id },
      relations: ['groups', 'groups.players', 'groups.players.user'],
    });

    if (!updatedStage) {
      throw new NotFoundException('스테이지를 찾을 수 없습니다.');
    }

    return updatedStage;
  }
} 