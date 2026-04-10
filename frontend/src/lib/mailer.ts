/**
 * Mailer — configuration Nodemailer
 * Variables d'environnement requises :
 *   SMTP_HOST     ex. smtp.seneau.sn
 *   SMTP_PORT     ex. 587
 *   SMTP_USER     ex. rapports@seneau.sn
 *   SMTP_PASS     mot de passe SMTP
 *   SMTP_FROM     ex. "SEN'EAU Rapports <rapports@seneau.sn>"
 */
import nodemailer from 'nodemailer'

function createTransporter() {
  return nodemailer.createTransport({
    host:   process.env.SMTP_HOST ?? 'smtp.gmail.com',
    port:   parseInt(process.env.SMTP_PORT ?? '587', 10),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER ?? '',
      pass: process.env.SMTP_PASS ?? '',
    },
    tls: { rejectUnauthorized: false },
  })
}

declare global { var _mailer: nodemailer.Transporter | undefined }

const transporter: nodemailer.Transporter =
  process.env.NODE_ENV === 'development'
    ? (globalThis._mailer ?? (globalThis._mailer = createTransporter()))
    : createTransporter()

export const FROM = process.env.SMTP_FROM ?? "SEN'EAU Rapports <rapports@seneau.sn>"

export default transporter
