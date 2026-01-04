import { prisma } from "../config/db";
import { hashValue } from "../utils/bcrypt";
import { VerificationCodeType } from "../generated/prisma/enums";
import { oneYearFromNow, thirtyDaysFromNow } from "../utils/date";
import jwt from "jsonwebtoken";
import { JWT_REFRESH_SECRET, JWT_SECRET } from "../constants/env";

export type createAccountParams = {
  email: string;
  password: string;
  userAgent?: string;
};

export const createAccount = async (data: createAccountParams) => {
  const userExists = await prisma.user.findUnique({
    where: { email: data.email },
  });
  if (userExists) {
    throw new Error("user already exists");
  }
  const hashedValue = await hashValue(data.password);
  const user = await prisma.user.create({
    data: {
      email: data.email,
      password: hashedValue,
    },
  });
  const verificationCode = await prisma.verificationCode.create({
    data: {
      userId: user.id,
      type: VerificationCodeType.EMAIL_VERIFICATION,
      expiresAt: oneYearFromNow(),
    },
  });
  const session = await prisma.session.create({
    data: {
      userId: user.id,
      userAgent: data.userAgent,
      expiresAt: thirtyDaysFromNow(),
    },
  });
  const refreshToken = jwt.sign({ sessionId: session.id }, JWT_REFRESH_SECRET, {
    expiresIn: "30d",
    audience: ["user"],
  });
  const accessToken = jwt.sign(
    {
      userId: user.id,
      sessionId: session.id,
    },
    JWT_SECRET,
    {
      expiresIn: "15m",
      audience: ["user"],
    },
  );
  return {
    user,
    accessToken,
    refreshToken,
  };
};
