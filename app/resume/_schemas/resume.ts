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

export type ResumeRecord = {
  draftId: string;
  step1?: Step1 | null;
  step2?: Step2 | null;
};

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
