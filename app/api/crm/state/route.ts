import { NextResponse } from "next/server";
import { getCurrentSafeUser } from "@/lib/session";
import { getCrmState, saveCrmState } from "@/lib/crmDb";
import { mergeIncomingCrmState } from "@/lib/landing/lead";
import type { CrmState } from "@/lib/types";
export const runtime = "nodejs";
const fields: (keyof CrmState)[] = ["settings","contacts","opportunities","conversations","appointments","activity","socialConnections","socialPosts","mediaAssets","smsCampaigns","emailCampaigns","emailTemplates","integrations","messagingSends"];
export async function GET() {
  const user=await getCurrentSafeUser();
  if(!user) return NextResponse.json({error:"unauthorized"},{status:401});
  return NextResponse.json({state:await getCrmState(user.id), serverTime:new Date().toISOString()});
}
export async function PUT(req: Request) {
  const user=await getCurrentSafeUser();
  if(!user) return NextResponse.json({error:"unauthorized"},{status:401});
  const body=await req.json().catch(()=>null);
  if(!body || typeof body!=="object") return NextResponse.json({error:"invalid"},{status:400});
  const state={} as CrmState;
  for(const field of fields) {
    if(!(field in body)) return NextResponse.json({error:`missing_${field}`},{status:400});
    (state as Record<string, unknown>)[field]=body[field];
  }
  state.mediaAssets=(Array.isArray(state.mediaAssets)?state.mediaAssets:[]).map(({previewUrl: _preview,...media})=>media);
  const loadedLandingIds = Array.isArray(body.loadedLandingIds)
    ? body.loadedLandingIds.filter((id: unknown): id is string => typeof id === "string")
    : null;
  const existing = await getCrmState(user.id);
  const merged = mergeIncomingCrmState(existing, state, loadedLandingIds);
  await saveCrmState(user.id, merged);
  return NextResponse.json({ok:true});
}
