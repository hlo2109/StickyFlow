// Envío de correos por SMTP (nodemailer). Si no hay SMTP configurado, los correos no se envían (ok:false).
import nodemailer from 'nodemailer';

export function createMailer(smtp, log = console) {
  const transport = smtp
    ? nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port,
        secure: smtp.secure,
        auth: smtp.user ? { user: smtp.user, pass: smtp.pass } : undefined,
      })
    : null;
  return {
    enabled: Boolean(transport),
    async send({ to, subject, text }) {
      if (!transport) return { ok: false, reason: 'smtp-no-configurado' };
      try {
        await transport.sendMail({ from: smtp.from, to, subject, text });
        return { ok: true };
      } catch (e) {
        log.error?.({ err: e.message }, 'No se pudo enviar el correo');
        return { ok: false, reason: 'error-de-envio' };
      }
    },
  };
}
