import type { AirtableRecord } from "./airtable";
import type { Resume } from "../validation/schemas";

export const RESUME_AIRTABLE_FIELDS = {
  id: "id",
  userId: "user_id",
  highestEducation: "highest_education",
  stepCompleted: "step_completed",
  desiredLocations: "desired_locations",
  desiredRoles: "desired_roles",
  desiredIndustries: "desired_industries",
  selfPrDraft: "selfpr_draft",
  selfPrFinal: "selfpr_final",
  summaryDraft: "summary_draft",
  summaryFinal: "summary_final",
  createdAt: "created_at",
  updatedAt: "updated_at",
} as const;

type AirtableFields = Record<string, unknown>;

export function airtableToResume(record: AirtableRecord<AirtableFields>): Resume {
  const f = record.fields;
  return {
    id: String(f[RESUME_AIRTABLE_FIELDS.id]),
    userId: String(f[RESUME_AIRTABLE_FIELDS.userId]),
    highestEducation: f[RESUME_AIRTABLE_FIELDS.highestEducation] as string | undefined,
    stepCompleted: f[RESUME_AIRTABLE_FIELDS.stepCompleted] as number | undefined,
    selfPr: {
      draft: (f[RESUME_AIRTABLE_FIELDS.selfPrDraft] as string | undefined) ?? "",
      final: (f[RESUME_AIRTABLE_FIELDS.selfPrFinal] as string | undefined) ?? "",
    },
    summary: {
      draft: (f[RESUME_AIRTABLE_FIELDS.summaryDraft] as string | undefined) ?? "",
      final: (f[RESUME_AIRTABLE_FIELDS.summaryFinal] as string | undefined) ?? "",
    },
    desired: {
      locations: (f[RESUME_AIRTABLE_FIELDS.desiredLocations] as string[] | undefined) ?? [],
      roles: (f[RESUME_AIRTABLE_FIELDS.desiredRoles] as string[] | undefined) ?? [],
      industries:
        (f[RESUME_AIRTABLE_FIELDS.desiredIndustries] as string[] | undefined) ?? [],
    },
  };
}

export function resumeToAirtableFields(resume: Resume): AirtableFields {
  return {
    [RESUME_AIRTABLE_FIELDS.id]: resume.id,
    [RESUME_AIRTABLE_FIELDS.userId]: resume.userId,
    [RESUME_AIRTABLE_FIELDS.highestEducation]: resume.highestEducation ?? null,
    [RESUME_AIRTABLE_FIELDS.stepCompleted]: resume.stepCompleted ?? null,
    [RESUME_AIRTABLE_FIELDS.selfPrDraft]: resume.selfPr?.draft ?? "",
    [RESUME_AIRTABLE_FIELDS.selfPrFinal]: resume.selfPr?.final ?? "",
    [RESUME_AIRTABLE_FIELDS.summaryDraft]: resume.summary?.draft ?? "",
    [RESUME_AIRTABLE_FIELDS.summaryFinal]: resume.summary?.final ?? "",
    [RESUME_AIRTABLE_FIELDS.desiredLocations]: resume.desired?.locations ?? [],
    [RESUME_AIRTABLE_FIELDS.desiredRoles]: resume.desired?.roles ?? [],
    [RESUME_AIRTABLE_FIELDS.desiredIndustries]: resume.desired?.industries ?? [],
  };
}
