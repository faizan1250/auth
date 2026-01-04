import type { CookieOptions, Response } from "express";
import { fifteenMinutesFromNow, thirtyDaysFromNow } from "./date";

const defaults: CookieOptions = {
  sameSite: "strict",
  httpOnly: true,
  secure: false,
};

const getAccessTokenCookieOptions = (): CookieOptions => ({
  ...defaults,
  expires: fifteenMinutesFromNow(),
});

const getRefreshTokenCookieOptions = (): CookieOptions => ({
  ...defaults,
  expires: thirtyDaysFromNow(),
  path: "/auth/refresh",
});

type params = {
  res: Response;
  accessToken: string;
  refreshToken: string;
};

export const setAuthCookies = ({ res, accessToken, refreshToken }: params) =>
  res
    .cookie("access-token", accessToken, getAccessTokenCookieOptions())
    .cookie("refresh-token", refreshToken, getRefreshTokenCookieOptions());
