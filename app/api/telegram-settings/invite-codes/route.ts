import { NextResponse } from "next/server";
import { createInviteCode, listInviteCodes, deleteInviteCode } from "@/lib/telegram";

// Beállítások → "Telegram" → "Csapattag meghívása" — lásd lib/telegram.ts.
export async function GET() {
  const codes = await listInviteCodes();
  return NextResponse.json({ ok: true, codes });
}

export async function POST(request: Request) {
  let payload: { label?: string };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Érvénytelen kérés." }, { status: 400 });
  }

  const result = await createInviteCode(payload.label ?? "");
  if (!result.ok) return NextResponse.json(result, { status: 400 });
  const codes = await listInviteCodes();
  return NextResponse.json({ ok: true, code: result.code, codes });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Hiányzó id." }, { status: 400 });

  const result = await deleteInviteCode(id);
  if (!result.ok) return NextResponse.json(result, { status: 500 });
  const codes = await listInviteCodes();
  return NextResponse.json({ ok: true, codes });
}
