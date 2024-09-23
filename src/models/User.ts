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
  }[];

  addSession(refreshToken: string, sessionId: string): Promise<void>;
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
      createdAt: { type: Date, default: Date.now, expires: '7d' } // Automatically delete after 7 days
    }
  ]
});

userSchema.methods.addSession = async function (refreshToken: string, sessionId: string) {
  if (this.tokens.length >= 10) {
    // Remove the oldest session (FIFO) when max sessions are reached
    this.tokens.shift();
  }

  this.tokens.push({ sessionId, refreshToken });
  await this.save();
};

userSchema.index({ 'tokens.createdAt': 1 }, { expireAfterSeconds: 60 * 60 * 24 * 7 }); // 7 days

const User = mongoose.model<IUser>('User', userSchema);
export default User;
