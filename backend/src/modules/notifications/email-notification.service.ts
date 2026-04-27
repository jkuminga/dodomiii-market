import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import nodemailer from 'nodemailer';

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

@Injectable()
export class EmailNotificationService {
  private readonly logger = new Logger(EmailNotificationService.name);
  private transporter?: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {}

  isEnabled(): boolean {
    if (this.isDryRun()) {
      return true;
    }

    return Boolean(
      this.configService.get<string>('SMTP_HOST') &&
        this.configService.get<number>('SMTP_PORT') &&
        this.resolveFromAddress(),
    );
  }

  async send(message: EmailMessage): Promise<void> {
    if (this.isDryRun()) {
      this.logger.log(`dry-run email to=${message.to} subject="${message.subject}"`);
      return;
    }

    const transporter = this.getTransporter();
    const from = this.resolveFromAddress();

    if (!transporter || !from) {
      throw new Error('SMTP transport is not configured.');
    }

    await transporter.sendMail({
      from,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }

  private getTransporter(): nodemailer.Transporter | null {
    if (this.transporter) {
      return this.transporter;
    }

    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT');

    if (!host || !port) {
      return null;
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure: this.configService.get<boolean>('SMTP_SECURE', false),
      auth: this.configService.get<string>('SMTP_USER')
        ? {
            user: this.configService.get<string>('SMTP_USER'),
            pass: this.configService.get<string>('SMTP_PASS'),
          }
        : undefined,
      connectionTimeout: this.configService.get<number>('SMTP_CONNECTION_TIMEOUT_MS', 10000),
    });

    return this.transporter;
  }

  private resolveFromAddress(): string | null {
    const email = this.configService.get<string>('SMTP_FROM_EMAIL');
    if (!email) {
      return null;
    }

    const name = this.configService.get<string>('SMTP_FROM_NAME');

    return name ? `"${name}" <${email}>` : email;
  }

  private isDryRun(): boolean {
    return this.configService.get<boolean>('NOTIFICATIONS_DRY_RUN', false);
  }
}
