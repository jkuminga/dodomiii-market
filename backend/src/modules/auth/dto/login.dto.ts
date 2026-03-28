import { IsString, Length } from 'class-validator';

export class LoginDto {
  @IsString()
  @Length(3, 100)
  loginId!: string;

  @IsString()
  @Length(8, 100)
  password!: string;
}
