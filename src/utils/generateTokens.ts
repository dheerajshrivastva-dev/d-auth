import jwt from 'jsonwebtoken';
import dotenv from "dotenv";
import { Request } from 'express';
import UAParser from 'ua-parser-js';
import { v4 as uuidv4 } from 'uuid';

export const REFRESH_TOKEN_EXP_TIME = 7*24*60*60*1000;
export const ACCESS_TOKEN_EXP_TIME = 15*60*1000;
export const LOGIN_SESSION_EXP_TIME = 7*24*60*60*1000;

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

export const extractClientDetails = (req: Request) => {
  const forwarded = req.headers['x-forwarded-for'] as string;
  const ip = forwarded ? forwarded.split(',')[0].trim() : req.ip || 'unknown';
  const userAgent = req.get('User-Agent');
  const parser = new UAParser(userAgent);
  const device = parser.getResult();
  const deviceName = `${device.os?.name || 'Unknown OS'} - ${device.browser?.name || 'Unknown Browser'}`;
  
  return { ip, deviceName };
};

export interface handleTokenReturnType {
  accessToken: string;
  sessionId: string;
  refreshToken: string;
}
export const generateTokensByUserId = (userId: string): handleTokenReturnType => {
  // Generate unique sessionId for this session
  const sessionId = uuidv4();

  const accessToken = generateAccessToken(userId, sessionId);
  const refreshToken = generateRefreshToken(userId, sessionId);

  return {sessionId, refreshToken, accessToken};
}
