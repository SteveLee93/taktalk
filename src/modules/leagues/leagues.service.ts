import { Injectable, NotFoundException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { League } from '../../entities/league.entity';
import { User } from '../../entities/user.entity';
import { LeagueOperator } from '../../entities/league-operator.entity';
import { LeagueParticipant } from '../../entities/league-participant.entity';
import { CreateLeagueDto, AddOperatorDto, UpdateParticipantStatusDto } from './dto/league.dto';
import { ParticipantStatus } from '../../entities/league-participant.entity';

@Injectable()
export class LeaguesService {
  constructor(
    @InjectRepository(League)
    private leagueRepository: Repository<League>,
    @InjectRepository(User)
    private userRepository: Repository<User>,
    @InjectRepository(LeagueOperator)
    private operatorRepository: Repository<LeagueOperator>,
    @InjectRepository(LeagueParticipant)
    private participantRepository: Repository<LeagueParticipant>,
  ) {}

  async createLeague(createLeagueDto: CreateLeagueDto, userId: number): Promise<League> {
    const league = this.leagueRepository.create(createLeagueDto);
    const savedLeague = await this.leagueRepository.save(league);

    // 리그 생성자를 운영자로 추가
    const operator = this.operatorRepository.create({
      league: savedLeague,
      user: { id: userId },
    });
    await this.operatorRepository.save(operator);

    return savedLeague;
  }

  async addOperator(leagueId: number, addOperatorDto: AddOperatorDto, userId: number): Promise<void> {
    const league = await this.leagueRepository.findOne({
      where: { id: leagueId },
      relations: ['operators'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    // 현재 사용자가 운영자인지 확인
    const isOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });

    if (!isOperator) {
      throw new UnauthorizedException('리그 운영자만 다른 운영자를 추가할 수 있습니다.');
    }

    // 닉네임으로 사용자 찾기
    const newOperator = await this.userRepository.findOne({
      where: { nickname: addOperatorDto.nickname },
    });

    if (!newOperator) {
      throw new NotFoundException('해당 닉네임의 사용자를 찾을 수 없습니다.');
    }

    // 이미 운영자인지 확인
    const existingOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: newOperator.id } },
    });

    if (existingOperator) {
      throw new ConflictException('이미 운영자로 등록된 사용자입니다.');
    }

    // 새 운영자 추가
    const operator = this.operatorRepository.create({
      league,
      user: newOperator,
    });
    await this.operatorRepository.save(operator);
  }

  async participateLeague(leagueId: number, userId: number): Promise<void> {
    const league = await this.leagueRepository.findOne({
      where: { id: leagueId },
      relations: ['participants'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    // 이미 참가 신청했는지 확인
    const existingParticipant = await this.participantRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });

    if (existingParticipant) {
      throw new ConflictException('이미 참가 신청한 리그입니다.');
    }

    // 참가자 수 확인
    const participantCount = await this.participantRepository.count({
      where: { league: { id: leagueId }, status: ParticipantStatus.APPROVED },
    });

    if (participantCount >= league.maxPlayers) {
      throw new ConflictException('최대 참가자 수를 초과했습니다.');
    }

    // 참가 신청
    const participant = this.participantRepository.create({
      league,
      user: { id: userId },
      status: ParticipantStatus.PENDING,
    });
    await this.participantRepository.save(participant);
  }

  async updateParticipantStatus(
    leagueId: number,
    participantId: number,
    dto: UpdateParticipantStatusDto,
    userId: number,
  ): Promise<void> {
    // 운영자 권한 확인
    const isOperator = await this.operatorRepository.findOne({
      where: { league: { id: leagueId }, user: { id: userId } },
    });

    if (!isOperator) {
      throw new UnauthorizedException('리그 운영자만 참가 상태를 변경할 수 있습니다.');
    }

    const participant = await this.participantRepository.findOne({
      where: { id: participantId, league: { id: leagueId } },
    });

    if (!participant) {
      throw new NotFoundException('참가 신청 정보를 찾을 수 없습니다.');
    }

    // 상태 변경
    participant.status = dto.status;
    await this.participantRepository.save(participant);
  }

  async getLeague(id: number): Promise<League> {
    const league = await this.leagueRepository.findOne({
      where: { id },
      relations: ['operators', 'participants'],
    });

    if (!league) {
      throw new NotFoundException('리그를 찾을 수 없습니다.');
    }

    return league;
  }

  async getLeagues(): Promise<League[]> {
    return this.leagueRepository.find({
      relations: ['operators', 'participants'],
    });
  }
} 