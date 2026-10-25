#!/usr/bin/env python3
"""グループLINEに貼る「今週の予定」の文章を作る。

使い方:
  python3 scripts/weekly_post.py              # 次の月曜（今日が月曜なら今日）から始まる1週間
  python3 scripts/weekly_post.py 2026-10-12   # 指定した日から7日間
  python3 scripts/weekly_post.py 2026-10      # 指定した月の全予定（月間一覧）

予定はスプレッドシート（config.js の URL）から読み込む。
"""
import datetime as dt, json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGE_URL = "https://lc100068-cmd.github.io/seinen-ouen/"
WD = "月火水木金土日"

def api_url():
    src = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
    return re.search(r'SEINEN_API_URL\s*=\s*"([^"]+)"', src).group(1)

def events():
    with urllib.request.urlopen(api_url() + "?action=list", timeout=60) as r:
        return json.loads(r.read().decode("utf-8")).get("events", [])

def build(start, evs, month=False):
    if month:
        end = (start.replace(day=28) + dt.timedelta(days=4)).replace(day=1) - dt.timedelta(days=1)
        head = f"【{start.month}月の倫理法人会 モーニングセミナー予定】"
        empty = "この月の予定はまだありません。"
    else:
        end = start + dt.timedelta(days=6)
        head = f"【今週の倫理法人会 モーニングセミナー】\n{start.month}/{start.day}（{WD[start.weekday()]}）〜{end.month}/{end.day}（{WD[end.weekday()]}）"
        empty = "今週の予定はありません。"
    week = [e for e in evs if start.isoformat() <= e["date"] <= end.isoformat()]
    if not week:
        return head + "\n\n" + empty + "\n\n▼ 予定一覧・参加登録・応援メッセージ\n" + PAGE_URL
    blocks = []
    for e in week:
        d = dt.date.fromisoformat(e["date"])
        lines = [f"■ {d.month}/{d.day}（{WD[d.weekday()]}）" + (f" {e['time']}〜" if e.get("time") else ""),
                 e["unit"] + (f"（{e['notice']}）" if e.get("notice") else ""),
                 "会場：" + e["venue"] + (f"（{e['address']}）" if e.get("address") else "")]
        sp = e.get("speakers", [])
        if len(sp) == 1:
            lines.append("講話：" + sp[0]["name"] + " 氏" + (f"（{sp[0]['title']}）" if sp[0].get("title") else ""))
        else:
            lines.append("講話：")
            lines += ["　・" + s["name"] + " 氏" + (f"（{s['title']}）" if s.get("title") else "") for s in sp]
        if e.get("note"):
            lines.append(e["note"])
        blocks.append("\n".join(lines))
    tail = "▼ 参加登録・登壇者への応援メッセージはこちら\n" + PAGE_URL
    return head + "\n\n" + "\n\n".join(blocks) + "\n\n" + tail

def main():
    if len(sys.argv) > 1 and re.fullmatch(r"\d{4}-\d{2}", sys.argv[1]):
        print(build(dt.date.fromisoformat(sys.argv[1] + "-01"), events(), month=True))
        return
    if len(sys.argv) > 1:
        start = dt.date.fromisoformat(sys.argv[1])
    else:
        today = dt.date.today()
        start = today + dt.timedelta(days=(7 - today.weekday()) % 7)
    print(build(start, events()))

if __name__ == "__main__":
    main()
