/**
 * 青年委員 応援カレンダー — Google スプレッドシート連携（Google Apps Script）
 *
 * このスクリプトは、スプレッドシートを保存先にして次のことを行います。
 *   - ページ（GitHub Pages）への予定・参加者・応援メッセージの受け渡し
 *   - 参加者へのリマインドメールの自動送信（前日）
 *
 * 初回だけ行うこと（詳しくは SETUP.md）:
 *   1. 関数「setup」を実行 … シートを作り、初期の予定を入れます
 *   2. 「デプロイ」→「新しいデプロイ」→ 種類「ウェブアプリ」
 *        次のユーザーとして実行: 自分 ／ アクセスできるユーザー: 全員
 *   3. 関数「setupReminderTrigger」を実行 … リマインドメールを毎日自動で送る設定
 */

// ===== 設定 =====
const CONFIG = {
  PAGE_URL: '',               // 公開ページのURL（例: https://ユーザー名.github.io/seinen-ouen/）メール本文に載せます
  REMINDER_HOUR: 18,          // リマインドを送る時刻（0〜23）。18 なら「前日の18時台」に送信
  REMINDER_DAYS_BEFORE: 1,    // 何日前に送るか（1 = 前日）
  SENDER_NAME: '福岡県倫理法人会 青年委員',
  TZ: 'Asia/Tokyo',
};

const SHEET = { EVENTS: '予定', RSVPS: '参加者', MESSAGES: '応援メッセージ' };
const HEAD = {
  EVENTS:   ['ID', '日付', '開始時刻', '単会名', '会場', '住所', 'お知らせ', '講話者（1行に1人「氏名｜肩書き」）', '備考'],
  RSVPS:    ['ID', '予定ID', '名前', 'メールアドレス', '登録日時', 'リマインド送信日時', '削除キー'],
  MESSAGES: ['ID', '予定ID', '宛先', '名前', 'メッセージ', '投稿日時', '削除キー'],
};

// ===== 初期設定 =====
function setup() {
  const ss = SpreadsheetApp.getActive();
  ss.setSpreadsheetTimeZone(CONFIG.TZ);
  const ev = ensureSheet_(ss, SHEET.EVENTS, HEAD.EVENTS);
  ensureSheet_(ss, SHEET.RSVPS, HEAD.RSVPS);
  ensureSheet_(ss, SHEET.MESSAGES, HEAD.MESSAGES);

  if (ev.getLastRow() < 2) {
    const seed = [
      ['2026-09-29-yukuhashi', '2026-09-29', '06:00', '行橋 倫理法人会', 'フォレスト', '京都郡みやこ町惣社974', '',
        '岩坂 希生｜大濠倫理法人会 幹事 / 鍼灸サロン totonou 社長', ''],
      ['2026-10-03-kasuga', '2026-10-03', '06:00', '春日市 倫理法人会', '一品香雑餉隈店', '福岡市博多区竹丘町2-3-9', '',
        '出水 直哉｜春日市倫理法人会 幹事／(株)MoMo 人事部長\n斎藤 武士｜春日市倫理法人会 幹事／(一社)子どもの視力を守る会 店長', ''],
      ['2026-10-06-chikushino', '2026-10-06', '06:00', '筑紫野市 倫理法人会', '天拝いこいの館', '筑紫野市武蔵1-2-20', '会場変更',
        '鬼塚 暁久｜Sol ryze(ソルライズ) 代表', ''],
      ['2026-10-13-fukuokanishi', '2026-10-13', '06:00', '福岡市西 倫理法人会', 'ヒルトン福岡シーホーク 3F', '福岡市中央区地行浜2-2-3', '',
        '園田 智昭｜福岡県倫理法人会 青年委員長 / AIG損害保険(株)', ''],
      ['2026-10-23-dokai', '2026-10-23', '06:00', '北九州市洞海 倫理法人会', '岡田宮', '北九州市八幡西区岡田町1-1', '',
        '花岡 進輔｜北九州市洞海倫理法人会 幹事 / アクサ生命保険(株)', ''],
      ['2026-10-27-hakataminato', '2026-10-27', '06:00', '博多みなと 倫理法人会', '福岡サンパレス', '福岡市博多区築港本町2-1', '',
        '沖田 錦\n原田 運也\n多賀谷 兵馬', '肩書き：福岡市東倫理法人会 幹事 / 中洲川端倫理法人会 事務長'],
    ];
    ev.getRange(2, 1, seed.length, seed[0].length).setValues(seed);
  }
  toastSafe_('シートの準備ができました');
}

function ensureSheet_(ss, name, header) {
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (sh.getLastRow() === 0) sh.appendRow(header);
  sh.setFrozenRows(1);
  sh.getRange(1, 1, 1, header.length).setFontWeight('bold').setBackground('#ebf2fc');
  // 日付や時刻が自動で別の形式に変わらないよう、全体を「書式なしテキスト」にする
  sh.getRange(1, 1, sh.getMaxRows(), header.length).setNumberFormat('@');
  sh.getRange(1, 1, sh.getMaxRows(), header.length).setWrap(true).setVerticalAlignment('top');
  return sh;
}

function toastSafe_(msg) {
  try { SpreadsheetApp.getActive().toast(msg); } catch (e) {}
}

// ===== ページとの受け渡し =====
function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) || 'list';
  if (action === 'list') return json_({ ok: true, ...listAll_() });
  return json_({ ok: false, error: 'unknown_action' });
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ ok: false, error: 'bad_request' }); }
  if (body.website) return json_({ ok: true }); // いたずら投稿よけ（人には見えない欄）

  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return json_({ ok: false, error: 'busy' });
  try {
    switch (body.action) {
      case 'rsvp': return json_(addRsvp_(body));
      case 'cancelRsvp': return json_(removeRow_(SHEET.RSVPS, body.id, body.key));
      case 'message': return json_(addMessage_(body));
      case 'deleteMessage': return json_(removeRow_(SHEET.MESSAGES, body.id, body.key));
      default: return json_({ ok: false, error: 'unknown_action' });
    }
  } finally {
    lock.releaseLock();
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function listAll_() {
  return {
    events: readEvents_(),
    // メールアドレスと削除キーはページに渡さない
    rsvps: rows_(SHEET.RSVPS).map(r => ({ id: r[0], eventId: r[1], name: r[2], createdAt: toMs_(r[4]) })),
    messages: rows_(SHEET.MESSAGES).map(r => ({ id: r[0], eventId: r[1], to: r[2], from: r[3], text: r[4], createdAt: toMs_(r[5]) })),
  };
}

function readEvents_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET.EVENTS);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const values = sh.getRange(2, 1, last - 1, HEAD.EVENTS.length).getValues();
  const out = [];
  values.forEach((r, i) => {
    const date = normDate_(r[1]);
    if (!date || !r[3]) return;
    let id = String(r[0] || '').trim();
    if (!id) { // 手で追加した行にIDを振る
      id = date + '-' + Utilities.getUuid().slice(0, 6);
      sh.getRange(i + 2, 1).setValue(id);
    }
    out.push({
      id, date, time: normTime_(r[2]), unit: str_(r[3]), venue: str_(r[4]), address: str_(r[5]),
      notice: str_(r[6]), speakers: parseSpeakers_(r[7]), note: str_(r[8]),
    });
  });
  return out.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}

function parseSpeakers_(cell) {
  return String(cell || '').split(/\n/).map(s => s.trim()).filter(Boolean).map(line => {
    const parts = line.split(/[｜|]/);
    return { name: parts[0].trim().replace(/\s*氏$/, ''), title: parts.slice(1).join('｜').trim() };
  });
}

function addRsvp_(b) {
  const eventId = str_(b.eventId), name = clip_(b.name, 30), email = str_(b.email).slice(0, 120);
  if (!eventExists_(eventId)) return { ok: false, error: 'no_event' };
  if (!name) return { ok: false, error: 'no_name' };
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'bad_email' };
  if (rows_(SHEET.RSVPS).some(r => r[1] === eventId && r[2] === name)) return { ok: false, error: 'duplicate' };
  const id = 'r' + Utilities.getUuid().replace(/-/g, '').slice(0, 12), key = Utilities.getUuid();
  sheet_(SHEET.RSVPS).appendRow([id, eventId, safe_(name), safe_(email), now_(), '', key]);
  return { ok: true, id, key };
}

function addMessage_(b) {
  const eventId = str_(b.eventId), from = clip_(b.from, 30), text = clip_(b.text, 300), to = clip_(b.to, 40);
  if (!eventExists_(eventId)) return { ok: false, error: 'no_event' };
  if (!from || !text) return { ok: false, error: 'empty' };
  const id = 'm' + Utilities.getUuid().replace(/-/g, '').slice(0, 12), key = Utilities.getUuid();
  sheet_(SHEET.MESSAGES).appendRow([id, eventId, safe_(to), safe_(from), safe_(text), now_(), key]);
  return { ok: true, id, key };
}

function removeRow_(name, id, key) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return { ok: false, error: 'not_found' };
  const width = HEAD[name === SHEET.RSVPS ? 'RSVPS' : 'MESSAGES'].length;
  const values = sh.getRange(2, 1, last - 1, width).getValues();
  for (let i = 0; i < values.length; i++) {
    if (values[i][0] === id) {
      if (!key || values[i][width - 1] !== key) return { ok: false, error: 'forbidden' };
      sh.deleteRow(i + 2);
      return { ok: true };
    }
  }
  return { ok: false, error: 'not_found' };
}

// ===== リマインドメール =====
function setupReminderTrigger() {
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'sendReminders')
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('sendReminders').timeBased().everyDays(1)
    .atHour(CONFIG.REMINDER_HOUR).inTimezone(CONFIG.TZ).create();
  toastSafe_('リマインドメールの自動送信を設定しました（毎日 ' + CONFIG.REMINDER_HOUR + ' 時台）');
}

function sendReminders() {
  const target = new Date(Date.now() + CONFIG.REMINDER_DAYS_BEFORE * 86400000);
  const targetDate = Utilities.formatDate(target, CONFIG.TZ, 'yyyy-MM-dd');
  const events = readEvents_().filter(e => e.date === targetDate);
  if (!events.length) return;

  const sh = sheet_(SHEET.RSVPS);
  const last = sh.getLastRow();
  if (last < 2) return;
  const values = sh.getRange(2, 1, last - 1, HEAD.RSVPS.length).getValues();
  values.forEach((r, i) => {
    const ev = events.find(e => e.id === r[1]);
    const email = str_(r[3]).replace(/^'/, '');
    if (!ev || !email || r[5]) return;
    if (MailApp.getRemainingDailyQuota() < 1) return;
    MailApp.sendEmail({ to: email, subject: reminderSubject_(ev), body: reminderBody_(ev, str_(r[2]).replace(/^'/, '')), name: CONFIG.SENDER_NAME });
    sh.getRange(i + 2, 6).setValue(now_());
  });
}

function reminderSubject_(ev) {
  return '【' + (CONFIG.REMINDER_DAYS_BEFORE === 1 ? '明日' : jpDate_(ev.date)) + '】' + ev.unit + ' モーニングセミナーのご案内';
}

function reminderBody_(ev, name) {
  const map = 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent([ev.venue, ev.address].filter(Boolean).join(' '));
  const lines = [
    name + ' 様', '',
    'ご参加の登録ありがとうございます。' + (CONFIG.REMINDER_DAYS_BEFORE === 1 ? '明日' : '') + 'のモーニングセミナーのご案内です。', '',
    '日時：' + jpDate_(ev.date) + (ev.time ? ' ' + ev.time + '〜' : ''),
    '単会：' + ev.unit,
    '会場：' + ev.venue + (ev.address ? '（' + ev.address + '）' : '') + (ev.notice ? ' ※' + ev.notice : ''),
    '地図：' + map,
    '講話：' + ev.speakers.map(s => s.name + ' 氏' + (s.title ? '（' + s.title + '）' : '')).join('／'),
  ];
  if (CONFIG.PAGE_URL) lines.push('', '登壇者への応援メッセージはこちら：', CONFIG.PAGE_URL);
  lines.push('', 'お気をつけてお越しください。', '', CONFIG.SENDER_NAME);
  return lines.join('\n');
}

// 送信テスト用：いちばん近い予定のリマインド文を、自分宛てに1通送ります
function testReminderToMe() {
  const ev = readEvents_().find(e => e.date >= Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd'));
  if (!ev) throw new Error('これからの予定がありません');
  const me = Session.getActiveUser().getEmail();
  MailApp.sendEmail({ to: me, subject: '[テスト] ' + reminderSubject_(ev), body: reminderBody_(ev, 'テスト'), name: CONFIG.SENDER_NAME });
}

// ===== 小さな道具 =====
function sheet_(name) { return SpreadsheetApp.getActive().getSheetByName(name); }
function rows_(name) {
  const sh = sheet_(name);
  const last = sh.getLastRow();
  if (last < 2) return [];
  const width = HEAD[name === SHEET.RSVPS ? 'RSVPS' : 'MESSAGES'].length;
  return sh.getRange(2, 1, last - 1, width).getValues().filter(r => r[0]).map(r => r.map(v => typeof v === 'string' ? v.replace(/^'/, '') : v));
}
function eventExists_(id) { return !!id && readEvents_().some(e => e.id === id); }
function str_(v) { return v == null ? '' : String(v).trim(); }
function clip_(v, n) { return str_(v).slice(0, n); }
// 「=」などで始まる文字が数式として扱われないようにする
function safe_(s) { return /^[=+\-@]/.test(s) ? "'" + s : s; }
function now_() { return Utilities.formatDate(new Date(), CONFIG.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function toMs_(v) {
  if (v instanceof Date) return v.getTime();
  const m = String(v || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):?(\d{2})?/);
  return m ? new Date(m[1] + '-' + m[2] + '-' + m[3] + 'T' + m[4] + ':' + m[5] + ':' + (m[6] || '00') + '+09:00').getTime() : 0;
}
function normDate_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'yyyy-MM-dd');
  const m = String(v || '').trim().match(/^(\d{4})[-\/年.](\d{1,2})[-\/月.](\d{1,2})/);
  return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : '';
}
function normTime_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, CONFIG.TZ, 'HH:mm');
  const m = String(v || '').trim().match(/^(\d{1,2})[:：時](\d{2})?/);
  return m ? ('0' + m[1]).slice(-2) + ':' + (m[2] || '00') : '';
}
function jpDate_(ymd) {
  const [y, m, d] = ymd.split('-').map(Number);
  const w = '日月火水木金土'[new Date(y, m - 1, d).getDay()];
  return m + '月' + d + '日（' + w + '）';
}
