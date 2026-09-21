import { createSession, DevinApiError, isDevinApiConfigured } from "@/lib/devin/client";
import { DEVIN_MODES, type CreatedSessionView, type DevinMode } from "@/lib/devin/types";

export const dynamic = "force-dynamic";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isDevinMode(value: unknown): value is DevinMode {
  return typeof value === "string" && DEVIN_MODES.includes(value as DevinMode);
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Request body must be valid JSON." }, { status: 400 });
  }

  if (!isObject(body)) {
    return Response.json({ error: "Request body must be a JSON object." }, { status: 400 });
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";
  if (!prompt) {
    return Response.json({ error: "Prompt is required." }, { status: 400 });
  }
  if (prompt.length > 10_000) {
    return Response.json(
      { error: "Prompt must be 10,000 characters or fewer." },
      { status: 400 },
    );
  }
  if (!isDevinMode(body.devinMode)) {
    return Response.json(
      { error: "devinMode must be one of: normal, fast, lite, ultra, fusion." },
      { status: 400 },
    );
  }

  if (!isDevinApiConfigured()) {
    return Response.json(
      { error: "Devin API is not configured (DEVIN_API_KEY, DEVIN_ORG_ID)." },
      { status: 503 },
    );
  }

  try {
    const created = await createSession({ prompt, devinMode: body.devinMode });
    const view: CreatedSessionView = {
      sessionId: created.session_id,
      url: created.url,
      status: created.status,
      title: created.title,
      devinMode: created.devin_mode,
      createdAt: new Date(created.created_at * 1000).toISOString(),
    };
    return Response.json(view, { status: 201 });
  } catch (error) {
    if (error instanceof DevinApiError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    return Response.json({ error: "Could not reach the Devin API." }, { status: 502 });
  }
}
