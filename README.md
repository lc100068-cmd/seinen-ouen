# 青年委員 応援カレンダー

倫理法人会の講話・モーニングセミナー予定を共有し、参加表明と登壇者への応援メッセージを送れる Web アプリです。

- 公開ページ: https://claude.ai/artifact/GCe64RuSzaueWQyv4hSy5C
- 本体: `index.html`（claude.ai Artifact として動作。データは Artifact の共有データベースに保存）

## 機能
- 月間カレンダーと予定一覧（単会名・会場・住所・講話者）。会場名から Google マップを開けます
- 「参加する」ボタンで名前付き参加表明（自分の登録は取り消し可）
- 登壇者ごとに応援メッセージを投稿し、掲示板形式で表示（登壇者で絞り込み可）
- 運営者（共有設定で Editor 以上）だけに「予定を追加・編集・削除」フォームを表示

## 権限（共有メニューで設定）
| 役割 | 共有設定 | できること |
|---|---|---|
| 運営者 | Editor | 予定の追加・編集・削除、不適切な投稿の削除 |
| 参加者 | Contributor | 参加表明、応援メッセージ投稿 |
| 閲覧のみ | Viewer | 見るだけ |

## データ構造
- `events/{id}`: date, time, unit, venue, address, notice, speakers[{name,title}], note（書き込みは運営者のみ）
- `rsvps/{id}`: eventId, name, uid, createdAt
- `messages/{id}`: eventId, to, from, text, uid, createdAt
