import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AdminNoticeIdParamDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  noticeId!: number;
}
