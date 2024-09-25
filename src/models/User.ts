import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password?: string;
  googleId?: string;
  facebookId?: string;
  appleId?: string;
  tokens: {
    sessionId?:string;
    refreshToken: string;
    ip: string;
    deviceName: string;
  }[];

  addSession(refreshToken: string, sessionId: string, ip: string, deviceName: string): Promise<void>;
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
      createdAt: { type: Date, default: Date.now, expires: '7d' } // Automatically delete after 7 days
    }
  ]
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

userSchema.index({ 'tokens.createdAt': 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 }); // 7 days

const User = mongoose.model<IUser>('User', userSchema);
export default User;
