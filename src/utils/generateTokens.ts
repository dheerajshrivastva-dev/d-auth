import jwt from 'jsonwebtoken';
import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET!;

export const generateAccessToken = (userId: string, sessionId?: string) => {
  console.debug('generateAccessToken', jwtSecret);
  return jwt.sign({ id: userId, sessionId }, jwtSecret, { expiresIn: '15m' });
};

export const generateRefreshToken = (userId: string, sessionId?: string) => {
  console.debug('generateAccessToken 7d', jwtSecret);
  return jwt.sign({ id: userId, sessionId }, jwtSecret, { expiresIn: '7d' });
};
