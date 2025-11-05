import { z } from "zod";

export const Step1Schema = z.object({
  fullName: z.string().min(1, "氏名は必須です"),
  email: z.string().email("メール形式が不正です"),
  phone: z.string().optional(),
});
export type Step1 = z.infer<typeof Step1Schema>;

export const Step2Schema = z.object({
  status: z.enum(["employed", "seeking", "student", "other"], "ステータスは必須です"),
  note: z.string().max(200, "200文字以内で入力してください").optional(),
});
export type Step2 = z.infer<typeof Step2Schema>;

const ym = z
  .string()
  .regex(/^[0-9]{4}-[0-9]{2}$/u, "年月はYYYY-MM形式で入力してください");

export const EducationItemSchema = z
  .object({
    school: z.string().min(1, "学校名は必須です"),
    degree: z.string().optional(),
    start: ym,
    end: ym.optional(),
    current: z.boolean().optional(),
    description: z.string().max(500, "500文字以内で入力してください").optional(),
  })
  .refine((value) => !value.end || value.end >= value.start, {
    path: ["end"],
    message: "終了は開始以降の日付を入力してください",
  });

export type EducationItem = z.infer<typeof EducationItemSchema>;

export const EducationListSchema = z
  .array(EducationItemSchema)
  .min(1, "少なくとも1件の学歴を追加してください");

const tagValue = z
  .string()
  .trim()
  .min(1, "1文字以上で入力してください")
  .max(50, "50文字以内で入力してください");

const tagArray = z.array(tagValue).max(20, "タグは20件までです");

export const WorkItemSchema = z
  .object({
    id: z.string().optional(),
    company: z.string().min(1, "会社名は必須です"),
    title: z.string().max(120, "120文字以内で入力してください").optional(),
    startYm: ym,
    endYm: z.union([ym, z.literal(""), z.undefined()]).optional(),
    roles: tagArray.default([]),
    industries: tagArray.default([]),
    details: z
      .string()
      .max(800, "800文字以内で入力してください")
      .optional(),
  })
  .refine(
    (value) => {
      if (!value.endYm || value.endYm === "") return true;
      return value.endYm >= value.startYm;
    },
    {
      path: ["endYm"],
      message: "終了年月は開始年月以降を入力してください",
    }
  );

export type WorkItem = z.infer<typeof WorkItemSchema>;

export const WorkListSchema = z
  .array(WorkItemSchema)
  .min(1, "少なくとも1件の職歴を追加してください");

export const DesiredSchema = z.object({
  roles: tagArray.default([]),
  industries: tagArray.default([]),
  locations: tagArray.default([]),
});

export type Desired = z.infer<typeof DesiredSchema>;

export type ResumeRecord = {
  draftId: string;
  step1?: Step1 | null;
  step2?: Step2 | null;
  works?: WorkItem[] | null;
  desired?: Desired | null;
};
