import nodemailer from 'nodemailer';
import AuthConfig from '../config/authConfig';
import logger from '../utils/logger';

interface mailDetails extends nodemailer.SendMailOptions {
  to: string; // receiver email
  subject: string; // Subject line
}

const sendEmail = async (mailDetails: mailDetails) => {
  const transporter = nodemailer.createTransport(
    AuthConfig.getInstance().nodeMailerConfig
  )
  return await transporter.sendMail({
    ...mailDetails,
    from: AuthConfig.getInstance().nodeMailerConfig.auth.user
  });
};

export default sendEmail;
