# Codex 実装プロンプト（Core プラン）

## 1. 目的の要約
Vercel のビルドエラー（クライアントページへの `export const revalidate` 追加など）を再発させないよう配慮しつつ、既存のタブ UI・Gemini ラッパー・レート制限ロジックを前提に、/cv/2・/cv/3 ページと関連 AI API 群を一括実装できる Codex 用プロンプトを整理する。

## 2. Core プラン
### やること
- 既存のクライアント UI 構造（Tabs コンポーネント、`'use client'` ページ）を踏襲し、再生成フローや入力検証を指示する。
- Gemini API ラッパー（`lib/ai/gemini.ts`）のタイムアウト・再試行・usage トークン抽出・Abort 408 変換など既存仕様を尊重するよう明記。
- レート制限キーの決定（cookie `anon_key` → IP ヘッダ → `'unknown'`）と 1 時間 10 回の制限を `lib/utils/rate-limit.ts` の Map ベース実装で実現するよう指示。
- Airtable 更新時のフィールド取り扱い（`selfpr_{draft|final}` / `summary_{draft|final}`）と `CvQa` JSON の zod 検証、`source_env` / `pr_ref` 自動付与前提を記述。
- API レスポンスエラー形式 `{code, message, correlationId}` と 429/500 系時の安全な文面を提示。
- 必須入力が揃うまでボタン無効化、生成後テキストエリア表示、文字数カウント（自己PR 400–800, Summary 200–400）など UI 振る舞いを指示。
- 保存・再訪問時のデータ同期と `/api/data/resume` フェッチで QA 情報/ID を取得する流れを明記。

### やらないこと
- 追加のビルド設定変更や新規依存追加の指示。
- 既存 UI/UX を大きく変える仕様変更。
- クライアントページへの `export const revalidate` / `dynamic` 等サーバーメタデータの追加。

### ファイルツリー（変更対象）
```
app/
  cv/
    2/page.tsx
    3/page.tsx
  api/
    ai/
      selfpr/route.ts
      summary/route.ts
lib/
  ai/gemini.ts
  utils/
    rate-limit.ts
    correlation.ts
  validation/schemas.ts
components/ui/
  Button.tsx
  Tabs.tsx
```

### Codex への指示文
```
フェーズ4最終版: Next.js(App Router)+TypeScript。Airtable REST。以下を満たすコードだけ書く。既存のクライアントページは 'use client' のまま、絶対に export const revalidate/dynamic を追加しない。

対象ファイル:
- app/cv/2/page.tsx
- app/cv/3/page.tsx
- app/api/ai/selfpr/route.ts
- app/api/ai/summary/route.ts
- lib/ai/gemini.ts
- lib/validation/schemas.ts
- lib/utils/rate-limit.ts
- lib/utils/correlation.ts
- components/ui/Button.tsx
- components/ui/Tabs.tsx

UI (/cv/2, /cv/3):
- Tabs[自己PR|職務要約]。Keyboard accessible Tabs コンポーネント利用。
- gradient variant="ai" ボタン。生成中 disable & スピナー表示。再生成も同ハンドラで OK。
- 必須入力が揃うまで「AIで出力する」無効化。生成後に textarea 表示＋編集可。文字数カウント（自己PR 400–800, Summary 200–400）。
- 保存ボタンで /api/ai/* save アクションを呼び Airtable Resumes.selfpr_{draft|final}/summary_{draft|final} を更新。保存完了後は最新値を state に同期。ページ再訪でも保存済み内容をロード。
- 既存の不要テキスト（例: resumeId未設定）を表示しない。

API (/app/api/ai/*):
- runtime='nodejs' 維持。POST のみ。
- body: {resumeId, action:'generate'|'save'|'load', target:'draft'|'final', draft?}
- Rate limit: 10 req/h by anon_key cookie fallback IP (x-forwarded-for→x-real-ip→cf-connecting-ip→'unknown')。429 時 {code:'rate_limited', message?, correlationId}。
- エラーは {code,message,correlationId} JSON。Gemini 失敗時は安全なテンプレテキストを返す（空文字禁止）。
- 保存時 Airtable update に {source_env, pr_ref} を添付（lib/db/airtable.ts 側が自動付与する想定）。
- load/save で selfpr_* / summary_* を読み書き。CvQa JSON 解析 + スキーマ検証。

lib/ai/gemini.ts:
- generateGeminiText(prompt, ...)。既存の timeout 12s, 5xx 一回リトライ, usage tokens 抽出。DOMException Abort → 408。API key は env。
- 既存の nullish coalescing と論理演算の優先順位を保つ（括弧済み）。

Tabs/Button:
- Tabs: roving tab index, aria-controls, keyboard nav。
- Button: variant="ai" でグラデーション。loading prop で spinner 表示可。

rate-limit.ts:
- インメモリ (Map) でキーごとの timestamp 配列。window=1h。非同期不要。

correlation.ts:
- ensureCorrelationId(headerValue?) → UUIDv4 fallback。

検証:
- zod スキーマに自己PR/Summary 文字数制約を定数化して再利用。
- fetch('/api/data/resume') で QA 情報/ID を取得し state に保持。

コードは型安全・最小差分。コメントは最小限。外部 API 例外時は console.warn 程度に。
```

## 3. Bold プラン
- 提案: AI 生成結果に「要約レベル」スライダー（要約 / 標準 / 詳細）を導入し、Gemini 呼び出し時の `temperature` と `maxOutputTokens` を調整可能にする。
- 採用基準: ユーザーが文章量や情報量を細かく制御したい場合に採用。
- コスト: クライアント側でステートと UI を追加し、API リクエストにパラメータを渡す実装。追加テストが軽く必要。

## 4. 設定・環境変数
`.env.local`（ローカル専用）と Vercel 環境変数の両方に以下を設定すること:
- `GEMINI_API_KEY`
- `AIRTABLE_API_KEY`
- `AIRTABLE_BASE_ID`
- `AIRTABLE_TABLE_RESUMES`
- `SOURCE_ENV`
- `PR_REF`

## 5. 確認手順
### ローカル
1. `pnpm install`
2. `pnpm lint`
3. `pnpm dev` を起動し、`/cv/2` と `/cv/3` で生成→保存→再読込を確認

### Vercel Preview
1. 自動実行される `pnpm run build` が成功することを確認
2. `/api/ai/selfpr` と `/api/ai/summary` に対し、`generate` / `save` / `load` を curl で叩きレスポンス構造を検証

## 6. Idea Bank（将来メモ）
1. 生成テキストの自動要約/英訳を提供するサブ機能
2. Airtable から学習した共通フレーズのテンプレ推薦機能
3. QA 入力へのフィードバック（不足項目のガイド）を LLM で生成
