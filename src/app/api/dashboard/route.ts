import { getDashboardData } from "@/lib/devin/dashboard";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const windowDays = Number(new URL(request.url).searchParams.get("windowDays") ?? 7);
  const { data, error } = await getDashboardData(
    Number.isFinite(windowDays) ? Math.min(Math.max(windowDays, 1), 30) : 7,
  );

  return Response.json({ ...data, error });
}
