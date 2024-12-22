import mongoose, { Document, Schema } from 'mongoose';
import { LOGIN_SESSION_EXP_TIME } from '../utils/generateTokens';

interface IToken {
  sessionId: string;
  refreshToken: string;
  ip: string;
  deviceName: string;
  createdAt: Date;
}
export interface IUser extends Document {
  email: string;
  password?: string;
  googleId?: string;
  facebookId?: string;
  appleId?: string;
  tokens: IToken[];
  isVerified: boolean;
  isAdmin: boolean;

  firstName: string;
  lastName: string;
  middleName?: string;
  profileUrl?: string;
  dob?: Date;
  gender?: string;
  address1?: string;
  address2?: string;
  city?: string;
  state?: string;
  country?: string;
  pincode?: string;
  phone?: string;

  addSession(refreshToken: string, sessionId: string, ip: string, deviceName: string): Promise<void>;
  getToken(sessionId: string): Promise<IToken>;
}

const userSchema = new Schema<IUser>({
  email: { type: String, required: true, unique: true },
  password: { type: String },
  googleId: { type: String },
  facebookId: { type: String },
  appleId: { type: String },
  tokens: [
    {
      sessionId: { type: String }, // Unique session identifier
      refreshToken: { type: String },
      ip: { type: String, required: true },
      deviceName: { type: String, required: true },
      createdAt: { type: Date, default: Date.now } // Automatically delete after 7 days
    }
  ],
  firstName: { type: String },
  lastName: { type: String },
  middleName: { type: String },
  profileUrl: { type: String },
  dob: { type: Date },
  gender: { type: String },
  address1: { type: String },
  address2: { type: String },
  city: { type: String },
  state: { type: String },
  country: { type: String },
  pincode: { type: String },
  phone: { type: String },
  isVerified: { type: Boolean, default: false, required: true },
  isAdmin: { type: Boolean, default: false, required: true },
});

userSchema.methods.addSession = async function (refreshToken: string, sessionId: string, ip: string, deviceName: string) {
  const existingSession = this.tokens.find((tokenObj: IUser['tokens'][0]) => tokenObj.ip === ip && tokenObj.deviceName === deviceName);
  
  if (existingSession) {
    // Update the existing session
    existingSession.refreshToken = refreshToken;
    existingSession.sessionId = sessionId;
  } else {
    // Add new session
    this.tokens.push({ sessionId, refreshToken, ip, deviceName });
    
    // Keep a max of 10 sessions
    if (this.tokens.length > 10) {
      this.tokens.shift(); // Remove the oldest session
    }
  }
  await this.save();
};

userSchema.methods.getToken = async function (sessionId: string) {
  const now = Date.now();
  // Find the token
  const tokenIndex = this.tokens.findIndex((token : IToken) => token.sessionId === sessionId);

  if (tokenIndex === -1) {
    throw new Error('Token not found');
  }

  const token = this.tokens[tokenIndex];

  // Check if token is valid
  const isExpired = now - new Date(token.createdAt).getTime() > LOGIN_SESSION_EXP_TIME;

  if (isExpired) {
    // Remove the expired token
    this.tokens.splice(tokenIndex, 1);
    await this.save();
    throw new Error('Token has expired and has been deleted');
  }

  return token;
};


const User = mongoose.model<IUser>('User', userSchema);
export default User;
