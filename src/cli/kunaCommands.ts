import { z } from "incur";
import { resolve } from "node:path";
import type { Logger } from "pino";
import { KunaProvider } from "../kuna/KunaProvider.js";
import { CLI_COMMANDS } from "../cliCommandNames.js";
import { logCliCommand } from "../cliLogging.js";
import { withCommandCancellation } from "./commandCancellation.js";
import type { CliInstance } from "./types.js";

/** Register one-shot CLI commands for Kuna binary analysis. */
export const registerKunaCommands = (
  cli: CliInstance,
  logger: Logger,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  provider: KunaProvider = new KunaProvider(environment),
): void => {
  cli.command(CLI_COMMANDS.kunaFunctions, {
    description:
      "Inventory functions and runtime detection using Kuna's embedded Sleigh engine",
    args: z.object({
      path: z.string().describe("Target binary file path"),
    }),
    options: z.object({
      summary: z
        .boolean()
        .default(false)
        .describe("Print function size summary and runtime statistics"),
      jobs: z
        .string()
        .optional()
        .describe("Number of parallel jobs or 'auto'"),
    }),
    run: ({ args, options }) =>
      withCommandCancellation((signal) =>
        logCliCommand(logger, CLI_COMMANDS.kunaFunctions, () =>
          provider.functions(resolve(args.path), options, signal),
        ),
      ),
  });

  cli.command(CLI_COMMANDS.kunaDecompile, {
    description: "Decompile a function or address to C using Kuna",
    args: z.object({
      path: z.string().describe("Target binary file path"),
      target: z
        .string()
        .describe("Function name or address (e.g. main or 0x401000)"),
    }),
    options: z.object({
      addr: z
        .boolean()
        .default(false)
        .describe("Treat target as a virtual memory address"),
      language: z
        .string()
        .optional()
        .describe("Decompilation target language (c, rust, auto)"),
      mode: z
        .string()
        .optional()
        .describe("Decompilation mode (auto, reliable, aggressive, fast)"),
    }),
    run: ({ args, options }) =>
      withCommandCancellation((signal) =>
        logCliCommand(logger, CLI_COMMANDS.kunaDecompile, () =>
          provider.decompile(resolve(args.path), args.target, options, signal),
        ),
      ),
  });

  cli.command(CLI_COMMANDS.kunaDisassemble, {
    description: "Disassemble instructions for a function or address using Kuna",
    args: z.object({
      path: z.string().describe("Target binary file path"),
      target: z.string().describe("Function name or address range"),
    }),
    options: z.object({
      addr: z
        .boolean()
        .default(false)
        .describe("Treat target as a virtual memory address"),
      mode: z
        .string()
        .optional()
        .describe("Analysis mode (auto, reliable, aggressive, fast)"),
    }),
    run: ({ args, options }) =>
      withCommandCancellation((signal) =>
        logCliCommand(logger, CLI_COMMANDS.kunaDisassemble, () =>
          provider.disassemble(resolve(args.path), args.target, options, signal),
        ),
      ),
  });

  cli.command(CLI_COMMANDS.kunaCrypto, {
    description:
      "Scan a binary for cryptographic constants and algorithms using Kuna",
    args: z.object({
      path: z.string().describe("Target binary file path"),
    }),
    options: z.object({
      algorithm: z
        .string()
        .optional()
        .describe("Filter by cryptographic algorithm substring"),
      section: z.string().optional().describe("Filter by section name"),
    }),
    run: ({ args, options }) =>
      withCommandCancellation((signal) =>
        logCliCommand(logger, CLI_COMMANDS.kunaCrypto, () =>
          provider.crypto(resolve(args.path), options, signal),
        ),
      ),
  });

  cli.command(CLI_COMMANDS.kunaXrefs, {
    description:
      "Trace cross-references to or from a function or address using Kuna",
    args: z.object({
      path: z.string().describe("Target binary file path"),
      target: z.string().describe("Function name or address"),
    }),
    options: z.object({
      from: z
        .boolean()
        .default(false)
        .describe(
          "Find references FROM this target (outgoing calls/data references)",
        ),
      to: z
        .boolean()
        .default(true)
        .describe("Find references TO this target (incoming callers)"),
      kind: z
        .string()
        .optional()
        .describe("Reference kind filter (call,jump,data,read,write)"),
    }),
    run: ({ args, options }) =>
      withCommandCancellation((signal) =>
        logCliCommand(logger, CLI_COMMANDS.kunaXrefs, () => {
          const direction = options.from ? "from" : "to";
          return provider.xrefs(
            resolve(args.path),
            args.target,
            direction,
            { kind: options.kind },
            signal,
          );
        }),
      ),
  });

  cli.command(CLI_COMMANDS.kunaStrings, {
    description: "Extract strings and cross-references from a binary using Kuna",
    args: z.object({
      path: z.string().describe("Target binary file path"),
    }),
    options: z.object({
      minLength: z
        .number()
        .optional()
        .describe("Minimum string length"),
      filter: z
        .string()
        .optional()
        .describe("Regex filter for extracted strings"),
      section: z.string().optional().describe("Filter by section name"),
    }),
    run: ({ args, options }) =>
      withCommandCancellation((signal) =>
        logCliCommand(logger, CLI_COMMANDS.kunaStrings, () =>
          provider.strings(resolve(args.path), options, signal),
        ),
      ),
  });
};
