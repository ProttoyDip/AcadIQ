import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST || "smtp.gmail.com";
const port = parseInt(process.env.SMTP_PORT || "587", 10);
const secure = process.env.SMTP_SECURE === "true";
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;
const fromName = process.env.SMTP_FROM_NAME || "AcadIQ Support";
const fromEmail = process.env.SMTP_FROM_EMAIL || user || "noreply@acadiq.edu";

export const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: user && pass ? { user, pass } : undefined,
});

export async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<void> {
  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 20px; color: #1e293b; }
          .container { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); }
          .logo { display: inline-flex; align-items: center; gap: 8px; font-weight: 700; font-size: 22px; color: #4f46e5; text-decoration: none; margin-bottom: 24px; }
          .title { font-size: 20px; font-weight: 700; color: #0f172a; margin: 0 0 12px 0; }
          .text { font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 24px 0; }
          .btn { display: inline-block; background-color: #4f46e5; color: #ffffff !important; font-weight: 600; font-size: 15px; padding: 12px 28px; border-radius: 8px; text-decoration: none; box-shadow: 0 2px 4px rgba(79, 70, 229, 0.2); }
          .btn:hover { background-color: #4338ca; }
          .footer { margin-top: 32px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 13px; color: #94a3b8; line-height: 1.5; }
          .link-fallback { word-break: break-all; color: #4f46e5; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="logo">
            <span>🎓 AcadIQ</span>
          </div>
          <h1 class="title">Reset Your AcadIQ Password</h1>
          <p class="text">We received a request to reset your password for your AcadIQ account. Click the button below to choose a new password. This link will expire in 30 minutes.</p>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${resetUrl}" class="btn" target="_blank">Reset Password</a>
          </div>
          <p class="text" style="font-size: 13px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          <div class="footer">
            <p>Button not working? Copy and paste this URL into your browser:</p>
            <p class="link-fallback">${resetUrl}</p>
            <p style="margin-top: 16px;">&copy; ${new Date().getFullYear()} AcadIQ Academic Intelligence Platform. All rights reserved.</p>
          </div>
        </div>
      </body>
    </html>
  `;

  await transporter.sendMail({
    from: `"${fromName}" <${fromEmail}>`,
    to: email,
    subject: "Reset your AcadIQ Password",
    html: htmlContent,
  });
}
