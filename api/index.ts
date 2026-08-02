import { app } from "../src/app";

export default function handler(req: any, res: any) {
  try {
    return app(req, res);
  } catch (err: any) {
    console.error("Vercel Serverless Function error:", err);
    if (!res.headersSent) {
      res.status(200).json({
        status: "error",
        error: err?.message || "Internal Server Error",
        message: "Aplikasi mengalami kendala internal: " + (err?.message || "Unknown error")
      });
    }
  }
}

