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
import { ParticipantStatus } from '../../entities/league-participant.entity';
import { LeagueParticipant } from '../../entities/league-participant.entity';
import { BracketType, SeedingType } from '../../common/types/stage-options.type';
import { LeagueStatus } from '../../common/enums/league-status.enum';

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
    @InjectRepository(LeagueParticipant)
    private participantRepository: Repository<LeagueParticipant>,
    private groupStageStrategy: GroupStageStrategy,
    private tournamentStageStrategy: TournamentStageStrategy,
    private matchService: MatchService,
  ) {
    this.strategies = new Map<StageType, StageStrategy>([
      [StageType.GROUP, groupStageStrategy],
      [StageType.TOURNAMENT, tournamentStageStrategy],
    ]);
  }

  private getStageStrategy(type: 'GROUP' | 'TOURNAMENT'): StageStrategy {
    switch (type) {
      case 'GROUP':
        return this.groupStageStrategy;
      case 'TOURNAMENT':
        return this.tournamentStageStrategy;
      default:
        throw new BadRequestException('지원하지 않는 단계 타입입니다.');
    }
  }

  private getMatchOrder(playerCount: number): Array<[number, number]> {
    console.log(`getMatchOrder: 플레이어 수 ${playerCount}명에 대한 매치 패턴 생성`);
    
    // 각 인원수별 매치 순서 정의
    const matchOrders: { [key: number]: Array<[number, number]> } = {
      2: [[1,2]],
      3: [[1,2], [1,3], [2,3]],
      4: [[1,4], [2,3], [1,3], [2,4], [1,2], [3,4]],
      5: [[1,5], [2,4], [1,3], [2,5], [3,4], [1,2], [3,5], [1,4], [2,3], [4,5]],
      6: [[1,6], [2,5], [3,4], [1,5], [4,6], [2,3], [1,4], [3,5], [2,6], [1,3], [2,4], [5,6], [1,2], [3,6], [4,5]],
      7: [[1,7], [2,6], [3,5], [1,4], [2,7], [3,6], [4,5], [1,2], [3,7], [4,6], [1,5], [2,3], [4,7], [5,6], [1,3], [2,4], [5,7], [1,6], [3,4], [2,5], [6,7]],
      8: [[1,8], [2,7], [3,6], [4,5], [1,7], [6,8], [2,5], [3,4], [1,6], [5,7], [4,8], [2,3], [1,5], [4,6], [3,7], [2,8], [1,4], [3,5], [2,6], [7,8], [1,3], [2,4], [5,8], [6,7], [1,2], [3,8], [4,7], [5,6]],
      9: [[1,9], [2,8], [3,7], [4,6], [1,5], [2,9], [3,8], [4,7], [5,6], [1,2], [3,9], [4,8], [5,7], [1,6], [2,3], [4,9], [5,8], [6,7], [1,3], [2,4], [5,9], [6,8], [1,7], [3,4], [2,5], [6,9], [7,8], [1,4], [3,5], [2,6], [7,9], [1,8], [4,5], [3,6], [2,7], [8,9]],
      10: [[1,10], [2,9], [3,8], [4,7], [5,6], [1,9], [8,10], [2,7], [3,6], [4,5], [1,8], [7,9], [6,10], [2,5], [3,4], [1,7], [6,8], [5,9], [4,10], [2,3], [1,6], [5,7], [4,8], [3,9], [2,10], [1,5], [4,6], [3,7], [2,8], [9,10], [1,4], [3,5], [2,6], [7,10], [8,9], [1,3], [2,4], [5,10], [6,9], [7,8], [1,2], [3,10], [4,9], [5,8], [6,7]]
    };

    const pattern = matchOrders[playerCount] || [];
    if (pattern.length === 0) {
      console.log(`${playerCount}명에 대한 미리 정의된 패턴이 없습니다. 기본 패턴을 생성합니다.`);
      // 기본 패턴: 모든 플레이어가 서로 한 번씩 대전
      for (let i = 1; i <= playerCount; i++) {
        for (let j = i + 1; j <= playerCount; j++) {
          pattern.push([i, j]);
        }
      }
    }
    
    console.log(`생성된 매치 패턴 (${pattern.length}개):`, pattern);
    return pattern;
  }

  async createStage(dto: CreateStageDto): Promise<Stage> {
    const league = await this.leagueRepository.findOne({
      where: { id: dto.leagueId },
      relations: ['participants'],
    });

    if (!league) {
      throw new NotFoundException('League not found');
    }

    // 동일한 leagueId와 order를 가진 Stage가 있는지 확인
    let stage = await this.stageRepository.findOne({
      where: { league: { id: dto.leagueId }, order: dto.order },
      relations: ['groups', 'groups.players', 'matches'],
    });

    let stageOptions: GroupStageOptions | TournamentOptions;
    
    if (dto.type === 'TOURNAMENT') {
      stageOptions = {
        matchFormat: {
          gamesRequired: dto.options.matchFormat.gamesRequired,
          setsRequired: dto.options.matchFormat.setsRequired
        },
        bracketType: 'SINGLE_ELIMINATION' as BracketType,
        seeding: {
          type: 'GROUP_RANK' as SeedingType,
          qualificationCriteria: {
            rankCutoff: dto.options.seeding?.qualificationCriteria?.rankCutoff,
            minRank: dto.options.seeding?.qualificationCriteria?.minRank,
            maxRank: dto.options.seeding?.qualificationCriteria?.maxRank
          }
        }
      } as TournamentOptions;
    } else {
      const groupOptions = dto.options as GroupStageOptions;
      stageOptions = {
        matchFormat: {
          gamesRequired: groupOptions.matchFormat.gamesRequired,
          setsRequired: groupOptions.matchFormat.setsRequired
        },
        groupCount: groupOptions.groupCount,
        playersPerGroup: groupOptions.playersPerGroup,
        advancingPlayersCount: groupOptions.advancingPlayersCount
      } as GroupStageOptions;
    }

    if (stage) {
      // 기존 Stage가 있는 경우, 관련된 groups와 matches를 모두 삭제
      if (stage.groups?.length > 0) {
        await this.groupRepository.remove(stage.groups);
      }
      if (stage.matches?.length > 0) {
        await this.matchRepository.remove(stage.matches);
      }

      // Stage 정보 업데이트
      stage.name = dto.name;
      stage.type = dto.type;
      stage.options = stageOptions;
    } else {
      // 새로운 Stage 생성
      stage = this.stageRepository.create({
        league,
        name: dto.name,
        order: dto.order,
        type: dto.type,
        options: stageOptions,
      });
    }

    // Stage 저장
    stage = await this.stageRepository.save(stage);

    // groups 데이터가 있는 경우 처리
    if (dto.groups && dto.groups.length > 0) {
      const groups = await Promise.all(
        dto.groups.map(async (groupDto, index) => {
          // 각 참가자의 userId로 LeagueParticipant 찾기
          const players = await Promise.all(
            groupDto.participants.map(async (participant) => {
              console.log('Searching for participant:', participant.userId);
              const leagueParticipant = await this.participantRepository.findOne({
                where: { 
                  league: { id: dto.leagueId },
                  userId: participant.userId,
                  status: ParticipantStatus.APPROVED
                },
                relations: ['user']
              });

              if (!leagueParticipant) {
                throw new BadRequestException(`참가자를 찾을 수 없습니다: ${participant.userId}`);
              }

              // user 정보가 없는 경우 user 정보를 직접 조회
              if (!leagueParticipant.user) {
                const user = await this.userRepository.findOne({
                  where: { userId: leagueParticipant.userId }
                });
                
                if (!user) {
                  throw new BadRequestException(`사용자 정보를 찾을 수 없습니다: ${participant.userId}`);
                }
                
                leagueParticipant.user = user;
                await this.participantRepository.save(leagueParticipant);
              }

              console.log('Found participant with user:', {
                participantId: leagueParticipant.id,
                userId: leagueParticipant.userId,
                userName: leagueParticipant.user?.name,
                userInfo: leagueParticipant.user
              });

              // skillLevel 업데이트
              leagueParticipant.skillLevel = participant.skillLevel;
              await this.participantRepository.save(leagueParticipant);

              return leagueParticipant;
            })
          );

          // 그룹 생성
          const group = this.groupRepository.create({
            stage,
            name: `Group ${index + 1}`,
            number: index + 1
          });

          // 그룹 먼저 저장
          const savedGroup = await this.groupRepository.save(group);

          // PlayerInGroup 엔티티 생성 및 저장
          const playerInGroups = players.map((player, playerIndex) => {
            console.log('Creating PlayerInGroup for user:', player.userId);
            const playerInGroup = new PlayerInGroup();
            playerInGroup.group = savedGroup;
            playerInGroup.user = player.user;
            playerInGroup.skillLevel = player.skillLevel;
            playerInGroup.orderNumber = playerIndex + 1;
            return playerInGroup;
          });

          await this.playerInGroupRepository.save(playerInGroups);

          // 매치 생성
          console.log(`그룹 ${savedGroup.id} 매치 생성 시작, 플레이어 수: ${players.length}`);
          const matchOrder = this.getMatchOrder(players.length);
          const matches: Match[] = [];

          // 매치 순서대로 생성
          for (const [matchIndex, pair] of matchOrder.entries()) {
            const [player1Index, player2Index] = pair.map(i => i - 1);
            
            console.log(`매치 ${matchIndex + 1} 생성: ${player1Index + 1} vs ${player2Index + 1}`);
            
            if (player1Index >= 0 && player1Index < players.length && 
                player2Index >= 0 && player2Index < players.length) {
              console.log(`플레이어1: ${players[player1Index].userId}, 플레이어2: ${players[player2Index].userId}`);
              
              const match = this.matchRepository.create({
                stage,
                group: savedGroup,
                groupNumber: savedGroup.number,
                player1: players[player1Index],
                player2: players[player2Index],
                status: MatchStatus.SCHEDULED,
                order: matchIndex + 1,
                description: `${savedGroup.number}조 ${matchIndex + 1}경기`,
                round: 1
              });
              matches.push(match);
            } else {
              console.log(`유효하지 않은 플레이어 인덱스: ${player1Index}, ${player2Index}, 플레이어 수: ${players.length}`);
            }
          }

          if (matches.length > 0) {
            console.log(`${matches.length}개의 매치 저장`);
            await this.matchRepository.save(matches);
          } else {
            console.log(`저장할 매치가 없습니다.`);
          }

          // 저장된 그룹 조회하여 반환
          const updatedGroup = await this.groupRepository.findOne({
            where: { id: savedGroup.id },
            relations: ['players', 'players.user']
          });

          if (!updatedGroup) {
            throw new BadRequestException(`그룹을 찾을 수 없습니다: ${savedGroup.id}`);
          }

          return updatedGroup;
        })
      );

      stage.groups = groups;
    }

    // 예선 스테이지인 경우 리그 상태 업데이트
    if (dto.type === StageType.GROUP) {
      league.status = LeagueStatus.PRELIMINARY;
      await this.leagueRepository.save(league);
    } else if (dto.type === StageType.TOURNAMENT) {
      league.status = LeagueStatus.MAIN;
      await this.leagueRepository.save(league);
    }

    // 업데이트된 스테이지 조회 (리그 정보 포함)
    const updatedStage = await this.stageRepository.findOne({
      where: { id: stage.id },
      relations: [
        'league',
        'league.participants',
        'league.participants.user',
        'groups',
        'groups.players',
        'groups.players.user',
        'matches',
        'matches.player1',
        'matches.player1.user',
        'matches.player2',
        'matches.player2.user',
        'matches.result',
        'matches.result.winner',
        'matches.result.winner.user'
      ],
      order: {
        groups: {
          number: 'ASC'
        },
        matches: {
          order: 'ASC'
        }
      }
    });

    if (!updatedStage) {
      throw new NotFoundException('Stage not found after update');
    }

    return updatedStage;
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
        groups: {
          number: 'ASC'
        },
        matches: {
          order: 'ASC'
        }
      }
    });

    if (!stage) {
      throw new NotFoundException('단계를 찾을 수 없습니다.');
    }

    // PlayerInGroup orderNumber 기준으로 정렬
    if (stage.groups) {
      for (const group of stage.groups) {
        if (group.players) {
          // orderNumber 기준으로 정렬
          group.players.sort((a, b) => a.orderNumber - b.orderNumber);
        }
      }
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
    console.log(`매치 ${matchId} 결과 업데이트 시작`);
    
    // 재시도 횟수 및 대기 시간 설정
    const MAX_RETRIES = 3;
    let retryCount = 0;
    
    // 트랜잭션 재시도 로직
    const executeWithRetry = async () => {
      try {
        // 먼저 매치 조회 (트랜잭션 밖에서)
        const match = await this.matchRepository.findOne({
          where: { id: matchId },
          relations: ['stage', 'group', 'player1', 'player2', 'result'],
        });
      
        if (!match) {
          throw new NotFoundException('경기를 찾을 수 없습니다.');
        }
      
        if (!match.player1 || !match.player2) {
          throw new BadRequestException('매치에 두 플레이어가 모두 설정되어 있어야 합니다.');
        }
      
        // 세트 스코어 계산 (트랜잭션 밖에서)
        const player1Sets = updateMatchResultDto.scoreDetails.filter(
          set => set.player1Score > set.player2Score
        ).length;
        const player2Sets = updateMatchResultDto.scoreDetails.filter(
          set => set.player2Score > set.player1Score
        ).length;
      
        // 승자 결정
        const winner = player1Sets > player2Sets ? match.player1 : match.player2;
        
        console.log(`승자 결정: ${winner.userId}, 스코어: ${player1Sets}:${player2Sets}`);
      
        // 결과 저장 트랜잭션 - 간결하게 유지
        await this.matchRepository.manager.transaction(async transactionalEntityManager => {
          // 1. 기존 결과가 있으면 삭제
          if (match.result) {
            await transactionalEntityManager
              .getRepository(MatchResult)
              .delete(match.result.id);
            
            match.result = null as any;
            await transactionalEntityManager
              .getRepository(Match)
              .save(match);
          }
      
          // 2. 새로운 결과 생성 및 저장
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
      
          const savedResult = await matchResultRepo.save(result);
      
          // 3. 매치 상태 업데이트
          match.status = MatchStatus.COMPLETED;
          match.result = savedResult;
          await transactionalEntityManager
            .getRepository(Match)
            .save(match);
        });
        
        // 트랜잭션이 성공적으로 완료된 후에만 순위 계산 수행
        // 이 부분을 별도 트랜잭션으로 분리하여 데드락 위험 감소
        if (match.stage.type === StageType.GROUP && match.group) {
          console.log(`그룹 ${match.group.id} 순위 재계산`);
          await this.recalculateGroupRanks(match.stage.id, match.group.id);
        } else if (match.stage.type === StageType.TOURNAMENT) {
          console.log(`토너먼트 매치 ${match.id} 결과 업데이트`);
          await this.tournamentStageStrategy.updateMatchResult(match, winner.id);
        }
        
        console.log(`매치 ${matchId} 결과 업데이트 완료`);
        return; // 성공했으므로 함수 종료
      } catch (error) {
        // 락 관련 오류인 경우 재시도
        const isLockError = 
          error.code === 'ER_LOCK_WAIT_TIMEOUT' || 
          error.code === 'ER_LOCK_DEADLOCK';
          
        if (isLockError && retryCount < MAX_RETRIES) {
          retryCount++;
          const waitTime = 500 * Math.pow(2, retryCount); // 지수 백오프
          console.log(`락 에러 발생, ${retryCount}번째 재시도 (${waitTime}ms 후)...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
          return executeWithRetry(); // 재귀적으로 함수 재시도
        }
        
        // 재시도 횟수 초과 또는 다른 오류인 경우 예외 전파
        console.error('매치 결과 업데이트 실패:', error);
        throw error;
      }
    };
    
    await executeWithRetry();
  }
  
  // 그룹 내 플레이어 순위 재계산 - 별도 메서드로 분리
  private async recalculateGroupRanks(stageId: number, groupId: number): Promise<void> {
    try {
      // 그룹 정보 로드
      const group = await this.groupRepository.findOne({
        where: { id: groupId, stage: { id: stageId } },
        relations: ['players', 'players.user']
      });
      
      if (!group) {
        console.error(`그룹을 찾을 수 없음: 스테이지 ${stageId}, 그룹 ${groupId}`);
        return;
      }
      
      // 그룹의 모든 매치 가져오기
      const matches = await this.matchRepository.find({
        where: { stage: { id: stageId }, group: { id: groupId } },
        relations: ['result', 'result.winner', 'player1', 'player2']
      });
      
      // 승리 수 계산
      const playerWins = new Map<number, number>();
      group.players.forEach(p => playerWins.set(p.user.id, 0));
      
      matches.forEach(match => {
        if (match.result?.winner) {
          const currentWins = playerWins.get(match.result.winner.id) || 0;
          playerWins.set(match.result.winner.id, currentWins + 1);
        }
      });
      
      // 각 플레이어의 승리 수에 따라 등수 결정 (원본 배열은 수정하지 않음)
      const playerRanks = new Map<number, number>();
      
      // 승리 수 기준으로 정렬된 플레이어 ID 배열 생성
      const sortedPlayerIds = [...playerWins.entries()]
        .sort((a, b) => b[1] - a[1]) // 승리 많은 순으로 정렬
        .map(entry => entry[0]);
        
      // 각 플레이어에게 등수 할당
      sortedPlayerIds.forEach((playerId, index) => {
        playerRanks.set(playerId, index + 1);
      });
      
      // 원본 플레이어 순서는 유지하고 rank만 업데이트
      await Promise.all(group.players.map(async player => {
        const newRank = playerRanks.get(player.user.id) || 0;
        console.log(`플레이어 ${player.user.name}의 순위 업데이트: ${player.rank} -> ${newRank}등`);
        
        // rank 값만 변경하고 저장
        if (player.rank !== newRank) {
          player.rank = newRank;
          await this.playerInGroupRepository.save(player);
        }
      }));
      
      console.log(`그룹 ${groupId} 순위 재계산 완료`);
    } catch (error) {
      console.error(`그룹 ${groupId} 순위 재계산 중 오류 발생:`, error);
    }
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
          playerIds.map(async (playerId, playerIndex) => {
            const user = await this.userRepository.findOne({
              where: { id: playerId },
            });
            
            if (!user) {
              throw new BadRequestException(`사용자 ID ${playerId}를 찾을 수 없습니다.`);
            }

            const playerInGroup = new PlayerInGroup();
            playerInGroup.group = savedGroup;
            playerInGroup.user = user;
            playerInGroup.orderNumber = playerIndex + 1;
            
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

    // 업데이트된 스테이지 조회 반환
    const updatedStage = await this.stageRepository.findOne({
      where: { id },
      relations: ['groups', 'groups.players', 'groups.players.user'],
    });

    if (!updatedStage) {
      throw new NotFoundException('스테이지를 찾을 수 없습니다.');
    }

    return updatedStage;
  }

  async removeStage(id: number): Promise<void> {
    const stage = await this.getStage(id);
    
    // 스테이지의 모든 매치의 next_match_id를 null로 설정
    const query = `
      UPDATE match 
      SET next_match_id = NULL 
      WHERE stage_id = ?
    `;
    await this.matchRepository.query(query, [id]);
    
    // 이제 스테이지 삭제
    await this.stageRepository.remove(stage);
  }
} 