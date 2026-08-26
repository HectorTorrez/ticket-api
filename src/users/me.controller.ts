import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UsersService } from './users.service';

@ApiTags('me')
@ApiBearerAuth()
@Controller()
export class MeController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated user profile' })
  getProfile(@CurrentUser() user: Express.UserPayload) {
    return this.usersService.getProfile(user.userId);
  }
}
