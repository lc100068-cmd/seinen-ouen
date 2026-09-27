# 青年委員 応援カレンダー — Claude Code 向けメモ

倫理法人会の講話・モーニングセミナー予定を共有するページ。データは Google スプレッドシート（GAS 経由）に保存し、ページは GitHub Pages（https://lc100068-cmd.github.io/seinen-ouen/ ）で公開している。

## 予定の追加・変更を頼まれたとき

`scripts/sheet_admin.py` でスプレッドシートの「予定」シートに直接書き込む（環境変数 `SEINEN_ADMIN_TOKEN` と、script.google.com / script.googleusercontent.com へのネットワーク許可が前提）。

1. `python3 scripts/sheet_admin.py list` で今の予定を読み、同じ回がないか確認する（変更なら既存の `id` を使う）
2. 予定を JSON にしてスクラッチパッドに保存し、`python3 scripts/sheet_admin.py upsert <file>` を実行する
   ```json
   {"id": "（変更時のみ）", "date": "2026-10-14", "time": "06:00", "unit": "那珂川市 倫理法人会",
    "venue": "キャプテン", "address": "那珂川市松木1-1", "notice": "", "note": "",
    "speakers": [{"name": "藤本 真理", "title": "那珂川市倫理法人会 副事務長／VOX.BodyDesign Lab. 代表"}]}
   ```
3. もう一度 `list` して反映を確認し、日本語で結果を伝える

表記の決まり:
- 開始時刻は指定がなければ `06:00`（どの会も6時）
- 単会名は「〇〇 倫理法人会」（市名などと「倫理法人会」の間に半角スペース）
- 講話者の氏名は「姓 名」（半角スペース）。肩書きは「所属 役職／屋号 役職」の形
- 会場変更などは `notice` に短く（赤字で表示される）
- 会場・住所が分からないときは空欄で入れず、ユーザーに確認する
- 予定の削除機能はない（ユーザーの方針）。取りやめ等は `notice` に書くか、スプレッドシートで直接対応してもらう

## その他
- 参加者・応援メッセージはスプレッドシートの「参加者」「応援メッセージ」シート。メールアドレスは表示・出力しない
- GAS のコードは `gas/Code.gs`。変更したらユーザーに Apps Script への貼り付けと「デプロイを管理 → 新バージョン」が必要（`CHROME_UPDATE_PROMPT.md` 参照）
- ユーザーへの返答は日本語で、専門用語を避けて分かりやすく
