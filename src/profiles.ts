export const SCAN_PROFILES = ["low", "balanced", "max"] as const;

export type ScanProfile = (typeof SCAN_PROFILES)[number];

/** Optional `--threat` value. A pin onto an existing profile, never a fourth profile. */
export type ThreatPin = string;

export function isScanProfile(value: unknown): value is ScanProfile {
  return typeof value === "string" && (SCAN_PROFILES as readonly string[]).includes(value);
}

export function parseProfile(value: unknown): ScanProfile {
  if (!isScanProfile(value)) {
    throw new InvalidProfileError(value);
  }
  return value;
}

export class InvalidProfileError extends Error {
  readonly code = "INVALID_PROFILE" as const;

  constructor(readonly received: unknown) {
    super(
      `profile is required and must be one of: ${SCAN_PROFILES.join(", ")}. ` +
        `threat is an optional pin, not a profile. Received: ${JSON.stringify(received)}`,
    );
    this.name = "InvalidProfileError";
  }
}

export function describeThreatPin(threat: string | undefined): {
  threat: string | null;
  role: "pin";
} {
  const trimmed = threat?.trim() ?? "";
  return {
    threat: trimmed.length > 0 ? trimmed : null,
    role: "pin",
  };
}
