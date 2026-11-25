import { Injectable, Logger } from '@nestjs/common';
import { createTransport, type Transporter } from 'nodemailer';

export type MailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

// Sends transactional email over SMTP (for example Gmail with an App Password).
// When SMTP is not configured the message is not sent: outside production the
// content is logged so the flow can still be exercised locally.
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private transporter: Transporter | null | undefined;

  configured() {
    return Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
    );
  }

  private transport() {
    if (this.transporter !== undefined) return this.transporter;
    if (!this.configured()) return (this.transporter = null);
    const port = Number(process.env.SMTP_PORT ?? 465);
    this.transporter = createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    return this.transporter;
  }

  // Returns true when the message was handed to the SMTP server. Failures are
  // logged instead of thrown so callers never reveal delivery details.
  async send(message: MailMessage): Promise<boolean> {
    const transport = this.transport();
    if (!transport) {
      if (process.env.NODE_ENV === 'production')
        this.logger.warn(
          `SMTP is not configured; "${message.subject}" was not sent`,
        );
      else
        this.logger.log(
          `SMTP is not configured; development copy of "${message.subject}" for ${message.to}:\n${message.text}`,
        );
      return false;
    }
    try {
      await transport.sendMail({
        from: process.env.MAIL_FROM || process.env.SMTP_USER,
        ...message,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send "${message.subject}": ${error instanceof Error ? error.message : String(error)}`,
      );
      return false;
    }
  }
}
