import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", `${path}${request.nextUrl.search}`);

  if (!path.startsWith("/platform")) {
    return NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const token = await getToken({
    req: request,
    secret,
    secureCookie: process.env.NODE_ENV === "production",
  });

  if (!token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", path);
    return NextResponse.redirect(login);
  }

  if (!token.isPlatformAdmin) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
