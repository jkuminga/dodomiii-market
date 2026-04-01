import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SolapiMessageService } from 'solapi';

type SmsMessage = {
  to: string;
  message: string;
};

@Injectable()
export class SmsNotificationService {
  private readonly logger = new Logger(SmsNotificationService.name);
  private messageService: SolapiMessageService | null = null;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    if (this.isDryRun()) {
      return true;
    }

    return Boolean(
      this.configService.get<string>('SOLAPI_API_KEY') &&
        this.configService.get<string>('SOLAPI_API_SECRET') &&
        this.configService.get<string>('SOLAPI_SENDER'),
    );
  }

  async send(payload: SmsMessage): Promise<void> {
    if (this.isDryRun()) {
      this.logger.log(`dry-run sms to=${payload.to} message="${payload.message}"`);
      return;
    }

    const sender = this.configService.get<string>('SOLAPI_SENDER');
    if (!sender) {
      throw new Error('SOLAPI_SENDER is not configured.');
    }

    const messageService = this.getMessageService();
    await messageService.send({
      to: payload.to,
      from: sender,
      text: payload.message,
    });
  }

  private getMessageService(): SolapiMessageService {
    if (this.messageService) {
      return this.messageService;
    }

    const apiKey = this.configService.get<string>('SOLAPI_API_KEY');
    const apiSecret = this.configService.get<string>('SOLAPI_API_SECRET');

    if (!apiKey || !apiSecret) {
      throw new Error('SOLAPI_API_KEY or SOLAPI_API_SECRET is not configured.');
    }

    this.messageService = new SolapiMessageService(apiKey, apiSecret);

    return this.messageService;
  }

  private isDryRun(): boolean {
    return this.configService.get<boolean>('NOTIFICATIONS_DRY_RUN', false);
  }
}
