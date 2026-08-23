import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../generated/prisma/enums';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthService } from '../auth/auth.service';
import { AdminResetPasswordDto } from '../auth/dto/admin-reset-password.dto';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateUserStatusDto } from './dto/update-user-status.dto';
import { UsersService } from './users.service';

@ApiTags('users-admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List users (admin; excludes soft-deleted)' })
  list(@Query() query: QueryAdminUsersDto) {
    return this.usersService.listForAdmin(query);
  }

  @Throttle({ default: { ttl: 60000, limit: 10 } })
  @Post()
  @ApiOperation({
    summary: 'Create an admin account and return a temporary password',
  })
  createAdmin(@Body() dto: CreateAdminUserDto) {
    return this.authService.adminCreateAdmin(dto.email);
  }

  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset a user password by email and return a temporary password',
  })
  resetPasswordByEmail(@Body() dto: AdminResetPasswordDto) {
    return this.authService.adminResetPasswordByEmail(dto.email);
  }

  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post(':id/reset-password')
  @ApiOperation({
    summary: 'Reset a user password by id and return a temporary password',
  })
  resetPasswordById(@Param('id', ParseUUIDPipe) id: string) {
    return this.authService.adminResetPasswordById(id);
  }

  @Patch(':id/status')
  @ApiOperation({
    summary: 'Set user account status (active, suspended, banned)',
  })
  setStatus(
    @CurrentUser() actor: Express.UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.usersService.setStatus(actor.userId, id, dto.status);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft-delete a user and revoke their sessions' })
  remove(
    @CurrentUser() actor: Express.UserPayload,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.usersService.softDelete(actor.userId, id);
  }
}
