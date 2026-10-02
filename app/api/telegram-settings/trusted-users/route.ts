import { NextResponse } from "next/server";
import { listTrustedUsers, removeTrustedUser } from "@/lib/telegram";

// Beállítások → "Telegram" → Csapattagok lista — lásd lib/telegram.ts.
export async function GET() {
  const users = await listTrustedUsers();
  return NextResponse.json({ ok: true, users });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "Hiányzó id." }, { status: 400 });

  const result = await removeTrustedUser(id);
  if (!result.ok) return NextResponse.json(result, { status: 500 });
  const users = await listTrustedUsers();
  return NextResponse.json({ ok: true, users });
}
