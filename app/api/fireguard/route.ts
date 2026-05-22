import { NextResponse } from "next/server";

const APPS_SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycbyrdGnZs18Ur6Cxf0nnC2TsRCZ1C1FmK1aVB8Dx-Kr0mGB90s4ZmCIBavldIRaHBt7OoQ/exec";

export async function GET() {
  try {
    const res = await fetch(APPS_SCRIPT_URL, { cache: "no-store" });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Failed to fetch Apps Script data (${res.status})` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown server error" },
      { status: 500 }
    );
  }
}
