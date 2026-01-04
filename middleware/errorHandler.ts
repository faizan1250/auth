import type { ErrorRequestHandler, Response } from "express";
import { BAD_REQUEST, INTERNAL_SERVER_ERROR } from "../constants/http";
import z, { ZodError } from "zod";

const handleZodError = (res: Response, error: ZodError) => {
  const errors = error.issues.map((err) => ({
    path: err.path.join("."),
    message: err.message,
  }));
  return res.status(BAD_REQUEST).json({
    errors,
  });
};

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  console.log(`path: ${req.path}`, error);

  if (error instanceof z.ZodError) {
    return handleZodError(res, error);
  }
  return res.status(INTERNAL_SERVER_ERROR).send("internal server error");
};
export default errorHandler;
