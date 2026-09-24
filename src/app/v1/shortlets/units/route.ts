import { GET as pullUnits } from "@/app/api/v1/shortlets/units/route";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return pullUnits(request);
}
