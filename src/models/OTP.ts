import mongoose, { Document, Schema, Types } from "mongoose";

export enum OTPType {
  ForgetPassword = "ForgetPassword",
  VerifyEmail = "VerifyEmail",
  VerifyPhone = "VerifyPhone",
  Verify2FA = "Verify2FA",
}

export interface IOTP extends Document {
  userId: Types.ObjectId;
  otp: string;
  sessionId: string;
  otpType: OTPType;
  createdAt: Date;
  otpCount: number;
  otpSentAt: Date | null;
}

const OTPSchema = new Schema<IOTP>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, ref: "User" },
    otp: { type: String, required: true },
    sessionId: { type: String, required: true },
    otpType: { type: String, enum: Object.values(OTPType), required: true },
    otpCount: { type: Number, default: 1 },
    otpSentAt: { type: Date, default: null },
    createdAt: { type: Date, default: Date.now, expires: 600 }, // 10 minutes TTL
  },
  { timestamps: true }
);

OTPSchema.index({ userId: 1 }); // For looking up OTPs by user
OTPSchema.index({ sessionId: 1 }); // For session-specific queries

const OTP = mongoose.model<IOTP>("OTP", OTPSchema);
export default OTP;
