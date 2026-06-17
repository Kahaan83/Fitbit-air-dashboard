import { NextResponse } from "next/server";

export async function GET() {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 10000); // 10-second timeout

  try {
    const res = await fetch("http://127.0.0.1:8000/api/health-data", {
      signal: controller.signal,
      cache: "no-store", // Do not cache proxy responses at Next.js server layer
    });
    
    clearTimeout(id);

    if (!res.ok) {
      return NextResponse.json(
        {
          error: "backend_unavailable",
          message: `Backend returned status ${res.status}: ${res.statusText}`,
        },
        { status: 503 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    clearTimeout(id);
    return NextResponse.json(
      {
        error: "backend_unavailable",
        message: error.name === "AbortError" 
          ? "Request to the Python service timed out after 10 seconds."
          : "The local Python gateway service is not running on port 8000.",
      },
      { status: 503 }
    );
  }
}
