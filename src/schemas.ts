import { z } from "zod";
import { profileSchema } from "./profiles.js";

export { profileSchema };

export const optionalTrimmedString = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value && value.length > 0 ? value : undefined));

export const repoRefSchema = z.object({
  owner: z.string().trim().min(1, "owner is required"),
  name: z.string().trim().min(1, "name is required"),
});

function bothOrNeitherOwnerName(
  value: { owner?: string; name?: string },
  ctx: z.RefinementCtx,
  message: string,
): void {
  const hasOwner = Boolean(value.owner);
  const hasName = Boolean(value.name);
  if (hasOwner !== hasName) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message,
      path: hasOwner ? ["name"] : ["owner"],
    });
  }
}

export const connectRepoSchema = z
  .object({
    owner: optionalTrimmedString,
    name: optionalTrimmedString,
  })
  .superRefine((value, ctx) =>
    bothOrNeitherOwnerName(
      value,
      ctx,
      "Pass both owner and name to select a repo, or omit both to list installation repos.",
    ),
  );

export const startRunSchema = z
  .object({
    profile: profileSchema,
    threat: optionalTrimmedString,
    owner: optionalTrimmedString,
    name: optionalTrimmedString,
    playbook: optionalTrimmedString,
  })
  .superRefine((value, ctx) =>
    bothOrNeitherOwnerName(
      value,
      ctx,
      "To target a repo, pass both owner and name (or select one with connect_repo first).",
    ),
  );

export const fetchRunSchema = z.object({
  runId: optionalTrimmedString,
});

export const listPlaybooksSchema = z.object({});

export const githubContentItemSchema = z.object({
  type: z.string().optional(),
  name: z.string().optional(),
  path: z.string().optional(),
  html_url: z.string().optional(),
  url: z.string().optional(),
});

export const githubContentsSchema = z.array(githubContentItemSchema);

export const githubDirSchema = z.object({
  type: z.literal("dir"),
  name: z.string().optional(),
  url: z.string().min(1),
});

export type GithubContentItem = z.infer<typeof githubContentItemSchema>;
export type GithubContents = z.infer<typeof githubContentsSchema>;
export type ConnectRepoInput = z.input<typeof connectRepoSchema>;
export type StartRunInput = z.input<typeof startRunSchema>;
export type FetchRunInput = z.input<typeof fetchRunSchema>;
export type RepoRef = z.infer<typeof repoRefSchema>;
