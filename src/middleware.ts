import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, isSessionTokenValid } from "@/lib/session-cookie";

export async function middleware(req: NextRequest) {
  const correct = process.env.ADMIN_PIN;
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  const valido = correct ? await isSessionTokenValid(token, correct) : false;

  if (!valido) {
    return NextResponse.redirect(new URL("/admin", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard", "/resultados", "/resultados-clima", "/evaluacion-360/admin"],
};
