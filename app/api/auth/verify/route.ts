import { NextResponse } from "next/server";
import { consumeVerificationToken } from "@/lib/verificationDb";
import { getUserById, saveUser } from "@/lib/userDb";
export const runtime="nodejs";
export async function GET(req: Request) {
  const url=new URL(req.url); const token=url.searchParams.get("token")||"";
  const userId=await consumeVerificationToken(token);
  if(!userId) return NextResponse.redirect(new URL("/login?verification=invalid",url.origin));
  const user=await getUserById(userId);
  if(!user) return NextResponse.redirect(new URL("/login?verification=invalid",url.origin));
  await saveUser({...user,active:true,emailVerifiedAt:new Date().toISOString()});
  return NextResponse.redirect(new URL("/login?verification=success",url.origin));
}
