import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { UserRole, UserStatus } from '../../generated/prisma/enums';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { SortOrder } from '../../common/dto/sort-query.dto';
import { V } from '../../common/validation-messages';

export enum AdminUserSortField {
  email = 'email',
  role = 'role',
  status = 'status',
  createdAt = 'createdAt',
  orderCount = 'orderCount',
}

export class QueryAdminUsersDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    enum: AdminUserSortField,
    default: AdminUserSortField.createdAt,
  })
  @IsOptional()
  @IsEnum(AdminUserSortField, { message: V.enum })
  sortBy?: AdminUserSortField = AdminUserSortField.createdAt;

  @ApiPropertyOptional({ enum: SortOrder, default: SortOrder.desc })
  @IsOptional()
  @IsEnum(SortOrder, { message: V.enum })
  sortOrder?: SortOrder = SortOrder.desc;

  @ApiPropertyOptional({ enum: UserRole })
  @IsOptional()
  @IsEnum(UserRole, { message: V.enum })
  role?: UserRole;

  @ApiPropertyOptional({ enum: UserStatus })
  @IsOptional()
  @IsEnum(UserStatus, { message: V.enum })
  status?: UserStatus;

  @ApiPropertyOptional({ description: 'Search email' })
  @IsOptional()
  @IsString({ message: V.string })
  @MaxLength(120, { message: V.maxLength(120) })
  q?: string;
}
