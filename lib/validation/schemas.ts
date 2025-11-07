import { z } from "zod";

const currentYear = new Date().getFullYear();

const digitPattern = /^[0-9]+$/u;

function createDobNumberSchema({
  min,
  max,
  requiredMessage,
  invalidMessage,
  rangeMessage,
}: {
  min: number;
  max: number;
  requiredMessage: string;
  invalidMessage: string;
  rangeMessage: string;
}) {
  const stringInput = z
    .string({ error: requiredMessage })
    .trim()
    .min(1, { message: requiredMessage })
    .regex(digitPattern, { message: invalidMessage })
    .transform((value) => Number(value));

  const numberInput = z
    .number({ error: invalidMessage })
    .refine((value) => Number.isInteger(value), { message: invalidMessage });

  return z
    .union([stringInput, numberInput])
    .pipe(
      z
        .number({ error: invalidMessage })
        .min(min, { message: rangeMessage })
        .max(max, { message: rangeMessage })
    );
}

export const DobSchema = z
  .object({
    year: createDobNumberSchema({
      min: 1900,
      max: currentYear,
      requiredMessage: "生年を選択してください",
      invalidMessage: "生年は数字で入力してください",
      rangeMessage: `1900年から${currentYear}年までを選択してください`,
    }),
    month: createDobNumberSchema({
      min: 1,
      max: 12,
      requiredMessage: "月を選択してください",
      invalidMessage: "月は数字で入力してください",
      rangeMessage: "1月から12月の範囲で選択してください",
    }),
    day: createDobNumberSchema({
      min: 1,
      max: 31,
      requiredMessage: "日を選択してください",
      invalidMessage: "日は数字で入力してください",
      rangeMessage: "1日から31日の範囲で選択してください",
    }),
  })
  .superRefine((value, ctx) => {
    const date = new Date(value.year, value.month - 1, value.day);
    if (
      date.getFullYear() !== value.year ||
      date.getMonth() !== value.month - 1 ||
      date.getDate() !== value.day
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "存在しない日付です",
        path: ["day"],
      });
    }
  });

function requiredName(message: string) {
  return z
    .string({ error: message })
    .trim()
    .min(1, { message })
    .max(100, "100文字以内で入力してください");
}

export const BasicInfoSchema = z.object({
  lastName: requiredName("姓を入力してください"),
  firstName: requiredName("名を入力してください"),
  dob: DobSchema,
  gender: z.enum(["male", "female", "none"]).default("none"),
});

export type BasicInfo = z.infer<typeof BasicInfoSchema>;
export type DobValue = z.infer<typeof DobSchema>;

export const BasicInfoPartialSchema = z.object({
  lastName: requiredName("姓を入力してください").optional(),
  firstName: requiredName("名を入力してください").optional(),
  dob: DobSchema.partial().optional(),
  gender: z.enum(["male", "female", "none"]).optional(),
});

export type BasicInfoPartial = z.infer<typeof BasicInfoPartialSchema>;

export const ResumeStatusSchema = z.object({
  eduStatus: z.enum(["在学中", "卒業済み"]),
  joinTiming: z.enum(["すぐ", "3ヶ月以内", "半年以内", "1年以内", "いい所があれば"]),
  jobChangeCount: z.enum([
    "1",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "10回以上",
  ]),
});

export type ResumeStatus = z.infer<typeof ResumeStatusSchema>;

const yearMonthSchema = z
  .string({ required_error: "年月を入力してください" })
  .regex(/^[0-9]{4}-(0[1-9]|1[0-2])$/u, "YYYY-MM形式で入力してください");

export const EducationItemSchema = z
  .object({
    schoolName: z
      .string({ required_error: "学校名を入力してください" })
      .trim()
      .min(1, "学校名を入力してください")
      .max(120, "120文字以内で入力してください"),
    faculty: z
      .string()
      .trim()
      .max(120, "120文字以内で入力してください")
      .optional()
      .or(z.literal("")),
    start: yearMonthSchema,
    end: yearMonthSchema.optional().or(z.literal("")),
    present: z.boolean().default(false),
  })
  .superRefine((value, ctx) => {
    if (value.present && value.end && value.end !== "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "在学中の場合は終了年月を空にしてください",
        path: ["end"],
      });
      return;
    }

    if (!value.present && value.end && value.end < value.start) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "終了年月は開始年月以降を入力してください",
        path: ["end"],
      });
    }
  });

export const EducationListSchema = z
  .array(EducationItemSchema)
  .min(1, "学歴を1件以上追加してください");
