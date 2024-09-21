import nodemailer from 'nodemailer';

import dotenv from "dotenv";

dotenv.config();

const sendEmail = async (email: string, subject: string, text: string) => {
  const transporter = nodemailer.createTransport({
    service: 'Gmail',
    auth: {
      user: process.env.EMAIL_USERNAME,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USERNAME,
    to: email,
    subject,
    text,
  });
};

export default sendEmail;
