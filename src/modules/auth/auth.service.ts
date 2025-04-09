import { Injectable, UnauthorizedException, ConflictException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../entities/user.entity';
import { RegisterDto, LoginDto, TokenResponseDto } from './dto/auth.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const { userId, email, name, password, ...rest } = registerDto;

    // 중복 검사
    const existingUser = await this.userRepository.findOne({
      where: [
        { userId },
        { email },
        { name }
      ]
    });

    if (existingUser) {
      if (existingUser.userId === userId) {
        throw new ConflictException('이미 사용 중인 아이디입니다.');
      }
      if (existingUser.email === email) {
        throw new ConflictException('이미 사용 중인 이메일입니다.');
      }
      if (existingUser.name === name) {
        throw new ConflictException('이미 사용 중인 이름입니다.');
      }
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const user = this.userRepository.create({
      userId,
      email,
      name,
      password: hashedPassword,
      ...rest
    });

    return this.userRepository.save(user);
  }

  async login(loginDto: LoginDto): Promise<TokenResponseDto> {
    const { userId, password } = loginDto;
    const user = await this.userRepository.findOne({ where: { userId } });

    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('비밀번호가 일치하지 않습니다.');
    }

    const payload = { sub: user.id, userId: user.userId };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async validateUser(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('유효하지 않은 사용자입니다.');
    }
    return user;
  }

  async getProfile(userId: number): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new UnauthorizedException('사용자를 찾을 수 없습니다.');
    }
    return user;
  }
} 