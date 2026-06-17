import { NextResponse } from "next/server";

export async function GET() {
  try {
    const res = await fetch("http://127.0.0.1:8000/api/status", {
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({ token_valid: false, scopes: [], last_refreshed: null });
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    // Gracefully fallback to token_valid = false when backend is offline
    return NextResponse.json({
      token_valid: false,
      scopes: [],
      last_refreshed: null,
      error: "backend_offline",
    });
  }
}
