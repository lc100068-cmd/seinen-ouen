#!/usr/bin/env python3
"""グループLINEに貼る「今週の予定」の文章を作る。

使い方:
  python3 scripts/weekly_post.py              # 次の月曜（今日が月曜なら今日）から始まる1週間
  python3 scripts/weekly_post.py 2026-10-12   # 指定した日から7日間

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

def build(start, evs):
    end = start + dt.timedelta(days=6)
    week = [e for e in evs if start.isoformat() <= e["date"] <= end.isoformat()]
    head = f"【今週の倫理法人会 モーニングセミナー】\n{start.month}/{start.day}（{WD[start.weekday()]}）〜{end.month}/{end.day}（{WD[end.weekday()]}）"
    if not week:
        return head + "\n\n今週の予定はありません。\n\n▼ 予定一覧・参加登録・応援メッセージ\n" + PAGE_URL
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
    if len(sys.argv) > 1:
        start = dt.date.fromisoformat(sys.argv[1])
    else:
        today = dt.date.today()
        start = today + dt.timedelta(days=(7 - today.weekday()) % 7)
    print(build(start, events()))

if __name__ == "__main__":
    main()
