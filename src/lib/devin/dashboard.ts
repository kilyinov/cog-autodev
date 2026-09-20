import { fetchSessions, isDevinApiConfigured } from "./client";
import { buildDashboard } from "./metrics";
import { mockSessions } from "./mock";
import type { DashboardData } from "./types";

export type DashboardResult = {
  data: DashboardData;
  error: string | null;
};

/**
 * Loads dashboard data from the Devin API when `DEVIN_API_KEY` is configured,
 * otherwise falls back to mock sessions so the control plane stays usable.
 */
export async function getDashboardData(windowDays = 7): Promise<DashboardResult> {
  if (!isDevinApiConfigured()) {
    return {
      data: buildDashboard(mockSessions(), { source: "mock", windowDays }),
      error: null,
    };
  }

  try {
    const sessions = await fetchSessions(200);
    return { data: buildDashboard(sessions, { source: "live", windowDays }), error: null };
  } catch (error) {
    return {
      data: buildDashboard(mockSessions(), { source: "mock", windowDays }),
      error: error instanceof Error ? error.message : "Unknown Devin API error",
    };
  }
}
