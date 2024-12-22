import { v4 as uuidv4 } from "uuid";

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
}

export function generateSessionId(): string {
  return uuidv4(); // Unique session ID for each request
}
