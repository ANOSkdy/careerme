import { z } from "zod";

const numberFromUnknown = z
  .union([z.number(), z.string().regex(/^-?\d+$/u)])
  .transform((value) => Number(value));

const stringArray = z
  .array(z.string().trim())
  .optional()
  .transform((value) => value ?? []);

const systemFields = {
  id: z.string(),
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  sourceEnv: z.string(),
  prRef: z.string().optional(),
};

export const DobSchema = z.object({
  year: numberFromUnknown,
  month: numberFromUnknown,
  day: numberFromUnknown,
});

export const UserSchema = z.object({
  ...systemFields,
  anonKey: z.string(),
});

export const ResumeSchema = z
  .object({
    ...systemFields,
    userId: z.string(),
    lastNameKanji: z.string().optional(),
    firstNameKanji: z.string().optional(),
    dob: DobSchema.optional(),
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
    stepCompleted: z.string().optional(),
  })
  .transform((value) => ({
    ...value,
    dobYear: value.dob?.year,
    dobMonth: value.dob?.month,
    dobDay: value.dob?.day,
  }));

export const EducationSchema = z.object({
  ...systemFields,
  resumeId: z.string(),
  schoolName: z.string().optional(),
  faculty: z.string().optional(),
  department: z.string().optional(),
  admissionYear: numberFromUnknown.optional(),
  graduationYear: numberFromUnknown.optional(),
});

export const WorkSchema = z.object({
  ...systemFields,
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

export const LookupSchema = z.object({
  ...systemFields,
  group: z.string(),
  value: z.string(),
  order: numberFromUnknown.optional(),
  isActive: z.boolean().optional(),
});

export type DobValue = z.infer<typeof DobSchema>;
export type UserInput = z.infer<typeof UserSchema>;
export type ResumeInput = z.infer<typeof ResumeSchema>;
export type EducationInput = z.infer<typeof EducationSchema>;
export type WorkInput = z.infer<typeof WorkSchema>;
export type LookupInput = z.infer<typeof LookupSchema>;
