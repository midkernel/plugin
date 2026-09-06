import { z } from "zod";

export const SCAN_PROFILES = ["low", "balanced", "max"] as const;

export type ScanProfile = (typeof SCAN_PROFILES)[number];

/** Optional `--threat` value. A pin onto an existing profile, never a fourth profile. */
export type ThreatPin = string;

export const profileSchema = z.enum(SCAN_PROFILES, {
  errorMap: (issue, ctx) => {
    if (issue.code === "invalid_enum_value" || issue.code === "invalid_type") {
      return {
        message:
          `profile is required and must be one of: ${SCAN_PROFILES.join(", ")}. ` +
          `threat is an optional pin, not a profile. Received: ${JSON.stringify(ctx.data)}`,
      };
    }
    return { message: ctx.defaultError };
  },
});

const threatPinSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : null));

export function isScanProfile(value: unknown): value is ScanProfile {
  return profileSchema.safeParse(value).success;
}

export function parseProfile(value: unknown): ScanProfile {
  const parsed = profileSchema.safeParse(value);
  if (!parsed.success) {
    throw new InvalidProfileError(value, parsed.error.issues[0]?.message);
  }
  return parsed.data;
}

export class InvalidProfileError extends Error {
  readonly code = "INVALID_PROFILE" as const;

  constructor(
    readonly received: unknown,
    message?: string,
  ) {
    super(
      message ??
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
  return {
    threat: threatPinSchema.parse(threat),
    role: "pin",
  };
}
