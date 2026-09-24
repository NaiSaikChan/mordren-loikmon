import nodemailer, { type Transporter } from 'nodemailer'
import type { AppConfig } from '../config/env.js'
import type { Logger } from './logger.js'

export interface MailMessage {
  to: string
  subject: string
  text: string
  html?: string
}

export interface Mailer {
  send(message: MailMessage): Promise<void>
}

/**
 * SMTP mailer (Hostinger mail, or any SMTP relay). Without SMTP settings the
 * message is written to the log instead, which keeps sign-up and password
 * reset usable in development.
 */
export function createMailer(config: AppConfig, logger: Logger): Mailer {
  const smtp = config.mail.smtp
  if (!smtp) {
    return {
      async send(message) {
        const level = config.isProduction ? 'warn' : 'info'
        logger[level]({ to: message.to, subject: message.subject, text: message.text }, 'SMTP not configured — email not sent')
      },
    }
  }

  const transporter: Transporter = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.user ? { user: smtp.user, pass: smtp.password } : undefined,
  })

  return {
    async send(message) {
      try {
        await transporter.sendMail({ from: config.mail.from, ...message })
        logger.info({ to: message.to, subject: message.subject }, 'email sent')
      } catch (err) {
        // Email failures must not break the auth flow that triggered them.
        logger.error({ err, to: message.to, subject: message.subject }, 'email delivery failed')
      }
    },
  }
}

export const emailTemplates = {
  verifyEmail(url: string): Pick<MailMessage, 'subject' | 'text' | 'html'> {
    return {
      subject: 'Verify your Loikmon email',
      text: `Welcome to Loikmon!\n\nConfirm your email address by opening this link:\n${url}\n\nIf you did not create an account you can ignore this email.`,
      html: layout(
        'Verify your email',
        `<p>Welcome to Loikmon!</p><p>Confirm your email address to finish setting up your account.</p>${button(url, 'Verify email')}`,
      ),
    }
  },
  resetPassword(url: string): Pick<MailMessage, 'subject' | 'text' | 'html'> {
    return {
      subject: 'Reset your Loikmon password',
      text: `We received a request to reset your password.\n\nChoose a new password here (valid for 1 hour):\n${url}\n\nIf you did not ask for this, you can ignore this email.`,
      html: layout(
        'Reset your password',
        `<p>We received a request to reset your password. The link is valid for 1 hour.</p>${button(url, 'Choose a new password')}<p>If you did not ask for this, you can ignore this email.</p>`,
      ),
    }
  },
  /** Staff reply on a support ticket, sent to the reporter. */
  ticketReply(reference: string, subject: string, message: string): Pick<MailMessage, 'subject' | 'text' | 'html'> {
    return {
      subject: `[${reference}] ${subject}`,
      text: `Our team replied to your message:\n\n${message}\n\nReply to this email to continue the conversation.\n\nReference: ${reference}`,
      html: layout(
        subject,
        `<p>Our team replied to your message:</p><blockquote style="margin:0;padding:12px 16px;border-left:3px solid #b8860b;background:#faf7f0;white-space:pre-wrap">${escapeHtml(
          message,
        )}</blockquote><p style="font-size:12px;color:#888">Reference: ${escapeHtml(reference)}</p>`,
      ),
    }
  },
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
}

function button(url: string, label: string): string {
  return `<p><a href="${escapeHtml(url)}" style="display:inline-block;padding:10px 18px;background:#b8860b;color:#fff;border-radius:6px;text-decoration:none">${escapeHtml(label)}</a></p><p style="font-size:12px;color:#666">${escapeHtml(url)}</p>`
}

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#222;max-width:560px;margin:auto;padding:24px"><h2>${escapeHtml(title)}</h2>${body}<hr><p style="font-size:12px;color:#888">Loikmon · loikmon.org</p></body></html>`
}
