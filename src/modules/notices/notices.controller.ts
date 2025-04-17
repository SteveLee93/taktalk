import { Controller, Get, Post, Body, Patch, Param, Delete, Query, UseGuards, Req, HttpCode, HttpStatus } from '@nestjs/common';
import { NoticesService } from './notices.service';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { GetNoticesDto } from './dto/get-notices.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../entities/user.entity';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('notices')
@Controller('notices')
export class NoticesController {
  constructor(private readonly noticesService: NoticesService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '공지사항 생성' })
  @ApiResponse({ status: 201, description: '공지사항이 성공적으로 생성됨' })
  create(@Body() createNoticeDto: CreateNoticeDto, @Req() req) {
    const userId = req.user?.id;
    return this.noticesService.create(createNoticeDto, userId);
  }

  @Get()
  @ApiOperation({ summary: '공지사항 목록 조회' })
  @ApiResponse({ status: 200, description: '공지사항 목록 반환' })
  findAll(@Query() getNoticesDto: GetNoticesDto) {
    return this.noticesService.findAll(getNoticesDto);
  }

  @Get(':id')
  @ApiOperation({ summary: '공지사항 상세 조회' })
  @ApiResponse({ status: 200, description: '공지사항 상세 정보 반환' })
  async findOne(@Param('id') id: string) {
    const notice = await this.noticesService.findOne(+id);
    await this.noticesService.increaseViewCount(+id);
    return notice;
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '공지사항 수정' })
  @ApiResponse({ status: 200, description: '공지사항이 성공적으로 수정됨' })
  update(@Param('id') id: string, @Body() updateNoticeDto: UpdateNoticeDto) {
    return this.noticesService.update(+id, updateNoticeDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiOperation({ summary: '공지사항 삭제' })
  @ApiResponse({ status: 204, description: '공지사항이 성공적으로 삭제됨' })
  remove(@Param('id') id: string) {
    return this.noticesService.remove(+id);
  }
}
