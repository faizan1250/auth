import type { CookieOptions, Response } from "express";
import { fifteenMinutesFromNow, thirtyDaysFromNow } from "./date";
export const REFRESH_PATH = "/auth/refresh";
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
  path: REFRESH_PATH,
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

export const clearAuthCookies = (res: Response) =>
  res
    .clearCookie("access-token")
    .clearCookie("refresh-token", { path: REFRESH_PATH });
