import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

export interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text: string;
}

@Injectable()
export class EmailService implements OnModuleInit {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private fromAddress = '';
  private smtpUser = '';

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async onModuleInit(): Promise<void> {
    const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER?.trim();
    // Gmail App Passwords are often pasted with spaces — strip them
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, '') || '';

    if (!user || !pass) {
      this.logger.warn(
        'SMTP is not fully configured (SMTP_USER, SMTP_PASS required). Password reset emails will not be sent.',
      );
      return;
    }

    this.smtpUser = user;
    this.fromAddress = `"Lodgely Support" <${user}>`;
    const secure = port === 465;
    const isGmail = host.includes('gmail.com');

    this.transporter = nodemailer.createTransport(
      isGmail
        ? {
            service: 'gmail',
            auth: { user, pass },
          }
        : {
            host,
            port,
            secure,
            auth: { user, pass },
            ...(secure
              ? {}
              : {
                  requireTLS: true,
                  tls: { minVersion: 'TLSv1.2' },
                }),
          },
    );

    try {
      await this.transporter.verify();
      this.logger.log(`SMTP connection verified (${isGmail ? 'gmail' : `${host}:${port}`})`);
    } catch (error) {
      this.logger.error(
        `SMTP verification failed: ${error instanceof Error ? error.message : error}`,
      );
      this.logger.error(
        'Use a Gmail App Password (not your normal Gmail password). Password reset emails will fail until this is fixed.',
      );
    }
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    if (!this.transporter) {
      this.logger.error('Cannot send email: SMTP is not configured');
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.fromAddress,
        replyTo: this.smtpUser,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
        headers: {
          'X-Mailer': 'Lodgely',
          'X-Priority': '1',
        },
      });
      this.logger.log(
        `Email sent to ${options.to} (messageId: ${info.messageId}, response: ${info.response})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${error instanceof Error ? error.message : error}`,
      );
      return false;
    }
  }
}
