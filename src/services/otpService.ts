import OTP, { OTPType } from "../models/OTP";
import { generateOTP, generateSessionId } from "../utils/otpHelpers";

export interface IOtpResponse {
  sessionId: string;
  otp: string;
  validityMinutes: number;
}

  /**
   * Requests a new OTP and returns the corresponding sessionId
   * @param userId The id of the user who requested the OTP
   * @param email The email address of the user who requested the OTP
   * @returns A promise that resolves to an object containing the sessionId
   * The sessionId is crucial because otp and sessionId both needed,
   * for example if user iniciated forget password in a browser so browser will have sessionId and otp will be send to user email.
   */
export async function requestOtp(userId: string, otpType: OTPType): Promise<IOtpResponse | Error> {
  const existingOTPs = await OTP.find({ userId, otpType });

  if (existingOTPs.length >= 1) {
    await OTP.deleteMany({ userId, otpType });
  }

  const otp = generateOTP();
  const sessionId = generateSessionId();

  const newOTP = new OTP({ userId, otp, sessionId, otpType });
  await newOTP.save();

  return { sessionId, otp, validityMinutes: 10 };
}

  /**
   * Validate an OTP
   * @param userId The id of the user who requested the OTP
   * @param sessionId The sessionId of the OTP
   * @param otp The OTP to validate
   * @returns A promise that resolves to true if the OTP is valid, or throws an error if the OTP is invalid or expired
   */
export async function validateOTP(userId: string, sessionId: string, otp: string, otpType: OTPType): Promise<boolean> {
  const existingOTP = await OTP.findOne({ userId, sessionId, otpType, otp });
  if (!existingOTP) {
    throw new Error("Session expired try again.");
  } else {
    if (existingOTP.otp !== otp) {
      throw new Error("Invalid OTP.");
    }
  }

  // OTP is valid; delete it to prevent reuse
  await OTP.deleteOne({ _id: existingOTP._id });
  return true;
}

  /**
   * Requests a new OTP for a user's forget password request.
   * @param userId The id of the user who requested the OTP
   * @param email The email of the user who requested the OTP
   * @param sessionId The sessionId of the OTP
   * @throws {Error} If the user has already requested the maximum allowed number of OTPs within 10 minutes
   * @returns A promise that resolves when a new OTP has been generated and saved to the database
   */
export async function requestNewOtp(userId: string, sessionId: string, otpType: OTPType): Promise<IOtpResponse | Error> {
  const existingOTP = await OTP.findOne({ userId, sessionId });

  if (existingOTP) {
    const timeSinceFirstRequest = Date.now() - existingOTP.createdAt.getTime();
    if (timeSinceFirstRequest < 10 * 60 * 1000 && existingOTP.otpCount >= 2) {
      await OTP.deleteOne({ userId, otpType });
      throw new Error("Maximum OTP requests reached. Try again after 10 minutes.");
    } else {
      const otp = generateOTP();
      existingOTP.otp = otp;
      existingOTP.otpCount += 1;
      await existingOTP.save();

      return { sessionId, otp, validityMinutes: Math.floor(timeSinceFirstRequest / 1000 / 60) };
    }
  } else {
    const { sessionId, otp } = await requestOtp(userId, otpType) as { sessionId: string; otp: string };
    return { sessionId, otp, validityMinutes: 10 };
  }
}
