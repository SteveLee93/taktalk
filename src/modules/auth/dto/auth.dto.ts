import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ description: '로그인 아이디' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: '이메일' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ description: '이름' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ description: '비밀번호' })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({ description: '전화번호', required: false })
  @IsString()
  @IsOptional()
  phone?: string;
}

export class LoginDto {
  @ApiProperty({ description: '로그인 아이디' })
  @IsString()
  @IsNotEmpty()
  userId: string;

  @ApiProperty({ description: '비밀번호' })
  @IsString()
  @IsNotEmpty()
  password: string;
}

export class TokenResponseDto {
  @ApiProperty({ description: '액세스 토큰' })
  access_token: string;
} 