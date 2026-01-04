import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import errorHandler from "./middleware/errorHandler";
import authRoutes from "./routes/auth.route";
const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.APP_ORIGIN,
    credentials: true,
  }),
);
app.use(cookieParser());
app.get("/health", (_req, res) => {
  return res.status(200).json({
    status: "ok",
    msg: "healthy",
  });
});
app.use("/auth", authRoutes);
app.use(errorHandler);

app.listen(process.env.PORT, () =>
  console.log(`running on port ${process.env.PORT}`),
);
