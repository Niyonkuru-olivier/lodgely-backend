import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as dns from 'dns';

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
  private smtpHost = 'smtp.gmail.com';
  private smtpPort = 587;

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async onModuleInit(): Promise<void> {
    // Prefer IPv4; ENOTFOUND / broken IPv6 is common on Windows + VPN
    try {
      dns.setDefaultResultOrder('ipv4first');
    } catch {
      // Node < 17 may not support this — ignore
    }
    await this.initTransporter();
  }

  private getSmtpCredentials(): { user: string; pass: string } | null {
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.replace(/\s+/g, '') || '';
    if (!user || !pass) return null;
    return { user, pass };
  }

  private explainSmtpError(error: unknown): string {
    const message = error instanceof Error ? error.message : String(error);

    if (message.includes('ENOTFOUND') || message.includes('EAI_AGAIN')) {
      return (
        `DNS cannot resolve ${this.smtpHost}. Check internet / VPN / DNS (try Google DNS 8.8.8.8). ` +
        `This is a network issue, not an App Password issue.`
      );
    }
    if (message.includes('ETIMEDOUT') || message.includes('ECONNREFUSED') || message.includes('ESOCKET')) {
      return (
        `Cannot reach ${this.smtpHost}:${this.smtpPort}. Firewall or network may block outbound SMTP.`
      );
    }
    if (
      message.includes('Invalid login') ||
      message.includes('EAUTH') ||
      message.includes('Username and Password not accepted')
    ) {
      return (
        'Gmail rejected login. Use a Gmail App Password in SMTP_PASS (Google Account → Security → App passwords).'
      );
    }
    return message;
  }

  private ipv4Lookup(
    hostname: string,
    _options: unknown,
    callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
  ): void {
    dns.lookup(hostname, { family: 4 }, (err, address, family) => {
      if (!err) {
        callback(null, address, family);
        return;
      }
      // Fallback to any family if IPv4 fails
      dns.lookup(hostname, callback);
    });
  }

  private async initTransporter(): Promise<void> {
    const host = process.env.SMTP_HOST?.trim() || 'smtp.gmail.com';
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const creds = this.getSmtpCredentials();

    this.smtpHost = host;
    this.smtpPort = port;

    if (!creds) {
      this.logger.warn(
        'SMTP is not fully configured (SMTP_USER, SMTP_PASS required). Password reset emails will not be sent.',
      );
      this.transporter = null;
      this.verified = false;
      return;
    }

    this.smtpUser = creds.user;
    this.fromAddress = `"Lodgely Support" <${creds.user}>`;
    const secure = port === 465;

    const transportOptions: nodemailer.TransportOptions = {
      host,
      port,
      secure,
      auth: { user: creds.user, pass: creds.pass },
      // Force IPv4 DNS lookup to avoid ENOTFOUND / IPv6 failures
      lookup: this.ipv4Lookup.bind(this),
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 25000,
      ...(secure
        ? {}
        : {
            requireTLS: true,
            tls: {
              minVersion: 'TLSv1.2' as const,
              rejectUnauthorized: true,
              servername: host,
            },
          }),
    } as nodemailer.TransportOptions;

    this.transporter = nodemailer.createTransport(transportOptions);

    try {
      await this.transporter.verify();
      this.verified = true;
      this.logger.log(`SMTP connection verified (${host}:${port} as ${creds.user})`);
    } catch (error) {
      this.verified = false;
      this.logger.error(`SMTP verification failed: ${this.explainSmtpError(error)}`);
      this.logger.warn(
        'App will keep running and retry SMTP when a password-reset email is sent.',
      );
      // Keep transporter for on-demand send attempts
    }
  }

  async sendMail(options: SendMailOptions): Promise<boolean> {
    if (!this.transporter || !this.verified) {
      this.logger.warn('SMTP not verified — re-initializing before send...');
      await this.initTransporter();
    }

    if (!this.transporter) {
      this.logger.error('Cannot send email: SMTP is unavailable');
      return false;
    }

    const attempt = async () =>
      this.transporter!.sendMail({
        from: this.fromAddress,
        replyTo: this.smtpUser,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

    try {
      const info = await attempt();
      this.verified = true;
      this.logger.log(
        `Email sent to ${options.to} (messageId: ${info.messageId}, response: ${info.response})`,
      );
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email to ${options.to}: ${this.explainSmtpError(error)}`,
      );

      await this.initTransporter();
      if (!this.transporter) return false;

      try {
        const info = await attempt();
        this.verified = true;
        this.logger.log(
          `Email sent to ${options.to} after retry (messageId: ${info.messageId})`,
        );
        return true;
      } catch (retryError) {
        this.logger.error(`Retry also failed: ${this.explainSmtpError(retryError)}`);
        return false;
      }
    }
  }
}
