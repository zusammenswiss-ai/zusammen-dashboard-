import { NextResponse, type NextRequest } from "next/server";

// Optional single-user protection: if DASHBOARD_USER and DASHBOARD_PASSWORD
// are both set as environment variables, every page requires a browser
// Basic Auth prompt with those credentials. If either is unset, the
// dashboard stays open (useful for local dev).
export function proxy(request: NextRequest) {
  const user = process.env.DASHBOARD_USER;
  const password = process.env.DASHBOARD_PASSWORD;

  if (!user || !password) {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const [scheme, encoded] = authHeader.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = Buffer.from(encoded, "base64").toString("utf-8");
      const separatorIndex = decoded.indexOf(":");
      const suppliedUser = decoded.slice(0, separatorIndex);
      const suppliedPassword = decoded.slice(separatorIndex + 1);
      if (suppliedUser === user && suppliedPassword === password) {
        return NextResponse.next();
      }
    }
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Zusammen Dashboard"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
