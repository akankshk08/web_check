import { log } from "@/server/log";

/** Captures every unhandled server error as one structured log line (ready to forward to Sentry later). */
export async function onRequestError(error: unknown, request: { path: string; method: string }, context: { routerKind: string; routeType: string }) {
  log.error("request_failed", { error, path: request.path.split("?")[0], method: request.method, routeType: context.routeType });
}
