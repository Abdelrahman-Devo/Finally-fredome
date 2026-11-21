/* FINAL FREEDOM - core.js : منطق الحسابات فقط (بدون واجهة) */
(function (root) {
  'use strict';
  const U = {
    r2: x => Math.round((Number(x) + Number.EPSILON) * 100) / 100,
    pad: n => String(n).padStart(2, '0'),
    fmtDate(d) { return d.getFullYear() + '-' + U.pad(d.getMonth() + 1) + '-' + U.pad(d.getDate()); },
    today() { return U.fmtDate(new Date()); },
    parse(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); },
    addDays(s, n) { const d = U.parse(s); d.setDate(d.getDate() + n); return U.fmtDate(d); },
    uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); },
    validDate(s) { return /^\d{4}-\d{2}-\d{2}$/.test(s || '') && !isNaN(U.parse(s)); },
    num(v) {
      const map = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9, '٫': '.', '،': '.' };
      return Number(String(v == null ? '' : v).replace(/[٠-٩٫،]/g, c => map[c]).replace(/,/g, '').trim());
    }
  };

  const CATEGORIES = [
    { id: 'home', name: 'مصاريف البيت', essential: true }, { id: 'food', name: 'الأكل والشرب', essential: true },
    { id: 'transport', name: 'المواصلات', essential: true }, { id: 'bills', name: 'الفواتير', essential: true },
    { id: 'health', name: 'الصحة', essential: true }, { id: 'education', name: 'التعليم', essential: true },
    { id: 'clothes', name: 'الملابس' }, { id: 'fun', name: 'الترفيه' }, { id: 'charity', name: 'الصدقات' },
    { id: 'debt', name: 'سداد الديون' }, { id: 'other', name: 'مصروفات أخرى' }
  ];
  const INCOME_TYPES = [['salary', 'المرتب الأساسي'], ['incentive', 'الحوافز'], ['overtime', 'الساعات الإضافية'],
    ['bonus', 'المكافآت'], ['extra', 'العمل الإضافي'], ['other', 'مصادر دخل أخرى']];
  const BUCKETS = [
    { id: 'essentials', name: 'الأساسيات', pct: 60, color: '#1f4e8c' },
    { id: 'debt', name: 'سداد الديون', pct: 13.3, color: '#c0504d' },
    { id: 'emergency', name: 'صندوق الطوارئ', pct: 16.7, color: '#10a37f' },
    { id: 'personal', name: 'المصروف الشخصي', pct: 5, color: '#8e6bbf' },
    { id: 'reserve', name: 'احتياطي المصاريف المتغيرة', pct: 5, color: '#d4a63a' }
  ];
  const INV_TYPES = ['أسهم', 'صناديق استثمار', 'ذهب', 'عقار', 'مشروع', 'عملات', 'أخرى'];

  function defaultState() {
    return {
      version: 1,
      settings: { currency: 'EGP', theme: 'auto', avgIncome: 6000, emergencyTarget: 3600, phase: 1, remind: true,
        lowBalance: 200, zakat: { cash: '', receivables: 0, assets: 0, debts: 0, nisab: '', hawlStart: '' }, created: U.today() },
      buckets: JSON.parse(JSON.stringify(BUCKETS)),
      categories: JSON.parse(JSON.stringify(CATEGORIES)),
      movements: [],
      debts: [{ id: 'd_main', name: 'إجمالي الديون', type: 'free', total: 18000, opening: 18000, installment: 800, dueDay: 1, rate: 0, notes: '' }],
      goals: [], investments: []
    };
  }

  /* ---------- الدفتر ---------- */
  function balances(s) {
    const b = {};
    s.movements.forEach(m => {
      if (m.from && m.from !== 'EXT') b[m.from] = U.r2((b[m.from] || 0) - m.amount);
      if (m.to && m.to !== 'EXT') b[m.to] = U.r2((b[m.to] || 0) + m.amount);
    });
    return b;
  }
  function accounts(s) {
    return [{ id: 'unalloc', name: 'غير موزع' }].concat(s.buckets.map(b => ({ id: b.id, name: b.name })),
      s.goals.map(g => ({ id: 'g:' + g.id, name: '🎯 ' + g.name })));
  }
  function acctName(s, id) { const a = accounts(s).find(x => x.id === id); return id === 'EXT' ? 'خارج النظام' : (a ? a.name : 'بند محذوف'); }
  const inRange = (m, from, to) => (!from || m.date >= from) && (!to || m.date <= to);
  const isExpense = m => m.kind === 'expense' || m.kind === 'debtpay';

  function debtPaid(s, d) { return U.r2(s.movements.filter(m => m.kind === 'debtpay' && m.debtId === d.id).reduce((a, m) => a + m.amount, 0)); }
  function debtRemaining(s, d) { return Math.max(0, U.r2(d.opening - debtPaid(s, d))); }

  function summary(s, ref) {
    ref = ref || U.today();
    const b = balances(s), r = range('month', ref);
    const bucketsTotal = s.buckets.reduce((a, x) => a + (b[x.id] || 0), 0);
    const goalsTotal = s.goals.reduce((a, g) => a + (b['g:' + g.id] || 0), 0);
    const unalloc = b.unalloc || 0;
    const cash = U.r2(bucketsTotal + goalsTotal + unalloc);
    const debts = U.r2(s.debts.reduce((a, d) => a + debtRemaining(s, d), 0));
    const live = s.investments.filter(i => !i.sold);
    const invest = U.r2(live.reduce((a, i) => a + i.value, 0));
    const income = U.r2(s.movements.filter(m => m.kind === 'income' && inRange(m, r.from, r.to)).reduce((a, m) => a + m.amount, 0));
    const expenses = U.r2(s.movements.filter(m => isExpense(m) && inRange(m, r.from, r.to)).reduce((a, m) => a + m.amount, 0));
    const tgt = s.goals.reduce((a, g) => a + g.target, 0);
    const got = s.goals.reduce((a, g) => a + Math.min(Math.max(b['g:' + g.id] || 0, 0), g.target), 0);
    return { bal: b, cash, unalloc, goalsTotal: U.r2(goalsTotal), emergency: b.emergency || 0, debts, invest,
      netWorth: U.r2(cash + invest - debts), income, expenses, goalsPct: tgt > 0 ? Math.round(got / tgt * 100) : 0 };
  }

  /* ---------- الفترات ---------- */
  function range(kind, ref) {
    ref = ref || U.today(); const d = U.parse(ref); let from, to;
    if (kind === 'all') return { from: '', to: '' };
    if (kind === 'day') { from = to = ref; }
    else if (kind === 'week') { const dow = (d.getDay() + 1) % 7; from = U.addDays(ref, -dow); to = U.addDays(from, 6); }
    else if (kind === 'month') { from = ref.slice(0, 7) + '-01'; to = U.fmtDate(new Date(d.getFullYear(), d.getMonth() + 1, 0)); }
    else { from = d.getFullYear() + '-01-01'; to = d.getFullYear() + '-12-31'; }
    return { from, to };
  }
  function monthKeys(n, ref) {
    const d = U.parse(ref || U.today()), out = [];
    for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); out.push(x.getFullYear() + '-' + U.pad(x.getMonth() + 1)); }
    return out;
  }

  /* ---------- الدخل ---------- */
  function incomeStats(s, ref) {
    const tot = {}; s.movements.filter(m => m.kind === 'income').forEach(m => { const k = m.date.slice(0, 7); tot[k] = U.r2((tot[k] || 0) + m.amount); });
    const avg = n => U.r2(monthKeys(n, ref).reduce((a, k) => a + (tot[k] || 0), 0) / n);
    const months = monthKeys(6, ref).map(k => ({ key: k, total: tot[k] || 0 }));
    const cur = months[5].total, prev = months[4].total;
    return { month: cur, avg3: avg(3), avg6: avg(6), months, diffPrev: U.r2(cur - prev) };
  }

  function distribute(amount, buckets) {
    const out = {}; let used = 0;
    buckets.forEach(b => { out[b.id] = U.r2(amount * b.pct / 100); used += out[b.id]; });
    const diff = U.r2(amount - used);
    if (diff !== 0 && buckets.length) { const big = buckets.reduce((a, b) => b.pct > a.pct ? b : a); out[big.id] = U.r2(out[big.id] + diff); }
    return out;
  }
  function scaleAllocs(allocs, newTotal) {
    const old = allocs.reduce((a, m) => a + m.amount, 0); if (!old || !allocs.length) return [];
    const res = allocs.map(m => U.r2(m.amount * newTotal / old)); const diff = U.r2(newTotal - res.reduce((a, x) => a + x, 0));
    let bi = 0; res.forEach((x, i) => { if (x > res[bi]) bi = i; }); res[bi] = U.r2(res[bi] + diff); return res;
  }
  const pctSum = buckets => U.r2(buckets.reduce((a, b) => a + Number(b.pct), 0));

  /* ---------- الديون ---------- */
  function schedule(s, d, from) {
    let rem = debtRemaining(s, d); const rows = []; if (rem <= 0) return { rows, months: 0 };
    const mr = d.type === 'interest' ? (Number(d.rate) || 0) / 100 / 12 : 0;
    if (!(d.installment > 0) || d.installment <= rem * mr) return { infinite: true, rows, months: Infinity };
    let dt = nextDue(d, from || U.today()) || from || U.today(); let n = 0;
    while (rem > 0.004 && n < 600) {
      n++; const interest = U.r2(rem * mr); const pay = Math.min(d.installment, U.r2(rem + interest));
      rem = U.r2(rem + interest - pay); rows.push({ n, date: dt, payment: pay, interest, remaining: Math.max(0, rem) });
      const x = U.parse(dt); const nx = new Date(x.getFullYear(), x.getMonth() + 1, 1);
      dt = U.fmtDate(new Date(nx.getFullYear(), nx.getMonth(), Math.min(d.dueDay, new Date(nx.getFullYear(), nx.getMonth() + 1, 0).getDate())));
    }
    return { rows, months: rows.length, end: rows.length ? rows[rows.length - 1].date : null };
  }
  function nextDue(d, from) {
    const t = U.parse(from || U.today());
    const mk = (y, m) => U.fmtDate(new Date(y, m, Math.min(d.dueDay || 1, new Date(y, m + 1, 0).getDate())));
    let c = mk(t.getFullYear(), t.getMonth()); if (c < U.fmtDate(t)) c = mk(t.getFullYear(), t.getMonth() + 1); return c;
  }
  const daysBetween = (a, b) => Math.round((U.parse(b) - U.parse(a)) / 86400000);

  /* ---------- طوارئ وأهداف ---------- */
  function essentialMonthly(s, ref) {
    const ess = new Set(s.categories.filter(c => c.essential).map(c => c.id)); const t = {};
    s.movements.filter(m => m.kind === 'expense' && ess.has(m.category)).forEach(m => { const k = m.date.slice(0, 7); t[k] = (t[k] || 0) + m.amount; });
    const ks = Object.keys(t); return ks.length ? U.r2(ks.reduce((a, k) => a + t[k], 0) / ks.length) : 0;
  }
  function emergency(s, ref) {
    ref = ref || U.today(); const b = summary(s, ref).emergency, target = s.settings.emergencyTarget, ess = essentialMonthly(s, ref);
    const keys = monthKeys(3, ref); let inflow = 0;
    s.movements.forEach(m => { if (!keys.includes(m.date.slice(0, 7)) || m.kind === 'expense') return;
      if (m.to === 'emergency') inflow += m.amount; if (m.from === 'emergency') inflow -= m.amount; });
    const monthly = U.r2(inflow / 3), remaining = Math.max(0, U.r2(target - b));
    return { balance: b, target, remaining, pct: target > 0 ? Math.min(100, Math.round(Math.max(b, 0) / target * 100)) : 0,
      essMonthly: ess, stages: [1, 3, 6].map(m => ({ months: m, amount: U.r2(ess * m) })), monthly,
      etaMonths: remaining === 0 ? 0 : (monthly > 0 ? Math.ceil(remaining / monthly) : null) };
  }
  function goalInfo(s, g, ref) {
    ref = ref || U.today(); const bal = summary(s, ref).bal['g:' + g.id] || 0, rem = Math.max(0, U.r2(g.target - bal));
    let monthsLeft = null, perMonth = null;
    if (g.deadline) { const a = U.parse(ref), z = U.parse(g.deadline); monthsLeft = Math.max(0, (z.getFullYear() - a.getFullYear()) * 12 + z.getMonth() - a.getMonth()); if (monthsLeft > 0) perMonth = U.r2(rem / monthsLeft); }
    return { balance: bal, remaining: rem, pct: g.target > 0 ? Math.min(100, Math.round(Math.max(bal, 0) / g.target * 100)) : 0, done: bal >= g.target, monthsLeft, perMonth };
  }

  /* ---------- الزكاة ---------- */
  function zakat(i) {
    const n = x => Math.max(0, Number(x) || 0);
    const base = Math.max(0, U.r2(n(i.cash) + n(i.receivables) + n(i.assets) - n(i.debts)));
    const nisab = n(i.nisab), nisabMet = nisab > 0 && base >= nisab;
    let hawlDate = null, hawlDone = false;
    if (i.hawlStart && U.validDate(i.hawlStart)) { hawlDate = U.addDays(i.hawlStart, 354); hawlDone = (i.today || U.today()) >= hawlDate; }
    return { base, nisab, nisabMet, hawlDate, hawlDone, due: nisabMet && hawlDone ? U.r2(base * 0.025) : 0, ifDue: U.r2(base * 0.025) };
  }

  /* ---------- المراحل ---------- */
  function phase(s, ref) {
    const sm = summary(s, ref), em = emergency(s, ref), openD = s.debts.reduce((a, d) => a + d.opening, 0);
    const debtProg = openD > 0 ? Math.round((1 - sm.debts / openD) * 100) : 100, nExp = s.movements.filter(m => m.kind === 'expense').length;
    const six = em.essMonthly > 0 ? em.essMonthly * 6 : s.settings.emergencyTarget * 2;
    const p1 = [
      { label: 'استكمال صندوق الطوارئ المستهدف', ok: em.balance >= em.target && em.target > 0, pct: em.pct },
      { label: 'سداد 50% على الأقل من الديون', ok: debtProg >= 50, pct: Math.min(100, debtProg * 2) },
      { label: 'تسجيل 10 مصروفات على الأقل', ok: nExp >= 10, pct: Math.min(100, nExp * 10) }];
    const p2 = [
      { label: 'صندوق طوارئ بقيمة 6 شهور من المصاريف الأساسية', ok: em.balance >= six && six > 0, pct: six > 0 ? Math.min(100, Math.round(Math.max(em.balance, 0) / six * 100)) : 0 },
      { label: 'سداد جميع الديون', ok: sm.debts === 0, pct: Math.min(100, debtProg) },
      { label: 'وجود مدخرات في هدف واحد على الأقل', ok: sm.goalsTotal > 0, pct: sm.goalsTotal > 0 ? 100 : 0 },
      { label: 'بدء الاستثمار (أصل واحد على الأقل)', ok: s.investments.some(i => !i.sold), pct: s.investments.some(i => !i.sold) ? 100 : 0 }];
    const p3 = [{ label: 'زيادة قيمة الأصول وتنويعها', ok: new Set(s.investments.filter(i => !i.sold).map(i => i.type)).size >= 3, pct: Math.min(100, Math.round(new Set(s.investments.filter(i => !i.sold).map(i => i.type)).size / 3 * 100)) }];
    const cur = s.settings.phase || 1, conds = [p1, p2, p3];
    return { current: cur, conds, canAdvance: cur < 3 && conds[cur - 1].every(c => c.ok),
      progress: Math.round(conds[cur - 1].reduce((a, c) => a + c.pct, 0) / conds[cur - 1].length) };
  }

  /* ---------- التقارير ---------- */
  function report(s, from, to) {
    const ms = s.movements.filter(m => inRange(m, from, to)), cat = {};
    const income = U.r2(ms.filter(m => m.kind === 'income').reduce((a, m) => a + m.amount, 0));
    const exps = ms.filter(isExpense), expenses = U.r2(exps.reduce((a, m) => a + m.amount, 0));
    exps.forEach(m => { cat[m.category] = U.r2((cat[m.category] || 0) + m.amount); });
    const debtPaid = U.r2(ms.filter(m => m.kind === 'debtpay').reduce((a, m) => a + m.amount, 0));
    const tr = ms.filter(m => m.kind === 'transfer');
    const goalsNet = U.r2(tr.reduce((a, m) => a + (String(m.to).startsWith('g:') ? m.amount : 0) - (String(m.from).startsWith('g:') ? m.amount : 0), 0));
    const savedIn = U.r2(ms.filter(m => (m.to === 'emergency') && m.kind !== 'income').reduce((a, m) => a + m.amount, 0));
    const net = U.r2(income - (expenses - debtPaid));
    return { income, expenses, debtPaid, cat, transfers: U.r2(tr.reduce((a, m) => a + m.amount, 0)), transfersCount: tr.length, goalsNet, savedIn,
      net, count: ms.filter(m => m.kind !== 'alloc').length, savingRate: income > 0 ? Math.round(net / income * 100) : 0 };
  }

  /* ---------- التنبيهات ---------- */
  function alerts(s, ref) {
    ref = ref || U.today(); const out = [], sm = summary(s, ref), mr = range('month', ref);
    s.debts.forEach(d => { if (debtRemaining(s, d) <= 0 || !(d.installment > 0)) return;
      const paid = s.movements.filter(m => m.kind === 'debtpay' && m.debtId === d.id && m.date >= mr.from && m.date <= mr.to).reduce((a, m) => a + m.amount, 0);
      const nd = nextDue(d, ref), dd = daysBetween(ref, nd);
      if (paid < d.installment && dd <= 3) out.push({ type: 'warn', msg: `قسط «${d.name}» ${dd === 0 ? 'مستحق اليوم' : 'بعد ' + dd + ' يوم'} (${d.installment})` }); });
    s.buckets.forEach(b => {
      const bal = sm.bal[b.id] || 0; if (bal < 0) out.push({ type: 'bad', msg: `تجاوز الرصيد في بند «${b.name}» (${bal})` });
      else { const spent = s.movements.filter(m => isExpense(m) && m.from === b.id && m.date >= mr.from && m.date <= mr.to).reduce((a, m) => a + m.amount, 0);
        const inn = s.movements.filter(m => m.to === b.id && m.kind !== 'expense' && m.date >= mr.from && m.date <= mr.to).reduce((a, m) => a + m.amount, 0);
        if (inn > 0 && spent > inn) out.push({ type: 'warn', msg: `صرفت في «${b.name}» أكثر مما خُصص له هذا الشهر` }); } });
    s.goals.forEach(g => { if (goalInfo(s, g, ref).done) out.push({ type: 'good', msg: `🎉 تحقق هدف «${g.name}»` }); });
    if (sm.cash < s.settings.lowBalance && s.movements.length) out.push({ type: 'bad', msg: 'الرصيد الكلي منخفض' });
    if (sm.unalloc > 0) out.push({ type: 'info', msg: `يوجد مبلغ غير موزع: ${sm.unalloc}` });
    if (s.settings.remind && !s.movements.some(m => m.kind === 'expense' && m.date === ref)) out.push({ type: 'info', msg: 'لم تسجّل مصروفات اليوم بعد' });
    return out;
  }

  function toCSV(rows) {
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    return '\ufeff' + rows.map(r => r.map(q).join(',')).join('\r\n');
  }

  root.FF = { U, CATEGORIES, INCOME_TYPES, INV_TYPES, BUCKETS, defaultState, balances, accounts, acctName, summary, range, monthKeys, incomeStats,
    distribute, scaleAllocs, pctSum, debtPaid, debtRemaining, schedule, nextDue, daysBetween, essentialMonthly, emergency, goalInfo, zakat, phase,
    report, alerts, toCSV, isExpense, inRange };
  if (typeof module !== 'undefined') module.exports = root.FF;
})(typeof window !== 'undefined' ? window : globalThis);
