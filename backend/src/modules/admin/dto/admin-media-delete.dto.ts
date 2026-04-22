import { IsString, MaxLength } from 'class-validator';

export class AdminMediaDeleteDto {
  @IsString()
  @MaxLength(500)
  publicId!: string;
}
