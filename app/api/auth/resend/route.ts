import { NextResponse } from "next/server";
import { normalizeEmail } from "@/lib/auth";
import { getUserByEmail } from "@/lib/userDb";
import { createVerificationToken } from "@/lib/verificationDb";
import { sendVerificationEmail } from "@/lib/email";
export const runtime="nodejs";
export async function POST(req: Request) {
  try {
    const body=await req.json(); const email=normalizeEmail(typeof body?.email==="string"?body.email:"");
    const user=await getUserByEmail(email);
    if(!user || user.active || user.emailVerifiedAt) return NextResponse.json({ok:true});
    const token=await createVerificationToken(user.id);
    const origin=process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/,"") || new URL(req.url).origin;
    await sendVerificationEmail(user.email,user.name,`${origin}/api/auth/verify?token=${encodeURIComponent(token)}`);
    return NextResponse.json({ok:true});
  } catch(err) { const error=err instanceof Error?err.message:"server_error"; return NextResponse.json({error},{status:error==="email_not_configured"?503:502}); }
}
