import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AdminAccountIdParamDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  adminId!: number;
}
