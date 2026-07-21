import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class HomePopupIdParamDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  popupId!: number;
}
