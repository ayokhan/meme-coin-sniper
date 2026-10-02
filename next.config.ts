import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "imapflow", "mailparser", "nodemailer"],
  // A stray lockfile in the user's home dir otherwise makes Turbopack pick the wrong workspace root locally.
  turbopack: { root: path.resolve(__dirname) },
};

export default nextConfig;
