import { Controller, Post, Body, Param, UseGuards, Request, Put, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { LeaguesService } from './leagues.service';
import { CreateLeagueDto, AddOperatorDto, UpdateParticipantStatusDto, ParticipateLeagueDto, SearchLeagueDto } from './dto/league.dto';
import { League } from '../../entities/league.entity';

@ApiTags('리그')
@Controller('leagues')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
export class LeaguesController {
  constructor(private readonly leaguesService: LeaguesService) {}

  @Post()
  @ApiOperation({ summary: '리그 생성' })
  @ApiResponse({ 
    status: 201, 
    description: '리그 생성 성공',
    type: League 
  })
  async createLeague(
    @Body() createLeagueDto: CreateLeagueDto,
    @Request() req,
  ): Promise<League> {
    return this.leaguesService.createLeague(createLeagueDto, req.user.id);
  }

  @Post(':id/operators')
  @ApiOperation({ summary: '리그 운영자 추가' })
  @ApiResponse({ status: 201, description: '운영자 추가 성공' })
  async addOperator(
    @Param('id') id: number,
    @Body() addOperatorDto: AddOperatorDto,
    @Request() req,
  ): Promise<void> {
    return this.leaguesService.addOperator(id, addOperatorDto, req.user.id);
  }

  @Post(':id/participate')
  @ApiOperation({ summary: '리그 참가 신청' })
  @ApiResponse({ status: 201, description: '참가 신청 성공' })
  async participateLeague(
    @Param('id') id: number,
    @Request() req,
    @Body() dto: ParticipateLeagueDto,
  ) {
    return this.leaguesService.participateLeague(id, req.user.id, dto);
  }

  @Put(':id/participants/:participantId')
  @ApiOperation({ summary: '참가 신청 상태 변경' })
  @ApiResponse({ status: 200, description: '상태 변경 성공' })
  async updateParticipantStatus(
    @Param('id') id: number,
    @Param('participantId') participantId: number,
    @Body() updateParticipantStatusDto: UpdateParticipantStatusDto,
    @Request() req,
  ): Promise<void> {
    return this.leaguesService.updateParticipantStatus(
      id,
      participantId,
      updateParticipantStatusDto,
      req.user.id,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: '리그 상세 정보 조회' })
  @ApiResponse({ 
    status: 200, 
    description: '리그 정보 조회 성공',
    type: League 
  })
  async getLeague(@Param('id') id: number): Promise<League> {
    return this.leaguesService.getLeague(id);
  }

  @Get()
  @ApiOperation({ summary: '리그 목록 조회' })
  @ApiResponse({ 
    status: 200, 
    description: '리그 목록 조회 성공',
    type: [League] 
  })
  async getLeagues(): Promise<League[]> {
    return this.leaguesService.getLeagues();
  }

  @Get('search')
  @ApiOperation({ summary: '리그 검색' })
  @ApiResponse({
    status: 200,
    description: '검색 조건에 맞는 리그 목록',
    type: [League],
  })
  async searchLeagues(@Query() searchDto: SearchLeagueDto): Promise<League[]> {
    return this.leaguesService.searchLeagues(searchDto);
  }
} 