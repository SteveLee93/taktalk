import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notice } from '../../entities/notice.entity';
import { CreateNoticeDto } from './dto/create-notice.dto';
import { UpdateNoticeDto } from './dto/update-notice.dto';
import { GetNoticesDto } from './dto/get-notices.dto';

@Injectable()
export class NoticesService {
  constructor(
    @InjectRepository(Notice)
    private noticeRepository: Repository<Notice>,
  ) {}

  async create(createNoticeDto: CreateNoticeDto, userId?: number): Promise<Notice> {
    const notice = this.noticeRepository.create({
      ...createNoticeDto,
      author: userId ? { id: userId } : undefined,
      viewCount: 0,
    });
    return this.noticeRepository.save(notice);
  }

  async findAll(getNoticesDto: GetNoticesDto): Promise<[Notice[], number]> {
    const { search, isImportant, isActive, page = 1, limit = 10 } = getNoticesDto;
    
    const queryBuilder = this.noticeRepository.createQueryBuilder('notice')
      .leftJoinAndSelect('notice.author', 'author');
    
    if (search) {
      queryBuilder.andWhere('(notice.title LIKE :search OR notice.content LIKE :search)', 
        { search: `%${search}%` });
    }
    
    if (isImportant !== undefined) {
      queryBuilder.andWhere('notice.isImportant = :isImportant', { isImportant });
    }
    
    if (isActive !== undefined) {
      queryBuilder.andWhere('notice.isActive = :isActive', { isActive });
    }
    
    queryBuilder
      .orderBy('notice.isImportant', 'DESC')
      .addOrderBy('notice.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);
    
    return queryBuilder.getManyAndCount();
  }

  async findOne(id: number): Promise<Notice | null> {
    return this.noticeRepository.findOne({ 
      where: { id },
      relations: ['author']
    });
  }

  async update(id: number, updateNoticeDto: UpdateNoticeDto): Promise<Notice | null> {
    await this.noticeRepository.update(id, updateNoticeDto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.noticeRepository.delete(id);
  }

  async increaseViewCount(id: number): Promise<void> {
    await this.noticeRepository.increment({ id }, 'viewCount', 1);
  }
}
