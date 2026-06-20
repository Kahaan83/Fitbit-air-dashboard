import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const res = await fetch("http://127.0.0.1:8000/api/trigger-sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        start_date: body.start_date,
        end_date: body.end_date,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json(
        { error: "backend_error", message: errText },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      {
        error: "backend_unavailable",
        message: "The local Python gateway service is not running on port 8000.",
      },
      { status: 503 }
    );
  }
}
