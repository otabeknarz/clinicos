import { IsDateString, IsIn } from 'class-validator'

export class RangeDto {
  @IsDateString() from!: string
  @IsDateString() to!: string
}

export class RevenuePeriodDto {
  @IsIn(['today', 'week', 'month'])
  period!: 'today' | 'week' | 'month'
}
