import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER || '',
        pass: process.env.GMAIL_APP_PASSWORD || '', // Google App Password (not regular password)
      },
    });
  }

  async sendEmail(to: string, subject: string, htmlBody: string): Promise<boolean> {
    try {
      if (!process.env.GMAIL_APP_PASSWORD || !process.env.GMAIL_USER) {
        console.log(`[Email Service] Skipping email (no credentials configured). To: ${to}, Subject: ${subject}`);
        return false;
      }

      await this.transporter.sendMail({
        from: `"CampaignHub" <${process.env.GMAIL_USER}>`,
        to,
        subject,
        html: this.wrapInTemplate(subject, htmlBody),
      });

      console.log(`[Email Service] Sent email to ${to}: ${subject}`);
      return true;
    } catch (err: any) {
      console.error('[Email Service] Failed:', err.message);
      return false;
    }
  }

  // === Pre-built Email Templates ===

  async sendWelcomeEmail(to: string, role: string) {
    return this.sendEmail(to, 'Welcome to CampaignHub!', `
      <h2>Welcome to CampaignHub! 🎉</h2>
      <p>Your <strong>${role}</strong> account has been created successfully.</p>
      <p>Your account is currently <strong>pending admin verification</strong>. We'll notify you once your KYC documents have been reviewed and approved.</p>
      <p>In the meantime, please connect your Telegram account for instant notifications.</p>
      <div style="text-align:center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="background:#6366f1; color:white; padding:12px 32px; border-radius:8px; text-decoration:none; font-weight:bold;">Go to Dashboard</a>
      </div>
    `);
  }

  async sendVerificationApproved(to: string) {
    return this.sendEmail(to, 'Account Verified! ✅', `
      <h2>Your Account is Verified! ✅</h2>
      <p>Great news! Your KYC verification has been approved by our admin team.</p>
      <p>You now have full access to all CampaignHub features. Start exploring campaigns, connecting with creators, and growing your brand.</p>
      <div style="text-align:center; margin: 30px 0;">
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/dashboard" style="background:#22c55e; color:white; padding:12px 32px; border-radius:8px; text-decoration:none; font-weight:bold;">Open Dashboard</a>
      </div>
    `);
  }

  async sendVerificationRejected(to: string) {
    return this.sendEmail(to, 'Verification Update', `
      <h2>Verification Update</h2>
      <p>Unfortunately, your KYC verification was not approved at this time.</p>
      <p>Please contact our support team for more information or to resubmit your documents.</p>
    `);
  }

  async sendPayoutApproved(to: string, amount: number, campaign: string) {
    return this.sendEmail(to, `Payout Approved - $${amount}`, `
      <h2>Payout Approved! 🔄</h2>
      <p>Your payout of <strong>$${amount.toLocaleString()}</strong> for "<em>${campaign}</em>" has been approved and is being processed.</p>
      <p>You'll receive another notification once the funds hit your bank account.</p>
    `);
  }

  async sendPayoutCompleted(to: string, amount: number, campaign: string) {
    return this.sendEmail(to, `Payment Received - $${amount}`, `
      <h2>Payment Received! 💰</h2>
      <p>Your payout of <strong>$${amount.toLocaleString()}</strong> for "<em>${campaign}</em>" has been successfully transferred to your bank account!</p>
      <p>Thank you for your amazing work on CampaignHub.</p>
    `);
  }

  async sendPayoutRejected(to: string, amount: number) {
    return this.sendEmail(to, 'Payout Update', `
      <h2>Payout Update</h2>
      <p>Unfortunately, your payout of <strong>$${amount.toLocaleString()}</strong> has been rejected.</p>
      <p>Please contact support for more details.</p>
    `);
  }

  async sendPaymentEscrowNotice(to: string, amount: number) {
    return this.sendEmail(to, `Escrow Locked - $${amount}`, `
      <h2>Funds Secured in Escrow 🔒</h2>
      <p>Your payout of <strong>$${amount.toLocaleString()}</strong> has been securely locked in escrow.</p>
      <p>An admin will review and process the transfer to your bank account shortly.</p>
    `);
  }

  async sendNewPayoutRequestToAdmin(adminEmail: string, userId: string, amount: number) {
    return this.sendEmail(adminEmail, `⚠️ ACTION: New Payout Request - $${amount}`, `
      <h2>New Payout Request ⚠️</h2>
      <p>A brand has deposited <strong>$${amount.toLocaleString()}</strong> and a creator payout is awaiting manual transfer.</p>
      <p><strong>User ID:</strong> ${userId}</p>
      <p>Please log into the Admin Dashboard and process the transfer via Flutterwave.</p>
      <div style="text-align:center; margin: 30px 0;">
        <a href="https://app.flutterwave.com/dashboard/payments/transfers/new/" style="background:#f97316; color:white; padding:12px 32px; border-radius:8px; text-decoration:none; font-weight:bold;">Open Flutterwave</a>
      </div>
    `);
  }

  // === HTML Email Template Wrapper ===
  private wrapInTemplate(title: string, body: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
    <body style="margin:0; padding:0; background:#f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
      <div style="max-width:600px; margin:0 auto; padding:40px 20px;">
        <div style="background:white; border-radius:16px; border:1px solid #e2e8f0; overflow:hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
          <!-- Header -->
          <div style="background:linear-gradient(135deg, #6366f1, #8b5cf6); padding:24px 32px;">
            <h1 style="margin:0; color:white; font-size:20px; font-weight:800; letter-spacing:-0.5px;">Campaign<span style="color:#c4b5fd;">Hub</span></h1>
          </div>
          <!-- Body -->
          <div style="padding:32px; color:#1e293b; font-size:15px; line-height:1.7;">
            ${body}
          </div>
          <!-- Footer -->
          <div style="padding:20px 32px; background:#f8fafc; border-top:1px solid #e2e8f0; text-align:center;">
            <p style="margin:0; color:#94a3b8; font-size:12px;">© ${new Date().getFullYear()} CampaignHub. All rights reserved.</p>
            <p style="margin:4px 0 0; color:#94a3b8; font-size:11px;">This is an automated notification. Please do not reply directly.</p>
          </div>
        </div>
      </div>
    </body>
    </html>`;
  }
}
