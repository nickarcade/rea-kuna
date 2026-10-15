import {
  execFileOutput,
  execFileOutputFailure,
} from "../process/ExecFileOutput.js";
import { snapshotEnvironment } from "../process/snapshotEnvironment.js";
import {
  resolveKunaCommand,
  type KunaCommandSelection,
} from "./KunaConfiguration.js";

const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_BUFFER_BYTES = 32 * 1024 * 1024; // 32MB buffer for large decompilations/disassembly

export interface KunaFunctionsOptions {
  readonly summary?: boolean | undefined;
  readonly jobs?: string | undefined;
}

export interface KunaDecompileOptions {
  readonly addr?: boolean | undefined;
  readonly language?: string | undefined;
  readonly mode?: string | undefined;
}

export interface KunaDisassembleOptions {
  readonly addr?: boolean | undefined;
  readonly mode?: string | undefined;
}

export interface KunaCryptoOptions {
  readonly algorithm?: string | undefined;
  readonly section?: string | undefined;
}

export interface KunaXrefsOptions {
  readonly kind?: string | undefined;
}

export interface KunaStringsOptions {
  readonly minLength?: number | undefined;
  readonly filter?: string | undefined;
  readonly section?: string | undefined;
}

export class KunaProvider {
  readonly selection: KunaCommandSelection;

  constructor(
    readonly environment: Readonly<
      Record<string, string | undefined>
    > = process.env,
  ) {
    this.selection = resolveKunaCommand(environment);
  }

  private async runJsonCommand<T>(
    args: readonly string[],
    signal?: AbortSignal | undefined,
    timeoutMs: number = DEFAULT_TIMEOUT_MS,
  ): Promise<T> {
    try {
      const { stdout } = await execFileOutput(this.selection.command, args, {
        timeout: timeoutMs,
        maxBuffer: MAX_BUFFER_BYTES,
        env: snapshotEnvironment(this.environment),
        ...(signal === undefined ? {} : { signal }),
      });
      return JSON.parse(stdout) as T;
    } catch (cause) {
      const failure = execFileOutputFailure(cause);
      const message =
        cause instanceof Error
          ? cause.message
          : failure?.stderr ?? String(cause);
      throw new Error(
        `Kuna command failed [${args.join(" ")}]: ${message}`,
        { cause },
      );
    }
  }

  /** Inventory functions and runtime info for a binary. */
  async functions(
    binaryPath: string,
    options: KunaFunctionsOptions = {},
    signal?: AbortSignal | undefined,
  ): Promise<unknown> {
    const args = ["functions", binaryPath, "--json"];
    if (options.summary === true) args.push("--summary");
    if (options.jobs !== undefined && options.jobs !== "")
      args.push("--jobs", options.jobs);
    return this.runJsonCommand(args, signal);
  }

  /** Decompile a function or address to C / Rust code. */
  async decompile(
    binaryPath: string,
    target: string,
    options: KunaDecompileOptions = {},
    signal?: AbortSignal | undefined,
  ): Promise<unknown> {
    const args = ["decompile", binaryPath];
    if (options.addr === true) args.push("--addr");
    if (options.language !== undefined && options.language !== "")
      args.push("--language", options.language);
    if (options.mode !== undefined && options.mode !== "")
      args.push("--mode", options.mode);
    args.push(target, "--json");
    return this.runJsonCommand(args, signal);
  }

  /** Disassemble instructions for a function, address, or range. */
  async disassemble(
    binaryPath: string,
    target: string,
    options: KunaDisassembleOptions = {},
    signal?: AbortSignal | undefined,
  ): Promise<unknown> {
    const args = ["disassemble", binaryPath];
    if (options.addr === true) args.push("--addr");
    if (options.mode !== undefined && options.mode !== "")
      args.push("--mode", options.mode);
    args.push(target, "--json");
    return this.runJsonCommand(args, signal);
  }

  /** Identify cryptographic constants, tables, and algorithms. */
  async crypto(
    binaryPath: string,
    options: KunaCryptoOptions = {},
    signal?: AbortSignal | undefined,
  ): Promise<unknown> {
    const args = ["crypto", binaryPath, "--json"];
    if (options.algorithm !== undefined && options.algorithm !== "")
      args.push("--algorithm", options.algorithm);
    if (options.section !== undefined && options.section !== "")
      args.push("--section", options.section);
    return this.runJsonCommand(args, signal);
  }

  /** Extract cross-references to or from a function or address. */
  async xrefs(
    binaryPath: string,
    target: string,
    direction: "to" | "from" = "to",
    options: KunaXrefsOptions = {},
    signal?: AbortSignal | undefined,
  ): Promise<unknown> {
    const args = ["xrefs", binaryPath];
    if (direction === "to") {
      args.push("--to", target);
    } else {
      args.push("--from", target);
    }
    if (options.kind !== undefined && options.kind !== "")
      args.push("--kind", options.kind);
    args.push("--json");
    return this.runJsonCommand(args, signal);
  }

  /** Extract strings and their references from a binary. */
  async strings(
    binaryPath: string,
    options: KunaStringsOptions = {},
    signal?: AbortSignal | undefined,
  ): Promise<unknown> {
    const args = ["strings", binaryPath, "--json"];
    if (options.minLength !== undefined)
      args.push("--min-length", String(options.minLength));
    if (options.filter !== undefined && options.filter !== "")
      args.push("--filter", options.filter);
    if (options.section !== undefined && options.section !== "")
      args.push("--section", options.section);
    return this.runJsonCommand(args, signal);
  }

  /** Unpack a packed binary (e.g. UPX or known runtime packers). */
  async unpack(
    binaryPath: string,
    outPath?: string | undefined,
    signal?: AbortSignal | undefined,
  ): Promise<unknown> {
    const args = ["unpack", binaryPath];
    if (outPath !== undefined && outPath !== "") args.push("-o", outPath);
    args.push("--json");
    return this.runJsonCommand(args, signal);
  }
}
