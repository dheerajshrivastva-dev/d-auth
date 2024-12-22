import { NextFunction, Request, Response } from 'express';
import User, { IUser } from '../models/User';
import bcrypt from 'bcryptjs';
import { extractClientDetails, generateAccessToken, generateRefreshToken, REFRESH_TOKEN_EXP_TIME } from '../utils/generateTokens';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

import dotenv from "dotenv";
import passport from 'passport';
import { verifyToken } from '../utils/verifyToken';
import { v4 as uuidv4 } from 'uuid';
import AuthConfig from '../config/authConfig';
import sendEmail from '../services/sendEmail';
import userValidatons from '../validations/userValidatons';
import { HTTPResponse, HttpStatus } from '../httpResponse';

dotenv.config();

export default {
  updateUser: async (req: Request, res: Response) => {
    const body = req.body;
    //#region verify payload
    const { error } = userValidatons.userValidation.validate(body);
    if (error) {
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
      );
    }
    //#endregion
    try {
      const user = await User.findOneAndUpdate({ _id: body.userId }, body, { new: true });
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.OK.code, httpStatus: HttpStatus.OK.status, data: user})
      );
    } catch (error) {
      console.debug(error);
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: JSON.stringify(error) || "Something went wrong"})
      );
    }
  },

  deleteUser: async (req: Request, res: Response) => {
    const body = req.body;

    const { error } = userValidatons.userValidation.validate(body);
    if (error) {
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
      );
    }
    try {
      await User.findOneAndDelete({ _id: body.userId });
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.OK.code, httpStatus: HttpStatus.OK.status, data: null, message: "User deleted successfully"})
      );
    } catch (error) {
      console.debug(error);
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: JSON.stringify(error) || "Something went wrong"})
      );
    }
  },

  verifyUser: async (req: Request, res: Response) => {
    const body = req.body;
    try {
      const { error } = userValidatons.userValidation.validate(body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
        );
      }
      const user = await User.findOne({ _id: body.userId }) as IUser;
      user.isVerified = true;
      await user.save();
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.OK.code, httpStatus: HttpStatus.OK.status, data: null, message: "User verified successfully"})
      );
    } catch (error) {
      console.debug(error);
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: JSON.stringify(error) || "Something went wrong"})
      );
    }
  },

  updateAdminStatues: async (req: Request, res: Response) => {
    const body = req.body;
    try {
      const { error } = userValidatons.updateAdminStatusValidation.validate(body);
      if (error) {
        return res.status(200).send(
          new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: error.message})
        );
      }
      const user = await User.findOne({ _id: body.userId }) as IUser;
      user.isAdmin = !!body.makeAdmin;
      await user.save();
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.OK.code, httpStatus: HttpStatus.OK.status, data: null, message: "User verified successfully"})
      );
    } catch (error) {
      console.debug(error);
      return res.status(200).send(
        new HTTPResponse({statusCode: HttpStatus.WARNING.code, httpStatus: HttpStatus.WARNING.status, message: JSON.stringify(error) || "Something went wrong"})
      );
    }
  }
}
