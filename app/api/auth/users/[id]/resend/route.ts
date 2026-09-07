import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/auth";
import { getCurrentSafeUser } from "@/lib/session";
import { getUserById } from "@/lib/userDb";
import { createVerificationToken } from "@/lib/verificationDb";
import { sendVerificationEmail } from "@/lib/email";
export const runtime="nodejs";
export async function POST(req: Request,{params}:{params:{id:string}}) {
  const me=await getCurrentSafeUser(); if(!isAdmin(me)) return NextResponse.json({error:"forbidden"},{status:403});
  const user=await getUserById(params.id); if(!user) return NextResponse.json({error:"not_found"},{status:404});
  if(user.active || user.emailVerifiedAt) return NextResponse.json({error:"already_verified"},{status:400});
  try { const token=await createVerificationToken(user.id); const origin=process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/,"") || new URL(req.url).origin; await sendVerificationEmail(user.email,user.name,`${origin}/api/auth/verify?token=${encodeURIComponent(token)}`); return NextResponse.json({ok:true}); }
  catch(err) { const error=err instanceof Error?err.message:"server_error"; return NextResponse.json({error},{status:error==="email_not_configured"?503:502}); }
}
