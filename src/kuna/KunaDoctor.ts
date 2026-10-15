import type {
  DoctorProviderCheck,
  DoctorProviderInspection,
} from "../application/Doctor.js";
import {
  inspectKunaClient,
  KUNA_COMMAND_ENV,
  resolveKunaCommand,
} from "./KunaConfiguration.js";

/** Doctor check that verifies the availability and version of Kuna. */
export const inspectKunaProvider = async (
  environment: Readonly<Record<string, string | undefined>> = process.env,
): Promise<DoctorProviderInspection> => {
  const selection = resolveKunaCommand(environment);
  const configured = environment[KUNA_COMMAND_ENV] !== undefined;
  const identity = await inspectKunaClient(selection, undefined, environment);

  const checks: readonly DoctorProviderCheck[] = [
    {
      name: "kuna_executable",
      ok: identity.available,
      code: identity.available ? null : "missing_dependency",
      classification: configured ? "config_drift" : "missing_analysis_engine",
      detail: identity.available
        ? `Found ${selection.command} (version: ${identity.version ?? "unknown"}) via ${selection.commandSource}`
        : `Kuna CLI was not found at ${selection.command}: ${identity.error ?? "binary missing"}`,
      remediation: identity.available
        ? null
        : `Install kuna on PATH (e.g. ~/.local/bin/kuna) or set ${KUNA_COMMAND_ENV} to the executable path.`,
    },
  ];

  return {
    id: "kuna",
    configured,
    available: identity.available,
    providerVersion: identity.version,
    registrationEnvironment: configured
      ? { [KUNA_COMMAND_ENV]: selection.command }
      : {},
    checks,
  };
};
