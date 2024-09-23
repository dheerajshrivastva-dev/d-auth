import jwt, { JwtPayload } from 'jsonwebtoken';
import dotenv from "dotenv";

dotenv.config();

const jwtSecret = process.env.JWT_SECRET!;

export const verifyToken = (refreshToken: string) => {
  return jwt.verify(refreshToken, jwtSecret) as JwtPayload;
};
