import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { ValidateQrDto } from './dto/validate-qr.dto';
import { QrService } from './qr.service';

@ApiTags('qr')
@ApiBearerAuth()
@Roles(UserRole.ADMIN)
@UseGuards(RolesGuard)
@Controller('qr')
export class QrController {
  constructor(private readonly qrService: QrService) {}

  @Post('validate')
  @ApiOperation({ summary: 'Validate scanned ticket code' })
  validate(
    @CurrentUser() admin: Express.UserPayload,
    @Body() dto: ValidateQrDto,
  ) {
    return this.qrService.validate(admin.userId, dto.code.trim());
  }
}
