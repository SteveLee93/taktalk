import { Controller, Get, Param, Put, Body, Post } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Match } from '../../entities/match.entity';
import { MatchService } from '../stages/match.service';
import { UpdateMatchResultDto, MatchResponseDto } from './dto/match.dto';
import { StagesService } from '../stages/stages.service';

@ApiTags('matches')
@Controller('matches')
export class MatchController {
  constructor(
    private readonly matchService: MatchService,
    private readonly stagesService: StagesService,
  ) {}

  @Get('stage/:stageId')
  @ApiOperation({ summary: '스테이지의 모든 매치 조회' })
  @ApiResponse({ status: 200, description: '매치 목록', type: [MatchResponseDto] })
  async getMatchesByStage(@Param('stageId') stageId: number): Promise<MatchResponseDto[]> {
    const matches = await this.matchService.getMatchesByStage(stageId);
    return matches.map(match => this.toMatchResponse(match));
  }

  @Get(':id')
  @ApiOperation({ summary: '매치 조회' })
  @ApiResponse({ status: 200, description: '매치 정보', type: MatchResponseDto })
  async getMatch(@Param('id') id: number): Promise<MatchResponseDto> {
    const match = await this.matchService.getMatch(id);
    return this.toMatchResponse(match);
  }

  @Put(':id/result')
  @ApiOperation({ summary: '매치 결과 업데이트' })
  @ApiResponse({ status: 200, description: '업데이트된 매치 정보', type: MatchResponseDto })
  async updateMatchResult(
    @Param('id') id: number,
    @Body() updateMatchResultDto: UpdateMatchResultDto,
  ): Promise<MatchResponseDto> {
    await this.stagesService.updateMatchResult(id, updateMatchResultDto);
    const match = await this.matchService.getMatch(id);
    return this.toMatchResponse(match);
  }

  @Post('reset-next-match/:stageId')
  @ApiOperation({ summary: '스테이지의 모든 매치의 next_match_id를 null로 설정' })
  async resetNextMatch(@Param('stageId') stageId: number): Promise<void> {
    return this.matchService.resetNextMatch(stageId);
  }

  private toMatchResponse(match: Match): MatchResponseDto {
    return {
      id: match.id,
      groupNumber: match.groupNumber,
      description: match.description,
      order: match.order,
      round: match.round,
      player1Id: match.player1?.id,
      player2Id: match.player2?.id,
      player1Origin: match.player1Origin,
      player2Origin: match.player2Origin,
      status: match.status,
      nextMatchId: match.nextMatch?.id,
      nextMatchPosition: match.nextMatchPosition,
      scoreDetails: match.result?.scoreDetails.sets,
      winnerId: match.result?.winner?.id
    };
  }
} 