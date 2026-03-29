import { Transform } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class AdminCustomOrderLinkIdParamDto {
  @Transform(({ value }) => Number(value))
  @IsInt()
  @Min(1)
  linkId!: number;
}
