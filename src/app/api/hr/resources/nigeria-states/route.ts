import { listNigeriaStatesFromDb } from "@/lib/nigeria-locations-sync";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const states = await listNigeriaStatesFromDb();
    return NextResponse.json({ states, source: "db" });
  } catch (err) {
    console.error("nigeria-states", err);
    return NextResponse.json({ error: "Could not load states" }, { status: 503 });
  }
}
