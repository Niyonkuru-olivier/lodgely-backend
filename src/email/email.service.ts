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
  private verified = false;

  isConfigured(): boolean {
    return this.transporter !== null && this.verified;
  }

  async onModuleInit(): Promise<void> {
    await this.initTransporter();
  }

  private async initTransporter(): Promise<void> {
    const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, '') || '';

    if (!user || !pass) {
      this.logger.warn(
        'SMTP is not fully configured (SMTP_USER, SMTP_PASS required). Password reset emails will not be sent.',
      );
      this.transporter = null;
      this.verified = false;
      return;
    }

    this.smtpUser = user;
    this.fromAddress = `"Lodgely Support" <${user}>`;
    const secure = port === 465;

    // Explicit host/port is more reliable than service: 'gmail' on some hosts (e.g. Render)
    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      ...(secure
        ? {}
        : {
            requireTLS: true,
            tls: {
              minVersion: 'TLSv1.2',
              rejectUnauthorized: true,
            },
          }),
    });

    try {
      await this.transporter.verify();
      this.verified = true;
      this.logger.log(`SMTP connection verified (${host}:${port} as ${user})`);
    } catch (error) {
      this.verified = false;
      this.transporter = null;
      this.logger.error(
        `SMTP verification failed: ${error instanceof Error ? error.message : error}`,
      );
      this.logger.error(
        'Fix: use a Gmail App Password in SMTP_PASS (Google Account → Security → App passwords). Do not use your normal Gmail password.',
      );
    }
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    if (!this.isConfigured()) {
      this.logger.error('Cannot send email: SMTP is not configured or failed verification');
      // Try one reconnect in case credentials were fixed without restart
      await this.initTransporter();
      if (!this.isConfigured()) {
        return false;
      }
    }

    try {
      const info = await this.transporter!.sendMail({
        from: this.fromAddress,
        replyTo: this.smtpUser,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
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
