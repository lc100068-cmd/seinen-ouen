#!/usr/bin/env python3
"""スプレッドシートの予定を Claude Code から追加・変更するための小さな道具。

使い方:
  python3 scripts/sheet_admin.py list
  python3 scripts/sheet_admin.py upsert event.json   # {"id"?, "date", "time", "unit", "venue", "address", "notice", "speakers": [{"name","title"}], "note"}

環境変数 SEINEN_ADMIN_TOKEN（GAS の createAdminToken で作った合言葉）が必要です。
ウェブアプリの URL は config.js から読み取ります。
"""
import json, os, re, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def api_url():
    src = open(os.path.join(ROOT, "config.js"), encoding="utf-8").read()
    m = re.search(r'SEINEN_API_URL\s*=\s*"([^"]+)"', src)
    if not m:
        sys.exit("config.js に URL が設定されていません")
    return m.group(1)

def call(req):
    with urllib.request.urlopen(req, timeout=60) as r:  # POST の 302 は GET で追従（GAS の仕様どおり）
        return json.loads(r.read().decode("utf-8"))

def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    url = api_url()
    if sys.argv[1] == "list":
        data = call(url + "?action=list")
        print(json.dumps(data.get("events", []), ensure_ascii=False, indent=2))
    elif sys.argv[1] == "upsert":
        token = os.environ.get("SEINEN_ADMIN_TOKEN")
        if not token:
            sys.exit("環境変数 SEINEN_ADMIN_TOKEN がありません")
        event = json.load(open(sys.argv[2], encoding="utf-8"))
        body = json.dumps({"action": "adminUpsertEvent", "token": token, "event": event}).encode("utf-8")
        req = urllib.request.Request(url, data=body, headers={"Content-Type": "text/plain;charset=utf-8"})
        print(json.dumps(call(req), ensure_ascii=False))
    else:
        sys.exit(__doc__)

if __name__ == "__main__":
    main()
