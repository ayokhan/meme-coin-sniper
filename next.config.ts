import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pdf-parse", "mammoth", "imapflow", "mailparser", "nodemailer"],
};

export default nextConfig;
