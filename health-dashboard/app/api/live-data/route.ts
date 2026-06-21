import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const start_date = searchParams.get("start_date");
  const end_date = searchParams.get("end_date");

  const accept = request.headers.get("accept");

  // If client requests text/event-stream, proxy to FastAPI SSE endpoint
  if (accept?.includes("text/event-stream")) {
    const backendUrl = `http://127.0.0.1:8000/api/sync-stream?start_date=${start_date || ""}&end_date=${end_date || ""}`;
    try {
      const response = await fetch(backendUrl, {
        headers: {
          "Accept": "text/event-stream",
        },
        cache: "no-store",
      });

      if (!response.ok) {
        return new Response(`Backend error: ${response.statusText}`, { status: response.status });
      }

      return new Response(response.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          "Connection": "keep-alive",
        },
      });
    } catch (err: any) {
      return new Response(`Backend unavailable: ${err.message}`, { status: 503 });
    }
  }

  // Otherwise proxy normally to /api/health-data JSON endpoint
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 120000); // 120-second timeout

  try {
    let healthDataUrl = "http://127.0.0.1:8000/api/health-data";
    if (start_date && end_date) {
      healthDataUrl += `?start_date=${start_date}&end_date=${end_date}`;
    }

    const res = await fetch(healthDataUrl, {
      signal: controller.signal,
      cache: "no-store",
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
          ? "Request to the Python service timed out after 120 seconds. Please complete the browser OAuth flow within 2 minutes."
          : "The local Python gateway service is not running on port 8000.",
      },
      { status: 503 }
    );
  }
}
