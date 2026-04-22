import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateAdminHomeHeroDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  imageUrl!: string;
}
