type EmailInput = { to: string; subject: string; html: string };

export class EmailConfigurationError extends Error {
  constructor() {
    super("email_not_configured");
  }
}

export async function sendSystemEmail(input: EmailInput): Promise<string | undefined> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new EmailConfigurationError();
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: [input.to], subject: input.subject, html: input.html }),
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({})) as { id?: string; message?: string };
  if (!response.ok) throw new Error(data.message || "email_send_failed");
  return data.id;
}

function esc(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export async function sendVerificationEmail(to: string, name: string, verifyUrl: string) {
  return sendSystemEmail({
    to,
    subject: "Verify your enone.app account / Verifica tu cuenta",
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Welcome to enone.app, ${esc(name)}</h2><p>Confirm your email to activate your account. This link expires in 24 hours.</p><p><a href="${esc(verifyUrl)}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:white;text-decoration:none;border-radius:6px">Verify email</a></p><hr><h2>Bienvenido a enone.app</h2><p>Confirma tu correo para activar tu cuenta. Este enlace vence en 24 horas.</p><p><a href="${esc(verifyUrl)}">Verificar correo</a></p></div>`,
  });
}

export async function sendAdminSignupNotification(to: string, name: string, email: string) {
  return sendSystemEmail({
    to,
    subject: `New enone.app signup: ${name}`,
    html: `<div style="font-family:Arial,sans-serif"><h2>New account signup</h2><p><strong>Name:</strong> ${esc(name)}</p><p><strong>Email:</strong> ${esc(email)}</p><p>The account is pending email verification and has no module permissions.</p></div>`,
  });
}

export async function sendPasswordResetEmail(to: string, name: string, resetUrl: string) {
  return sendSystemEmail({
    to,
    subject: "Reset your enone.app password / Restablece tu contraseña",
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto"><h2>Password reset, ${esc(name)}</h2><p>We received a request to reset your enone.app password. This link expires in 24 hours.</p><p><a href="${esc(resetUrl)}" style="display:inline-block;padding:12px 20px;background:#6366f1;color:white;text-decoration:none;border-radius:6px">Reset password</a></p><p style="color:#64748b;font-size:13px">If you did not request this, you can ignore this email.</p><hr><h2>Restablecer contraseña</h2><p>Recibimos una solicitud para restablecer tu contraseña de enone.app. Este enlace vence en 24 horas.</p><p><a href="${esc(resetUrl)}">Restablecer contraseña</a></p><p style="color:#64748b;font-size:13px">Si no solicitaste esto, puedes ignorar este correo.</p></div>`,
  });
}

