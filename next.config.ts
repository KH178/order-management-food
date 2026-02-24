import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Prevent Prisma from being bundled — it must stay as a native Node.js module
  serverExternalPackages: [
    "@prisma/client",
    ".prisma/client",
    "pino",
    "pino-pretty",
    "kafkajs",
  ],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
