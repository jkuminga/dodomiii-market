import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class NoticeIdParamDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  noticeId!: number;
}
