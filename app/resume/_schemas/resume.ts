import { z } from "zod";

export const Step1Schema = z.object({
  fullName: z.string().min(1, "氏名は必須です"),
  email: z.string().email("メール形式が不正です"),
  phone: z.string().optional(),
});
export type Step1 = z.infer<typeof Step1Schema>;

export const Step2Schema = z.object({
  status: z.enum(["employed", "seeking", "student", "other"], {
    required_error: "ステータスは必須です",
  }),
  note: z.string().max(200, "200文字以内で入力してください").optional(),
});
export type Step2 = z.infer<typeof Step2Schema>;

export type ResumeRecord = {
  draftId: string;
  step1?: Step1 | null;
  step2?: Step2 | null;
};
