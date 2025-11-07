import type { CvQa } from "../validation/schemas";

export type SelfPrPromptExtras = {
  experienceSummary?: string | null | undefined;
};

function normalize(text: string | null | undefined): string {
  return (text ?? "").trim();
}

export function buildSelfPrPrompt(
  qa: CvQa,
  extras: SelfPrPromptExtras = {}
): string {
  const lines: string[] = [];
  lines.push(
    "あなたは経験豊富なキャリアアドバイザーです。候補者の情報から日本語の自己PR文を作成してください。"
  );
  lines.push("出力要件:");
  lines.push("- 文字数は300〜500文字に収めること。");
  lines.push("- 3段落構成: 第1段落は要約、第2段落は強みを示す具体的なエピソード、第3段落は志向と希望職種。"
  );
  lines.push("- 語調はビジネスで丁寧に。個人名や機密情報、事実に基づかない誇張は禁止。"
  );
  lines.push("- 明確な成果や数値が無い場合は文脈から自然に補完し、信頼できる表現に調整すること。"
  );
  lines.push("");
  lines.push("以下のQ&Aをもとに作成してください:");
  lines.push(`Q1 強み・自己PR: ${qa.q1}`);
  lines.push(`Q2 強みを示すエピソード: ${qa.q2}`);
  lines.push(`Q3 仕事で大切にしていること: ${qa.q3}`);
  lines.push(`Q4 希望する役割: ${qa.q4}`);

  const summary = normalize(extras.experienceSummary);
  if (summary) {
    lines.push("");
    lines.push("職歴の要約:");
    lines.push(summary);
  }

  lines.push("");
  lines.push("これらを踏まえ、指示に沿った自己PR文を出力してください。");

  return lines.join("\n");
}
