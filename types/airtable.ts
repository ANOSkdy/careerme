import { z } from "zod";

export interface AirtableSystemFields {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  sourceEnv: string;
  prRef?: string;
}

export interface AirtableUser extends AirtableSystemFields {
  anonKey: string;
}

export interface AirtableResume extends AirtableSystemFields {
  userId: string;
  lastNameKanji?: string;
  firstNameKanji?: string;
  dob?: AirtableDob;
  dobYear?: number;
  dobMonth?: number;
  dobDay?: number;
  gender?: string;
  schoolStatus?: string;
  desiredStartWhen?: string;
  jobChangeCount?: number;
  highestEducation?: string;
  desiredLocations?: string[];
  desiredRoles?: string[];
  desiredIndustries?: string[];
  selfprDraft?: string;
  selfprFinal?: string;
  summaryDraft?: string;
  summaryFinal?: string;
  pdfUrl?: string;
  stepCompleted?: number;
}

export interface AirtableEducation extends AirtableSystemFields {
  resumeId: string;
  schoolName?: string;
  faculty?: string;
  department?: string;
  admissionYear?: number;
  graduationYear?: number;
}

export interface AirtableWork extends AirtableSystemFields {
  resumeId: string;
  company?: string;
  division?: string;
  title?: string;
  startYm?: string;
  endYm?: string;
  roles?: string[];
  industries?: string[];
  toolsText?: string;
  qJobDesc?: string;
  qTools?: string;
  qTasks?: string;
  qProblem?: string;
  qAction?: string;
  qResult?: string;
  qualifications?: string;
}

export interface AirtableLookup extends AirtableSystemFields {
  group: string;
  value: string;
  order?: number;
  isActive?: boolean;
}

export const numberFromUnknown = z
  .union([z.number(), z.string().regex(/^-?\d+$/u)])
  .transform((value) => Number(value));

export const stringArray = z
  .array(z.string())
  .optional()
  .transform((value) => value ?? []);

export const AirtableDobSchema = z.object({
  year: numberFromUnknown,
  month: numberFromUnknown,
  day: numberFromUnknown,
});

export const AirtableSystemSchema = z.object({
  id: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  sourceEnv: z.string(),
  prRef: z.string().optional(),
});

export const AirtableUserSchema = AirtableSystemSchema.extend({
  anonKey: z.string(),
});

export const AirtableResumeSchema = AirtableSystemSchema.extend({
  userId: z.string(),
  lastNameKanji: z.string().optional(),
  firstNameKanji: z.string().optional(),
  dob: AirtableDobSchema.optional(),
  gender: z.string().optional(),
  schoolStatus: z.string().optional(),
  desiredStartWhen: z.string().optional(),
  jobChangeCount: numberFromUnknown.optional(),
  highestEducation: z.string().optional(),
  desiredLocations: stringArray,
  desiredRoles: stringArray,
  desiredIndustries: stringArray,
  selfprDraft: z.string().optional(),
  selfprFinal: z.string().optional(),
  summaryDraft: z.string().optional(),
  summaryFinal: z.string().optional(),
  pdfUrl: z.string().url().optional(),
  stepCompleted: numberFromUnknown.optional(),
});

export const AirtableEducationSchema = AirtableSystemSchema.extend({
  resumeId: z.string(),
  schoolName: z.string().optional(),
  faculty: z.string().optional(),
  department: z.string().optional(),
  admissionYear: numberFromUnknown.optional(),
  graduationYear: numberFromUnknown.optional(),
});

export const AirtableWorkSchema = AirtableSystemSchema.extend({
  resumeId: z.string(),
  company: z.string().optional(),
  division: z.string().optional(),
  title: z.string().optional(),
  startYm: z.string().optional(),
  endYm: z.string().optional(),
  roles: stringArray,
  industries: stringArray,
  toolsText: z.string().optional(),
  qJobDesc: z.string().optional(),
  qTools: z.string().optional(),
  qTasks: z.string().optional(),
  qProblem: z.string().optional(),
  qAction: z.string().optional(),
  qResult: z.string().optional(),
  qualifications: z.string().optional(),
});

export const AirtableLookupSchema = AirtableSystemSchema.extend({
  group: z.string(),
  value: z.string(),
  order: numberFromUnknown.optional(),
  isActive: z.boolean().optional(),
});

export type AirtableDob = z.infer<typeof AirtableDobSchema>;
export type AirtableUserRecord = z.infer<typeof AirtableUserSchema>;
export type AirtableResumeRecord = z.infer<typeof AirtableResumeSchema>;
export type AirtableEducationRecord = z.infer<typeof AirtableEducationSchema>;
export type AirtableWorkRecord = z.infer<typeof AirtableWorkSchema>;
export type AirtableLookupRecord = z.infer<typeof AirtableLookupSchema>;
