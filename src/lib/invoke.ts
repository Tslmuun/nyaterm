import { invoke as tauriInvoke } from "@tauri-apps/api/core";
import { logger } from "./logger";

/**
 * Typed wrapper around Tauri's `invoke()` with built-in error logging.
 *
 * Usage:
 *   const result = await invoke<string>("create_ssh_session", { config });
 *   const sessions = await invoke<SessionInfo[]>("list_sessions");
 */
export async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const requestId = logger.createRequestId();
  const startedAt = performance.now();
  const argsSummary = summarizeInvokeArgs(args);

  logger.debug({
    domain: "tauri.invoke",
    event: "command.start",
    message: `Command "${cmd}" started`,
    ids: { request_id: requestId },
    data: {
      command: cmd,
      args: argsSummary,
    },
  });

  try {
    const result = await tauriInvoke<T>(cmd, args);
    logger.debug({
      domain: "tauri.invoke",
      event: "command.success",
      message: `Command "${cmd}" succeeded`,
      ids: { request_id: requestId },
      data: {
        command: cmd,
        duration_ms: Math.round(performance.now() - startedAt),
      },
    });
    return result;
  } catch (error) {
    logger.error({
      domain: "tauri.invoke",
      event: "command.error",
      message: `Command "${cmd}" failed`,
      ids: { request_id: requestId },
      data: {
        command: cmd,
        duration_ms: Math.round(performance.now() - startedAt),
        args: argsSummary,
      },
      error,
    });
    throw error;
  }
}

function summarizeInvokeArgs(args?: Record<string, unknown>): unknown {
  if (!args) return undefined;
  return Object.fromEntries(
    Object.entries(args).map(([key, value]) => [key, summarizeValue(value, 0)]),
  );
}

function summarizeValue(value: unknown, depth: number): unknown {
  if (value == null || typeof value === "boolean" || typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return { type: "string", length: value.length };
  }

  if (Array.isArray(value)) {
    return { type: "array", length: value.length };
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (depth >= 1) {
      return { type: "object", keys: entries.map(([key]) => key).slice(0, 20) };
    }
    return Object.fromEntries(entries.map(([key, item]) => [key, summarizeValue(item, depth + 1)]));
  }

  return { type: typeof value };
}
