import nodemailer from "nodemailer";

async function createTransporter() {
  if (process.env.NODE_ENV === "production") {
    const user = process.env.SES_SMTP_USER;
    const pass = process.env.SES_SMTP_PASS;
    const host = process.env.SES_SMTP_HOST ?? "email-smtp.us-east-1.amazonaws.com";
    if (!user || !pass) {
      throw new Error("SES_SMTP_USER and SES_SMTP_PASS are required in production");
    }
    return nodemailer.createTransport({
      host,
      port: 587,
      secure: false,
      auth: { user, pass },
    });
  }

  const user = process.env.MAILTRAP_USER;
  const pass = process.env.MAILTRAP_PASS;
  if (!user || !pass) {
    throw new Error("MAILTRAP_USER and MAILTRAP_PASS are required in development");
  }

  return nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: { user, pass }
  });
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const from = process.env.SES_FROM_ADDRESS ?? "Quilp <no-reply@quilp.local>";
  const transporter = await createTransporter();
  await transporter.sendMail({ from, to, subject, html });
}
