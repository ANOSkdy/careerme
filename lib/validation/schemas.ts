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
