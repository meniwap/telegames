import { NextResponse } from "next/server";

import { getCatalogPayload } from "@/lib/server/store";

export async function GET() {
  return NextResponse.json(await getCatalogPayload());
}
