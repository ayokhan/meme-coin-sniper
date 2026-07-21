import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";
import { authRequestContext } from "@/lib/auth-request-context";

const handler = NextAuth(authOptions);

export async function GET(...args: Parameters<typeof handler>) {
  const req = args[0] as Request;
  return authRequestContext.run(req, () => handler(...args));
}

export async function POST(...args: Parameters<typeof handler>) {
  const req = args[0] as Request;
  return authRequestContext.run(req, () => handler(...args));
}
