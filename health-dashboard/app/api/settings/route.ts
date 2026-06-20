import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const res = await fetch("http://127.0.0.1:8000/api/settings", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        client_id: body.clientId,
        client_secret: process.env.GCP_CLIENT_SECRET || "",
        age: body.age,
        max_hr: body.maxHR,
        resting_hr: body.restingHR,
        target_sleep_hours: body.targetSleepHours,
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
