# draftId の扱い概要

## 役割
- ログイン不要の履歴書ドラフトを識別するためのクライアント生成 ID。
- Airtable 側でも `resumeId` と同じ値を匿名セッションのキーとして扱うが、`draftId` 専用列がなくても動作する。

## 生成・保持
- 履歴書の入力フロー（例: ExperienceForm, LocationForm）がクライアントで初回マウントした際、`localStorage` に `resume.resumeId` が無ければ `crypto.randomUUID()`（フォールバック: Math.random）で生成し保存する。以降のリクエストはこの値を `id`/`draftId` として送信する。

## サーバーでの利用
- 仕様変更により Airtable に `draftId` フィールドが無くても動くように統一。`id`/`resumeId` のみで検索・保存し、`draftId` クエリはエイリアスとして受け取る。
- `/api/data/resume` は `id` と `anonKey` を検索キーにし、既存レコードがあれば `id` を返す。保存時も `id` のみを更新する。
- `/api/data/experience` と `/api/data/education` でも `resumeId` を単一キーとして検索・保存する。

## Airtable 側の前提
- `draftId` 列は必須ではなくなった。`id`（`Resumes`）と `resumeId`（`Experiences` / `Educations`）だけがあれば動作する。
- 既存のベースに `draftId` 列があっても問題なく動作するが、無くても 422 エラーにならないようにしている。
