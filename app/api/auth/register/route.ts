import { NextResponse } from "next/server";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import { buildPendingSignup, getAdminNotificationEmail, getUserByEmail, saveUser, toPublicUser } from "@/lib/userDb";
import { createVerificationToken } from "@/lib/verificationDb";
import { sendAdminSignupNotification, sendVerificationEmail } from "@/lib/email";
export const runtime = "nodejs";
const EMAIL_RE=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export async function POST(req: Request) {
  try {
    const body=await req.json();
    const name=typeof body?.name==="string"?body.name.trim():"";
    const email=normalizeEmail(typeof body?.email==="string"?body.email:"");
    const password=typeof body?.password==="string"?body.password:"";
    if(!name || !EMAIL_RE.test(email) || password.length<8) return NextResponse.json({error:"invalid"},{status:400});
    if(await getUserByEmail(email)) return NextResponse.json({error:"email_taken"},{status:409});
    const user=buildPendingSignup({name,email,passwordHash:await hashPassword(password)});
    await saveUser(user);
    const token=await createVerificationToken(user.id);
    const origin=process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/,"") || new URL(req.url).origin;
    let emailSent=true; let emailError:string|undefined;
    try { await sendVerificationEmail(user.email,user.name,`${origin}/api/auth/verify?token=${encodeURIComponent(token)}`); }
    catch(err) { emailSent=false; emailError=err instanceof Error?err.message:"email_send_failed"; }
    const adminEmail=await getAdminNotificationEmail();
    let adminNotified=false;
    if(adminEmail) { try { await sendAdminSignupNotification(adminEmail,user.name,user.email); adminNotified=true; } catch { /* signup must still succeed */ } }
    return NextResponse.json({user:toPublicUser(user),emailSent,emailError,adminNotified},{status:201});
  } catch(err) { return NextResponse.json({error:err instanceof Error?err.message:"server_error"},{status:500}); }
}
