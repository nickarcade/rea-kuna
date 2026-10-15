import {
  execFileOutput,
  execFileOutputFailure,
} from "../process/ExecFileOutput.js";
import { snapshotEnvironment } from "../process/snapshotEnvironment.js";

/** Environment variable that can override the kuna binary path. */
export const KUNA_COMMAND_ENV = "REA_KUNA_COMMAND";
const VERSION_TIMEOUT_MS = 10_000;

export interface KunaCommandSelection {
  readonly command: string;
  readonly commandSource: "environment" | "path";
}

/** Resolve the launcher command for Kuna. */
export const resolveKunaCommand = (
  environment: Readonly<Record<string, string | undefined>> = process.env,
): KunaCommandSelection => {
  const configured = environment[KUNA_COMMAND_ENV];
  if (configured !== undefined && configured.trim() !== "") {
    return { command: configured.trim(), commandSource: "environment" };
  }
  return { command: "kuna", commandSource: "path" };
};

export interface KunaIdentity {
  readonly version: string | null;
  readonly available: boolean;
  readonly rawOutput?: string | undefined;
  readonly error?: string | undefined;
}

/** Inspect the kuna binary and extract its version. */
export const inspectKunaClient = async (
  selection: KunaCommandSelection,
  signal?: AbortSignal,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<KunaIdentity> => {
  try {
    const { stdout } = await execFileOutput(
      selection.command,
      ["--version"],
      {
        timeout: VERSION_TIMEOUT_MS,
        env: snapshotEnvironment(environment),
        ...(signal === undefined ? {} : { signal }),
      },
    );
    const line = stdout.trim().split(/\r?\n/u)[0] ?? "";
    const match = /kuna\s+([\d.]+)/iu.exec(line);
    const version = match ? match[1]! : (line || null);
    return {
      version,
      available: true,
      rawOutput: stdout.trim(),
    };
  } catch (cause) {
    const failure = execFileOutputFailure(cause);
    const message =
      cause instanceof Error ? cause.message : failure?.stderr ?? String(cause);
    return {
      version: null,
      available: false,
      error: message,
    };
  }
};
