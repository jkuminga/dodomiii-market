import { Body, Controller, Post, UseGuards } from '@nestjs/common';

import { AdminSessionGuard } from '../auth/guards/admin-session.guard';
import { AdminMediaService } from './admin-media.service';
import { AdminMediaFinalizeDto } from './dto/admin-media-finalize.dto';
import { AdminMediaSignUploadDto } from './dto/admin-media-sign-upload.dto';

@UseGuards(AdminSessionGuard)
@Controller('admin/media')
export class AdminMediaController {
  constructor(private readonly adminMediaService: AdminMediaService) {}

  @Post('sign-upload')
  signUpload(@Body() body: AdminMediaSignUploadDto) {
    const data = this.adminMediaService.createSignedUpload(body);

    return {
      success: true,
      data,
    };
  }

  @Post('finalize')
  finalizeUpload(@Body() body: AdminMediaFinalizeDto) {
    const data = this.adminMediaService.finalizeUpload(body);

    return {
      success: true,
      data,
    };
  }
}
