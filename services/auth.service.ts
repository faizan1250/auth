import { prisma } from "../config/db";
import { hashValue } from "../utils/bcrypt";
import { VerificationCodeType } from "../generated/prisma/enums";
import { ONE_DAY_MS, oneYearFromNow, thirtyDaysFromNow } from "../utils/date";
import jwt from "jsonwebtoken";
import { APP_ORIGIN, JWT_REFRESH_SECRET, JWT_SECRET } from "../constants/env";
import appAssert from "../utils/appAssert";
import {
  INTERNAL_SERVER_ERROR,
  NOT_FOUND,
  UNAUTHORIZED,
} from "../constants/http";
import { comparePassword } from "../utils/comparePassword";
import {
  refreshTokenSignOptions,
  signToken,
  verifyToken,
  type RefreshTokenPayload,
} from "../utils/jwt";
import { sendMail } from "../utils/sendMail";
import { getVerifyEmailTemplate } from "../utils/emailTemplates";

export type createAccountParams = {
  email: string;
  password: string;
  userAgent?: string;
};

export const createAccount = async (data: createAccountParams) => {
  const userExists = await prisma.user.findUnique({
    where: { email: data.email },
  });
  //  if (userExists) {
  //   throw new Error("user already exists");
  //}
  appAssert(!userExists, 409, "email already in use");
  const hashedValue = await hashValue(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedValue,
    },
    select: {
      id: true,
      email: true,
      verified: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  const verificationCode = await prisma.verificationCode.create({
    data: {
      userId: user.id,
      type: VerificationCodeType.EMAIL_VERIFICATION,
      expiresAt: oneYearFromNow(),
    },
  });
  const url = `${APP_ORIGIN}/email/verify/${verificationCode.id}`;
  await sendMail({
    to: user.email,
    ...getVerifyEmailTemplate(url),
  });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      userAgent: data.userAgent,
      expiresAt: thirtyDaysFromNow(),
    },
  });
  const refreshToken = signToken(
    { sessionId: session.id },
    refreshTokenSignOptions,
  );
  const accessToken = signToken({
    userId: user.id,
    sessionId: session.id,
  });
  return {
    user,
    accessToken,
    refreshToken,
  };
};

export type LoginParams = {
  email: string;
  password: string;
  userAgent?: string;
};
export const loginUser = async (data: LoginParams) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });
  appAssert(user, UNAUTHORIZED, "invalid email");
  const isValid = await comparePassword(user, data.password);
  appAssert(isValid, UNAUTHORIZED, "invalid password");
  const userId = user.id;

  const session = await prisma.session.create({
    data: {
      userId,
      userAgent: data.userAgent,
      expiresAt: thirtyDaysFromNow(),
    },
  });
  const sessionInfo = {
    sessionId: session.id,
  };

  const refreshToken = signToken(sessionInfo, refreshTokenSignOptions);
  const accessToken = signToken({
    ...sessionInfo,
    userId,
  });
  const safeUser = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      verified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return {
    safeUser,
    accessToken,
    refreshToken,
  };
};
export const refreshUserAccessToken = async (refreshToken: string) => {
  const { payload } = verifyToken<RefreshTokenPayload>(refreshToken, {
    secret: refreshTokenSignOptions.secret,
  });
  appAssert(payload, UNAUTHORIZED, "Invalid refresh token");

  const session = await prisma.session.findUnique({
    where: {
      id: payload.sessionId,
    },
  });
  const now = Date.now();
  appAssert(
    session && session.expiresAt.getTime() > now,
    UNAUTHORIZED,
    "Session expired",
  );

  // refresh the session if it expires in the next 24hrs
  const sessionNeedsRefresh = session.expiresAt.getTime() - now <= ONE_DAY_MS;

  if (sessionNeedsRefresh) {
    await prisma.session.update({
      where: { id: session.id },
      data: {
        expiresAt: thirtyDaysFromNow(),
      },
    });
  }

  const newRefreshToken = sessionNeedsRefresh
    ? signToken(
        {
          sessionId: session.id,
        },
        refreshTokenSignOptions,
      )
    : undefined;

  const accessToken = signToken({
    userId: session.userId,
    sessionId: session.id,
  });

  return {
    accessToken,
    newRefreshToken,
  };
};

export const verifyEmail = async (code: string) => {
  const validCode = await prisma.verificationCode.findFirst({
    where: {
      id: code,
      type: VerificationCodeType.EMAIL_VERIFICATION,
      expiresAt: { gt: new Date() },
    },
  });
  appAssert(validCode, NOT_FOUND, "invalid or expired verification code");
  const updatedUser = await prisma.user.update({
    where: { id: validCode.userId },
    data: {
      verified: true,
    },
  });
  appAssert(updatedUser, INTERNAL_SERVER_ERROR, "failed to verify user");
  await prisma.verificationCode.delete({
    where: { id: validCode.id },
  });

  const safeUser = await prisma.user.findUnique({
    where: { id: updatedUser.id },
    select: {
      id: true,
      email: true,
      verified: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return safeUser;
};
