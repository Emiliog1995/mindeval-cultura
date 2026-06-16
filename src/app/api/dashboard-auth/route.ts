import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, createSessionToken } from "@/lib/session-cookie";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const correct = process.env.ADMIN_PIN;

  if (!correct || pin !== correct) {
    return NextResponse.json({ error: "PIN incorrecto" }, { status: 401 });
  }

  const token = await createSessionToken(correct);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
