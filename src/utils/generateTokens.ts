import jwt from 'jsonwebtoken';
import dotenv from "dotenv";

export const REFRESH_TOKEN_EXP_TIME = 7*24*60*60*1000;
export const ACCESS_TOKEN_EXP_TIME = 15*60*1000;

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
