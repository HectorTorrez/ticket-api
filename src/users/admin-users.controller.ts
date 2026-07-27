import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { AuthService } from '../auth/auth.service';
import { AdminResetPasswordDto } from '../auth/dto/admin-reset-password.dto';

@ApiTags('users-admin')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(RolesGuard)
@Controller('admin/users')
export class AdminUsersController {
  constructor(private readonly authService: AuthService) {}

  @Throttle({ default: { ttl: 60000, limit: 20 } })
  @Post('reset-password')
  @ApiOperation({
    summary: 'Reset a user password and return a temporary password (admin)',
  })
  resetPassword(@Body() dto: AdminResetPasswordDto) {
    return this.authService.adminResetPasswordByEmail(dto.email);
  }
}
