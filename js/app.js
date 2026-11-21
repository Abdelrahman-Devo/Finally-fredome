/* FINAL FREEDOM - app.js : الواجهة */
(function () {
  'use strict';
  const { U } = FF;
  let S;
  const ui = { view: 'home', mv: { type: 'all', period: 'month', q: '', scope: 'all' }, rp: { kind: 'month', ref: U.today() } };
  const $ = s => document.querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const CUR = { EGP: 'ج.م', SAR: 'ر.س', USD: '$', AED: 'د.إ', KWD: 'د.ك', EUR: '€' };
  const money = n => (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 }) + ' ' + (CUR[S.settings.currency] || S.settings.currency);
  const sg = n => '<span class="' + (n < 0 ? 'neg' : 'pos') + '">' + money(n) + '</span>';
  const catName = id => (S.categories.find(c => c.id === id) || { name: 'غير مصنف' }).name;
  const incName = id => (FF.INCOME_TYPES.find(t => t[0] === id) || [0, 'دخل'])[1];
  const PAL = ['#1f4e8c', '#10a37f', '#d4a63a', '#8e6bbf', '#c0504d', '#3aa6d4', '#e07b39', '#6b7a90', '#2e8b57', '#a0522d'];
  const bal = id => FF.summary(S).bal[id] || 0;
  const push = o => S.movements.push(Object.assign({ id: U.uid(), ts: Date.now() }, o));
  const byNew = (a, b) => (b.date.localeCompare(a.date)) || ((b.ts || 0) - (a.ts || 0));

  /* ---------- أدوات الواجهة ---------- */
  function toast(msg, bad) { const t = $('#toast'); t.textContent = msg; t.className = 'toast' + (bad ? ' bad' : ''); t.hidden = false; clearTimeout(toast.h); toast.h = setTimeout(() => t.hidden = true, 2800); }
  function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
  function modal(title, body, onOk, ok, danger) {
    const el = $('#modal');
    el.innerHTML = `<div class="sheet"><div class="sh-h"><b>${title}</b><button type="button" data-close aria-label="إغلاق">✕</button></div><form novalidate>${body}<div class="err" id="err"></div><div class="row"><button class="btn ${danger ? 'danger' : 'pri'}" type="submit">${ok || 'حفظ'}</button><button class="btn" type="button" data-close>إلغاء</button></div></form></div>`;
    el.hidden = false; const form = el.querySelector('form');
    form.onsubmit = async e => {
      e.preventDefault(); const v = Object.fromEntries(new FormData(form));
      form.querySelectorAll('input[type=checkbox]').forEach(c => v[c.name] = c.checked);
      let r; try { r = await onOk(v); } catch (x) { r = 'خطأ: ' + x.message; }
      if (r === true) closeModal(); else el.querySelector('#err').textContent = r || 'تحقق من البيانات';
    };
  }
  function info(title, body) { const el = $('#modal'); el.innerHTML = `<div class="sheet"><div class="sh-h"><b>${title}</b><button type="button" data-close>✕</button></div>${body}</div>`; el.hidden = false; }
  function confirmBox(msg, fn, label) { modal('تأكيد', `<p>${msg}</p>`, async () => { await fn(); return true; }, label || 'تأكيد الحذف', true); }
  function F(n, label, type, val, o) {
    o = o || {};
    if (type === 'select') return `<label>${label}<select name="${n}">${o.opts.map(x => `<option value="${esc(x[0])}" ${String(x[0]) === String(val) ? 'selected' : ''}>${esc(x[1])}</option>`).join('')}</select></label>`;
    if (type === 'textarea') return `<label>${label}<textarea name="${n}" rows="2">${esc(val)}</textarea></label>`;
    if (type === 'checkbox') return `<label class="chk"><input type="checkbox" name="${n}" ${val ? 'checked' : ''}> ${label}</label>`;
    if (type === 'num') return `<label>${label}<input name="${n}" type="text" inputmode="decimal" autocomplete="off" value="${esc(val)}"></label>`;
    return `<label>${label}<input name="${n}" type="${type}" value="${esc(val)}"></label>`;
  }
  const accOpts = (excl, noGoals) => FF.accounts(S).filter(a => a.id !== excl && !(noGoals && a.id.startsWith('g:'))).map(a => [a.id, `${a.name} (${money(bal(a.id))})`]);
  function amountErr(v, f) { const n = U.num(v); if (!(n > 0) || !isFinite(n)) return (f || 'المبلغ') + ' يجب أن يكون رقمًا أكبر من صفر'; return null; }
  const dateErr = d => U.validDate(d) ? null : 'التاريخ غير صحيح';
  async function commit(msg) { try { await DB.save(S); } catch (e) { toast('تعذر حفظ البيانات: ' + e.message, true); return; } if (msg) toast(msg); render(); }

  /* ---------- الرسوم ---------- */
  function donut(items) {
    const tot = items.reduce((a, x) => a + x.value, 0); if (tot <= 0) return '<p class="mut small">لا توجد بيانات بعد</p>';
    let off = 25, segs = '';
    items.forEach((x, i) => { const p = x.value / tot * 100; segs += `<circle r="15.9155" cx="21" cy="21" fill="none" stroke="${x.color || PAL[i % PAL.length]}" stroke-width="6" stroke-dasharray="${p} ${100 - p}" stroke-dashoffset="${off}"/>`; off -= p; });
    return `<div class="donut"><svg viewBox="0 0 42 42">${segs}</svg><div class="legend">${items.map((x, i) => `<div><b style="background:${x.color || PAL[i % PAL.length]}"></b>${esc(x.label)} <span class="mut">${Math.round(x.value / tot * 100)}%</span></div>`).join('')}</div></div>`;
  }
  function bars(rows) {
    const mx = Math.max(1, ...rows.flatMap(r => [r.a, r.b]));
    return `<div class="bars">${rows.map(r => `<div class="c"><div class="pair"><i style="height:${r.a / mx * 100}%;background:var(--em)" title="${r.a}"></i><i style="height:${r.b / mx * 100}%;background:var(--red)" title="${r.b}"></i></div>${r.l}</div>`).join('')}</div><div class="small mut"><span class="pos">■</span> دخل &nbsp; <span class="neg">■</span> مصروفات</div>`;
  }
  function spark(pts) {
    if (pts.length < 2) return ''; const mn = Math.min(...pts), mx = Math.max(...pts), r = mx - mn || 1;
    return `<svg class="spark" viewBox="0 0 100 30" preserveAspectRatio="none"><polyline fill="none" stroke="var(--gold)" stroke-width="2" points="${pts.map((p, i) => (i / (pts.length - 1) * 100) + ',' + (28 - (p - mn) / r * 26)).join(' ')}"/></svg>`;
  }
  const bar = (p, cls) => `<div class="bar ${cls || ''}"><div style="width:${Math.max(0, Math.min(100, p))}%"></div></div>`;

  /* ---------- حركة في القائمة ---------- */
  function mvLabel(m) {
    switch (m.kind) {
      case 'income': return ['⬆️', incName(m.type), m.note || ''];
      case 'expense': return ['⬇️', catName(m.category), (m.scope === 'personal' ? 'شخصي' : 'بيت') + (m.desc ? ' • ' + m.desc : '') + ' • من ' + FF.acctName(S, m.from)];
      case 'debtpay': return ['💳', 'سداد: ' + ((S.debts.find(d => d.id === m.debtId) || {}).name || 'دين'), 'من ' + FF.acctName(S, m.from) + (m.desc ? ' • ' + m.desc : '')];
      case 'transfer': return ['🔁', FF.acctName(S, m.from) + ' ← ' + FF.acctName(S, m.to).replace('غير موزع', 'غير موزع'), m.note || ''];
      case 'invest': return ['📈', 'استثمار: ' + ((S.investments.find(i => i.id === m.assetId) || {}).name || ''), 'من ' + FF.acctName(S, m.from)];
      case 'sale': return ['💰', 'بيع أصل: ' + ((S.investments.find(i => i.id === m.assetId) || {}).name || ''), 'إلى ' + FF.acctName(S, m.to)];
      default: return ['•', m.kind, ''];
    }
  }
  function mvItem(m, acts) {
    const [ic, t, s] = mvLabel(m); const out = FF.isExpense(m), inc = m.kind === 'income' || m.kind === 'sale';
    const cls = out ? 'neg' : inc ? 'pos' : 'gold';
    const edit = acts && ['income', 'expense'].includes(m.kind) ? `<button class="btn sm" data-act="${m.kind === 'income' ? 'addIncome' : 'addExpense'}" data-id="${m.id}">تعديل</button>` : '';
    const del = acts && ['income', 'expense', 'debtpay', 'transfer'].includes(m.kind) ? `<button class="btn sm" data-act="delMove" data-id="${m.id}">حذف</button>` : '';
    return `<div class="item"><div><div class="t">${ic} ${esc(t)}</div><div class="s">${m.date} ${s ? '• ' + esc(s) : ''}</div>${edit || del ? `<div class="acts">${edit}${del}</div>` : ''}</div><div class="amt ${cls}">${out ? '-' : inc ? '+' : ''}${money(m.amount)}</div></div>`;
  }

  /* ---------- الشاشات ---------- */
  const V = {};
  V.home = () => {
    const sm = FF.summary(S), em = FF.emergency(S), ph = FF.phase(S), inc = FF.incomeStats(S);
    const recent = S.movements.filter(m => m.kind !== 'alloc').slice().sort(byNew).slice(0, 6);
    const items = S.buckets.map((b, i) => ({ label: b.name, value: Math.max(0, sm.bal[b.id] || 0), color: b.color })).concat(S.goals.map(g => ({ label: g.name, value: Math.max(0, sm.bal['g:' + g.id] || 0) })), [{ label: 'غير موزع', value: Math.max(0, sm.unalloc), color: '#9aa7b8' }]).filter(x => x.value > 0);
    const rate = sm.income > 0 ? Math.round((sm.income - sm.expenses) / sm.income * 100) : null;
    const lines = [];
    if (!S.movements.length) lines.push('ابدأ بتسجيل أول دخل لك ليتم توزيعه تلقائيًا على البنود.');
    else {
      if (rate !== null) lines.push(rate >= 0 ? `ادخرت ${rate}% من دخل هذا الشهر.` : 'مصروفات هذا الشهر أعلى من دخله.');
      if (sm.debts > 0) lines.push(`المتبقي من الديون ${money(sm.debts)}.`);
      lines.push(`صندوق الطوارئ عند ${em.pct}% من هدفه.`);
    }
    return `<div class="card hero"><div class="lbl">إجمالي الرصيد الحالي</div><div class="big">${money(sm.cash)}</div>
      <div class="lbl">صافي الثروة: <b>${money(sm.netWorth)}</b></div></div>
    <div class="shortcuts"><button data-act="addIncome"><i>💵</i>إضافة دخل</button><button data-act="addExpense"><i>🛒</i>إضافة مصروف</button><button data-act="addTransfer"><i>🔁</i>تحويل</button><button data-act="addGoal"><i>🎯</i>هدف جديد</button></div>
    <div class="grid">
      <div class="card kpi"><div class="lbl">دخل الشهر</div><div class="v pos">${money(sm.income)}</div></div>
      <div class="card kpi"><div class="lbl">مصروفات الشهر</div><div class="v neg">${money(sm.expenses)}</div></div>
      <div class="card kpi"><div class="lbl">إجمالي المدخرات (الأهداف)</div><div class="v">${money(sm.goalsTotal)}</div></div>
      <div class="card kpi"><div class="lbl">صندوق الطوارئ</div><div class="v gold">${money(sm.emergency)}</div></div>
      <div class="card kpi"><div class="lbl">الديون المتبقية</div><div class="v neg">${money(sm.debts)}</div></div>
      <div class="card kpi"><div class="lbl">تحقيق الأهداف</div><div class="v">${S.goals.length ? sm.goalsPct + '%' : '—'}</div></div>
    </div>
    <h2>توزيع الأموال</h2><div class="card">${donut(items)}</div>
    <h2>ملخص الحالة المالية</h2><div class="card"><div class="between"><b>المرحلة ${ph.current}: ${['الأمان المالي', 'الاستقرار المالي', 'بناء الثروة'][ph.current - 1]}</b><span class="pill">${ph.progress}%</span></div>${bar(ph.progress, 'gold')}
      ${lines.map(l => `<div class="small">• ${l}</div>`).join('')}${!S.movements.length ? `<div class="note">متوسط دخلك المخطط ${money(S.settings.avgIncome)} (للعلم فقط — لا يُحتسب كدخل فعلي).</div>` : `<div class="small mut" style="margin-top:6px">متوسط الدخل: 3 شهور ${money(inc.avg3)} • 6 شهور ${money(inc.avg6)}</div>`}</div>
    <div class="between"><h2>آخر العمليات</h2><button class="btn sm" data-view="moves">عرض الكل</button></div>
    <div class="card">${recent.length ? recent.map(m => mvItem(m)).join('') : '<p class="mut">لا توجد عمليات بعد.</p>'}</div>`;
  };

  function filteredMoves() {
    const f = ui.mv, r = FF.range(f.period, U.today()), q = f.q.trim().toLowerCase();
    return S.movements.filter(m => m.kind !== 'alloc' && FF.inRange(m, r.from, r.to) &&
      (f.type === 'all' || (f.type === 'expense' ? FF.isExpense(m) : m.kind === f.type)) &&
      (f.scope === 'all' || m.scope === f.scope) &&
      (!q || (mvLabel(m).join(' ') + ' ' + m.amount).toLowerCase().includes(q))).sort(byNew);
  }
  function mvList() {
    const l = filteredMoves(), r = FF.range(ui.mv.period, U.today());
    const prev = ui.mv.period !== 'all' ? FF.range(ui.mv.period, U.addDays(r.from, -1)) : null;
    const ex = l.filter(FF.isExpense).reduce((a, m) => a + m.amount, 0), inc = l.filter(m => m.kind === 'income').reduce((a, m) => a + m.amount, 0);
    let cmp = '';
    if (prev) { const pe = FF.report(S, prev.from, prev.to).expenses, d = U.r2(ex - pe); cmp = `<div class="note">مقارنة المصروفات: الفترة الحالية ${money(ex)} مقابل السابقة ${money(pe)} (${d > 0 ? '▲ زيادة' : d < 0 ? '▼ انخفاض' : 'بدون تغيير'} ${money(Math.abs(d))})</div>`; }
    return `<div class="card"><div class="between small"><span>دخل: <b class="pos">${money(inc)}</b></span><span>مصروفات: <b class="neg">${money(ex)}</b></span></div>${cmp}</div>
      <div class="card">${l.length ? l.map(m => mvItem(m, true)).join('') : '<p class="mut">لا توجد نتائج.</p>'}</div>`;
  }
  V.moves = () => {
    const f = ui.mv, ch = (arr, cur, act) => `<div class="chips">${arr.map(a => `<button class="chip ${cur === a[0] ? 'on' : ''}" data-act="${act}" data-id="${a[0]}">${a[1]}</button>`).join('')}</div>`;
    return `<div class="shortcuts" style="grid-template-columns:repeat(3,1fr)"><button data-act="addIncome"><i>💵</i>دخل</button><button data-act="addExpense"><i>🛒</i>مصروف</button><button data-act="addTransfer"><i>🔁</i>تحويل</button></div>
      <input type="search" placeholder="🔍 بحث…" value="${esc(f.q)}" data-inp="mvq">
      ${ch([['all', 'الكل'], ['income', 'الدخل'], ['expense', 'المصروفات'], ['transfer', 'التحويلات']], f.type, 'mvType')}
      ${ch([['day', 'اليوم'], ['week', 'الأسبوع'], ['month', 'الشهر'], ['year', 'السنة'], ['all', 'الكل']], f.period, 'mvPeriod')}
      ${ch([['all', 'بيت + شخصي'], ['home', 'مصاريف البيت'], ['personal', 'المصاريف الشخصية']], f.scope, 'mvScope')}
      <div id="mvlist">${mvList()}</div>`;
  };

  V.budget = () => {
    const sm = FF.summary(S), r = FF.range('month'), ps = FF.pctSum(S.buckets);
    const rows = S.buckets.map(b => {
      const bl = sm.bal[b.id] || 0, spent = S.movements.filter(m => FF.isExpense(m) && m.from === b.id && FF.inRange(m, r.from, r.to)).reduce((a, m) => a + m.amount, 0);
      const inn = S.movements.filter(m => m.to === b.id && m.kind !== 'expense' && FF.inRange(m, r.from, r.to)).reduce((a, m) => a + m.amount, 0);
      const p = inn > 0 ? Math.round(spent / inn * 100) : (spent > 0 ? 100 : 0);
      return `<div class="card"><div class="between"><h3>${esc(b.name)} <span class="pill">${b.pct}%</span></h3><b class="${bl < 0 ? 'neg' : ''}">${money(bl)}</b></div>
        <div class="small mut">وارد هذا الشهر ${money(inn)} • مصروف ${money(spent)}</div>${bar(p, p > 100 || bl < 0 ? 'red' : '')}
        ${bl < 0 ? '<div class="small neg">⚠️ تم تجاوز رصيد هذا البند</div>' : ''}
        <div class="acts"><button class="btn sm" data-act="addTransfer" data-id="${b.id}">تحويل منه</button><button class="btn sm" data-act="addExpense">مصروف</button></div></div>`;
    }).join('');
    return `<div class="card"><div class="between"><div><div class="mut small">مبلغ غير موزع</div><b style="font-size:20px">${money(sm.unalloc)}</b></div>
      <button class="btn gold" data-act="redistribute" ${sm.unalloc > 0 ? '' : 'disabled'}>توزيع الفائض</button></div></div>
      <div class="between"><h2>بنود الميزانية</h2><button class="btn sm" data-act="budgetPct">تعديل النسب</button></div>
      ${ps !== 100 ? `<div class="al bad">مجموع النسب ${ps}% (يجب 100%)</div>` : ''}${rows}
      <div class="note">النسب الحالية هي إعداد ابتدائي قابل للتعديل في أي وقت ولا تغيّر ما تم توزيعه سابقًا.</div>`;
  };

  V.goals = () => {
    const em = FF.emergency(S), gs = S.goals.slice().sort((a, b) => (a.priority || 2) - (b.priority || 2));
    return `<div class="card" data-view="emergency" style="cursor:pointer"><div class="between"><h3>🛡️ صندوق الطوارئ</h3><b class="gold">${em.pct}%</b></div>${bar(em.pct, 'gold')}<div class="small mut">${money(em.balance)} من ${money(em.target)} — اضغط للتفاصيل</div></div>
      <div class="between"><h2>الأهداف المالية</h2><button class="btn pri sm" data-act="addGoal">+ هدف</button></div>
      ${gs.length ? gs.map(g => { const i = FF.goalInfo(S, g); return `<div class="card"><div class="between"><h3>${esc(g.name)} ${i.done ? '🎉' : ''}</h3><span class="pill">${['', 'عالية', 'متوسطة', 'منخفضة'][g.priority || 2]}</span></div>
        <div class="between small"><span>${money(i.balance)} / ${money(g.target)}</span><b>${i.pct}%</b></div>${bar(i.pct, i.done ? '' : 'gold')}
        <div class="small mut">المتبقي ${money(i.remaining)}${g.deadline ? ' • الموعد ' + g.deadline : ''}${i.perMonth ? ' • المطلوب شهريًا ' + money(i.perMonth) : ''}</div>
        <div class="acts"><button class="btn sm pri" data-act="goalAdd" data-id="${g.id}">إضافة مال</button><button class="btn sm" data-act="goalWd" data-id="${g.id}">سحب</button><button class="btn sm" data-act="addGoal" data-id="${g.id}">تعديل</button><button class="btn sm" data-act="delGoal" data-id="${g.id}">حذف</button></div></div>`; }).join('') : '<div class="card mut">لا توجد أهداف. أضف هدفك الأول (هاتف، لابتوب، سفر…).</div>'}`;
  };

  V.more = () => `<div class="menu">${[['debts', '💳', 'الديون'], ['emergency', '🛡️', 'صندوق الطوارئ'], ['invest', '📈', 'الاستثمار والأصول'], ['zakat', '🕌', 'الزكاة'], ['reports', '📊', 'التقارير'], ['phases', '🪜', 'المراحل المالية'], ['settings', '⚙️', 'الإعدادات']].map(x => `<button data-view="${x[0]}"><i>${x[1]}</i>${x[2]}</button>`).join('')}</div>`;

  V.debts = () => {
    const tot = S.debts.reduce((a, d) => a + d.opening, 0), rem = S.debts.reduce((a, d) => a + FF.debtRemaining(S, d), 0), pd = S.debts.reduce((a, d) => a + FF.debtPaid(S, d), 0);
    return `<div class="card hero"><div class="lbl">المتبقي من الديون</div><div class="big">${money(rem)}</div><div class="lbl">المدفوع ${money(pd)} • الإجمالي عند البداية ${money(tot)}</div></div>
      <div class="between"><h2>قائمة الديون</h2><button class="btn pri sm" data-act="debtEdit">+ دين</button></div>
      ${S.debts.map(d => { const r = FF.debtRemaining(S, d), p = d.opening > 0 ? Math.round((1 - r / d.opening) * 100) : 100, sc = FF.schedule(S, d);
        return `<div class="card"><div class="between"><h3>${esc(d.name)}</h3><span class="pill">${d.type === 'interest' ? 'بفائدة ' + d.rate + '%' : 'بدون فوائد'}</span></div>
        <div class="between small"><span>المتبقي <b class="neg">${money(r)}</b> من ${money(d.total)}</span><b>${p}%</b></div>${bar(p)}
        <div class="small mut">القسط ${money(d.installment)} • يوم السداد ${d.dueDay} • ${sc.infinite ? 'القسط لا يغطي الفائدة' : r > 0 ? 'ينتهي تقريبًا ' + sc.end + ' (' + sc.months + ' شهر)' : 'تم السداد 🎉'}</div>${d.notes ? `<div class="small mut">${esc(d.notes)}</div>` : ''}
        <div class="acts"><button class="btn sm pri" data-act="debtPay" data-id="${d.id}" ${r > 0 ? '' : 'disabled'}>تسجيل سداد</button><button class="btn sm" data-act="debtSched" data-id="${d.id}">جدول السداد</button><button class="btn sm" data-act="debtEdit" data-id="${d.id}">تعديل</button><button class="btn sm" data-act="debtDel" data-id="${d.id}">حذف</button></div></div>`; }).join('') || '<div class="card mut">لا توجد ديون مسجلة.</div>'}`;
  };

  V.emergency = () => {
    const e = FF.emergency(S);
    return `<div class="card hero"><div class="lbl">رصيد صندوق الطوارئ</div><div class="big">${money(e.balance)}</div><div class="lbl">الهدف ${money(e.target)} • المتبقي ${money(e.remaining)}</div></div>
      <div class="card"><div class="between"><h3>نسبة الإنجاز</h3><b class="gold">${e.pct}%</b></div>${bar(e.pct, 'gold')}
      <div class="small mut">المدة المتوقعة للوصول: ${e.etaMonths === 0 ? 'تم تحقيق الهدف 🎉' : e.etaMonths ? e.etaMonths + ' شهر (بمعدل ' + money(e.monthly) + ' شهريًا آخر 3 شهور)' : 'لا يمكن التقدير بعد — لا توجد إضافات حديثة'}</div>
      <div class="acts"><button class="btn pri" data-act="emFund">إضافة للصندوق</button><button class="btn" data-act="addTransfer" data-id="emergency">سحب/تحويل منه</button><button class="btn" data-act="emTarget">تعديل الهدف</button></div></div>
      <h2>مراحل الهدف (من مصاريفك الأساسية الفعلية)</h2>
      <div class="card">${e.essMonthly > 0 ? `<div class="small mut">متوسط مصاريفك الأساسية الشهرية: <b>${money(e.essMonthly)}</b></div>${e.stages.map(s => `<div class="item"><div><div class="t">${s.months === 1 ? 'شهر واحد' : s.months + ' شهور'}</div><div class="s">${money(s.amount)} ${e.balance >= s.amount ? '✅' : ''}</div></div><button class="btn sm" data-act="emSet" data-id="${s.amount}">اعتماد كهدف</button></div>`).join('')}` : '<p class="mut small">سجّل مصروفاتك الأساسية (بيت، أكل، مواصلات، فواتير، صحة، تعليم) ليُحسب الهدف من واقعك الفعلي. الهدف المبدئي الحالي ' + money(e.target) + ' يدوي.</p>'}</div>
      <div class="note">صندوق الطوارئ بند مستقل عن الأهداف والاستثمارات، ولا يُصرف منه إلا عند الحاجة الفعلية.</div>`;
  };

  V.invest = () => {
    const live = S.investments.filter(i => !i.sold), val = live.reduce((a, i) => a + i.value, 0), cost = live.reduce((a, i) => a + i.invested, 0), sm = FF.summary(S);
    return `<div class="card hero"><div class="lbl">صافي الثروة</div><div class="big">${money(sm.netWorth)}</div><div class="lbl">نقد ${money(sm.cash)} + أصول ${money(sm.invest)} − ديون ${money(sm.debts)}</div></div>
      <div class="grid"><div class="card kpi"><div class="lbl">قيمة الأصول الحالية</div><div class="v">${money(val)}</div></div><div class="card kpi"><div class="lbl">الأرباح/الخسائر (غير محققة)</div><div class="v">${sg(val - cost)}</div></div></div>
      <div class="between"><h2>الأصول</h2><button class="btn pri sm" data-act="invEdit">+ أصل</button></div>
      ${S.investments.map(i => { const pl = i.sold ? i.soldFor - i.invested : i.value - i.invested; return `<div class="card" style="${i.sold ? 'opacity:.65' : ''}"><div class="between"><h3>${esc(i.name)}</h3><span class="pill">${esc(i.type)}${i.sold ? ' • مباع' : ''}</span></div>
        <div class="between small"><span>المستثمر ${money(i.invested)}</span><span>${i.sold ? 'بيع بـ ' + money(i.soldFor) : 'الحالية ' + money(i.value)}</span><b>${sg(pl)}</b></div>${spark((i.history || []).map(h => h.value))}
        <div class="small mut">شراء ${i.date}</div>${i.sold ? '' : `<div class="acts"><button class="btn sm pri" data-act="invValue" data-id="${i.id}">تحديث القيمة</button><button class="btn sm" data-act="invSell" data-id="${i.id}">بيع</button><button class="btn sm" data-act="invEdit" data-id="${i.id}">تعديل</button><button class="btn sm" data-act="invDel" data-id="${i.id}">حذف</button></div>`}</div>`; }).join('') || '<div class="card mut">لا توجد استثمارات مسجلة.</div>'}
      <div class="note">التطبيق لا يقدم توصيات استثمارية ولا يضمن عوائد. القيم والأرباح تعتمد على ما تدخله بنفسك.</div>`;
  };

  V.zakat = () => {
    const z = S.settings.zakat, sm = FF.summary(S);
    const r = FF.zakat({ cash: z.cash === '' ? sm.cash : z.cash, receivables: z.receivables, assets: z.assets, debts: z.debts, nisab: z.nisab, hawlStart: z.hawlStart });
    return `<div class="card"><h3>بيانات الحساب</h3>
      <div class="small mut">النقد المقترح من التطبيق: ${money(sm.cash)} (يشمل البنود والأهداف وصندوق الطوارئ)</div>
      <div class="acts"><button class="btn pri" data-act="zakatEdit">تعديل البيانات</button></div>
      <div class="item"><span>المدخرات النقدية</span><b>${money(z.cash === '' ? sm.cash : z.cash)}</b></div><div class="item"><span>أموال مستحقة لك</span><b>${money(z.receivables)}</b></div>
      <div class="item"><span>أصول تجارية/استثمارية داخلة في الوعاء</span><b>${money(z.assets)}</b></div><div class="item"><span>ديون حالّة تُخصم</span><b>${money(z.debts)}</b></div>
      <div class="item"><span>النصاب المعتمد</span><b>${z.nisab ? money(z.nisab) : 'لم يُحدد'}</b></div><div class="item"><span>بداية الحول</span><b>${z.hawlStart || 'لم تُحدد'}</b></div></div>
    <div class="card hero"><div class="lbl">وعاء الزكاة</div><div class="big">${money(r.base)}</div>
      <div class="lbl">بلوغ النصاب: ${r.nisab ? (r.nisabMet ? '✅ بلغ' : '❌ لم يبلغ') : 'أدخل النصاب'} • الحول: ${r.hawlDate ? (r.hawlDone ? '✅ تم (' + r.hawlDate + ')' : 'يتم في ' + r.hawlDate) : 'أدخل بداية الحول'}</div>
      <div class="big gold" style="margin-top:10px">${r.due > 0 ? 'الزكاة الواجبة: ' + money(r.due) : 'لا زكاة واجبة حاليًا'}</div>
      ${r.base > 0 && r.due === 0 ? `<div class="lbl">(لو تحققت الشروط تكون 2.5% = ${money(r.ifDue)})</div>` : ''}</div>
    <div class="note">الأصول غير الخاضعة تلقائيًا (مثل السكن الشخصي والسيارة الشخصية وأدوات الاستعمال) لا تُدخل في الوعاء. النصاب يُحسب بما يعادل 85 جرام ذهب عيار 24 بسعر اليوم، فأدخله يدويًا. الحساب تقديري ويجب مراجعة مختص شرعي للحالات التفصيلية.</div>`;
  };

  function reportData() {
    const r = FF.range(ui.rp.kind, ui.rp.ref), p = FF.range(ui.rp.kind, U.addDays(r.from, -1));
    return { r, p, cur: FF.report(S, r.from, r.to), prev: FF.report(S, p.from, p.to) };
  }
  V.reports = () => {
    const { r, cur, prev } = reportData(), kinds = [['day', 'يومي'], ['week', 'أسبوعي'], ['month', 'شهري'], ['year', 'سنوي']];
    const cats = Object.keys(cur.cat).map(k => ({ label: catName(k), value: cur.cat[k] })).sort((a, b) => b.value - a.value);
    const diff = (a, b) => { const d = U.r2(a - b); return d === 0 ? '—' : (d > 0 ? '▲ ' : '▼ ') + money(Math.abs(d)); };
    const months = ui.rp.kind === 'year' ? FF.monthKeys(12, r.to).map(k => ({ l: k.slice(5), a: FF.report(S, k + '-01', k + '-31').income, b: FF.report(S, k + '-01', k + '-31').expenses })) : FF.monthKeys(6, ui.rp.ref).map(k => ({ l: k.slice(5), a: FF.report(S, k + '-01', k + '-31').income, b: FF.report(S, k + '-01', k + '-31').expenses }));
    return `<div class="chips noprint">${kinds.map(k => `<button class="chip ${ui.rp.kind === k[0] ? 'on' : ''}" data-act="rpKind" data-id="${k[0]}">${k[1]}</button>`).join('')}</div>
      <label class="noprint">التاريخ المرجعي<input type="date" value="${ui.rp.ref}" data-chg="rpRef"></label>
      <div id="report"><div class="card hero"><div class="lbl">تقرير ${kinds.find(k => k[0] === ui.rp.kind)[1]} • ${r.from} → ${r.to}</div><div class="big">${money(cur.net)}</div><div class="lbl">صافي التغير في الثروة (دخل − مصروفات بدون سداد الديون)</div></div>
      <div class="card"><div class="item"><span>الدخل</span><b class="pos">${money(cur.income)}</b></div><div class="item"><span>المصروفات (شاملة سداد الديون)</span><b class="neg">${money(cur.expenses)}</b></div>
        <div class="item"><span>المسدد من الديون</span><b>${money(cur.debtPaid)}</b></div><div class="item"><span>إضافات لصندوق الطوارئ</span><b>${money(cur.savedIn)}</b></div>
        <div class="item"><span>صافي حركة الأهداف</span><b>${money(cur.goalsNet)}</b></div><div class="item"><span>التحويلات (${cur.transfersCount})</span><b>${money(cur.transfers)}</b></div>
        <div class="item"><span>نسبة الادخار</span><b>${cur.income > 0 ? cur.savingRate + '%' : '—'}</b></div></div>
      <div class="card"><h3>مقارنة بالفترة السابقة</h3><div class="item"><span>الدخل</span><b>${diff(cur.income, prev.income)}</b></div><div class="item"><span>المصروفات</span><b>${diff(cur.expenses, prev.expenses)}</b></div></div>
      <div class="card"><h3>المصروفات حسب التصنيف</h3>${donut(cats)}</div>
      <div class="card"><h3>${ui.rp.kind === 'year' ? 'الدخل والمصروفات خلال السنة' : 'مقارنة آخر 6 شهور'}</h3>${bars(months)}</div>
      <div class="note">لا يشمل التقرير تغيّر قيم الاستثمارات غير المحققة. الأصول والديون الحالية: صافي الثروة ${money(FF.summary(S).netWorth)}.</div></div>
      <div class="acts noprint"><button class="btn pri" data-act="rpPrint">🖨️ طباعة / حفظ PDF</button><button class="btn" data-act="rpCsv">⬇️ CSV (Excel)</button><button class="btn" data-act="rpShare">📤 مشاركة</button></div>`;
  };

  V.phases = () => {
    const p = FF.phase(S), names = ['الأمان المالي', 'الاستقرار المالي', 'بناء الثروة'], desc = ['بناء صندوق الطوارئ، تنظيم المصروفات، إدارة الديون', 'استكمال الطوارئ، زيادة الادخار، بدء الاستثمار المناسب', 'زيادة الأصول وتنويعها وتحقيق الاستقلال المالي'];
    return `<div class="card hero"><div class="lbl">المرحلة الحالية</div><div class="big">${p.current}. ${names[p.current - 1]}</div><div class="lbl">التقدم ${p.progress}%</div></div>
      ${names.map((n, i) => `<div class="card" style="${i + 1 > p.current ? 'opacity:.6' : ''}"><div class="between"><h3>المرحلة ${i + 1}: ${n}</h3>${i + 1 < p.current ? '<span class="pill ok">مكتملة</span>' : i + 1 === p.current ? '<span class="pill">الحالية</span>' : '<span class="pill">مقفلة</span>'}</div><div class="small mut">${desc[i]}</div>
        ${i + 1 === p.current ? p.conds[i].map(c => `<div class="small" style="margin-top:8px">${c.ok ? '✅' : '⬜'} ${c.label}</div>${bar(c.pct, c.ok ? '' : 'gold')}`).join('') : ''}</div>`).join('')}
      ${p.current < 3 ? `<button class="btn pri" style="width:100%" data-act="advancePhase" ${p.canAdvance ? '' : 'disabled'}>${p.canAdvance ? 'الانتقال إلى المرحلة التالية' : 'أكمل شروط المرحلة الحالية للانتقال'}</button>` : ''}
      <div class="note">لا ينتقل التطبيق بك تلقائيًا؛ تظهر لك الشروط، وعند تحققها تؤكد الانتقال بنفسك.</div>`;
  };

  V.settings = () => {
    const s = S.settings;
    return `<div class="card"><h3>عام</h3>
      <label>العملة<select data-chg="currency">${Object.keys(CUR).map(c => `<option value="${c}" ${s.currency === c ? 'selected' : ''}>${c} - ${CUR[c]}</option>`).join('')}</select></label>
      <label>المظهر<select data-chg="theme">${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(x => `<option value="${x[0]}" ${s.theme === x[0] ? 'selected' : ''}>${x[1]}</option>`).join('')}</select></label>
      <label>متوسط الدخل المخطط (للعلم فقط)<input type="text" inputmode="decimal" value="${s.avgIncome}" data-chg="avgIncome"></label>
      <label>حد تنبيه انخفاض الرصيد<input type="text" inputmode="decimal" value="${s.lowBalance}" data-chg="lowBalance"></label></div>
    <div class="card"><h3>البنود والتصنيفات</h3><div class="acts"><button class="btn" data-act="budgetPct">نسب الميزانية</button><button class="btn" data-act="catMgr">إدارة التصنيفات</button></div></div>
    <div class="card"><h3>التنبيهات</h3><label class="chk"><input type="checkbox" ${s.remind ? 'checked' : ''} data-chg="remind"> تذكير بتسجيل المصروفات</label>
      <div class="acts"><button class="btn" data-act="notifOn">تفعيل إشعارات الجهاز</button></div><div class="small mut">${'Notification' in window ? 'حالة الإذن: ' + Notification.permission : 'الإشعارات غير مدعومة'}</div></div>
    <div class="card"><h3>البيانات</h3><div class="acts"><button class="btn pri" data-act="bkExport">نسخة احتياطية (JSON)</button><button class="btn" data-act="bkImport">استعادة نسخة</button><button class="btn" data-act="allCsv">تصدير الكل CSV</button></div>
      <div class="acts"><button class="btn danger" data-act="wipe">حذف كل البيانات</button></div><div class="note">بياناتك محفوظة على جهازك فقط ولا تُرسل لأي خادم. خذ نسخة احتياطية دورية.</div></div>`;
  };

  /* ---------- العرض ---------- */
  const TITLES = { home: '', moves: 'الحركات المالية', budget: 'الميزانية', goals: 'الأهداف والادخار', more: 'المزيد', debts: 'الديون', emergency: 'صندوق الطوارئ', invest: 'الاستثمار والأصول', zakat: 'زكاة المال', reports: 'التقارير', phases: 'المراحل المالية', settings: 'الإعدادات' };
  function render() {
    const th = S.settings.theme; document.documentElement.dataset.theme = th;
    const main = $('#view'); const back = ['debts', 'emergency', 'invest', 'zakat', 'reports', 'phases', 'settings'].includes(ui.view);
    main.innerHTML = (TITLES[ui.view] ? `<div class="between"><h2 style="margin:4px 0 12px">${back ? '<button class="btn sm" data-view="more">→</button> ' : ''}${TITLES[ui.view]}</h2></div>` : '') + V[ui.view]();
    document.querySelectorAll('#nav button').forEach(b => b.classList.toggle('on', b.dataset.view === (back ? 'more' : ui.view)));
    const n = FF.alerts(S).filter(a => a.type !== 'info' && a.type !== 'good').length; const bd = $('#badge'); bd.hidden = !n; bd.textContent = n;
  }
  function go(v) { ui.view = v; render(); scrollTo(0, 0); }

  /* ---------- الإجراءات ---------- */
  const A = {};
  const today = U.today;
  A.alerts = () => { const l = FF.alerts(S); info('التنبيهات', l.length ? l.map(a => `<div class="al ${a.type}">${esc(a.msg)}</div>`).join('') : '<p class="mut">لا توجد تنبيهات 👌</p>'); };

  A.addIncome = id => {
    const m = id && S.movements.find(x => x.id === id);
    const manual = S.buckets.map(b => F('a_' + b.id, esc(b.name), 'num', '')).join('');
    modal(m ? 'تعديل دخل' : 'إضافة دخل', F('amount', 'المبلغ', 'num', m ? m.amount : '') + F('date', 'التاريخ', 'date', m ? m.date : today()) +
      F('type', 'نوع الدخل', 'select', m ? m.type : 'salary', { opts: FF.INCOME_TYPES }) + F('note', 'ملاحظات (اختياري)', 'text', m ? m.note : '') +
      (m ? '<div class="note">عند تعديل المبلغ يُعاد توزيع ما تم تخصيصه سابقًا بنفس النسب.</div>' :
        F('mode', 'طريقة التوزيع', 'select', 'auto', { opts: [['auto', 'توزيع تلقائي حسب النسب'], ['manual', 'توزيع يدوي (املأ المبالغ أدناه)'], ['hold', 'بدون توزيع (يبقى غير موزع)']] }) + `<div class="small mut">المبالغ اليدوية (تُستخدم عند اختيار توزيع يدوي، وما تبقى يظل غير موزع):</div>${manual}`),
      v => {
        let e = amountErr(v.amount) || dateErr(v.date); if (e) return e; const amt = U.r2(U.num(v.amount));
        if (m) {
          const al = S.movements.filter(x => x.group === m.group && x.kind === 'alloc'), sc = FF.scaleAllocs(al, amt);
          if (amt !== m.amount) al.forEach((x, i) => x.amount = sc[i]); Object.assign(m, { amount: amt, date: v.date, type: v.type, note: v.note });
          S.movements.filter(x => x.group === m.group && x.kind === 'alloc').forEach(x => x.date = v.date);
          commit('تم تعديل الدخل'); return true;
        }
        const g = U.uid(), base = { group: g, date: v.date };
        let alloc = {};
        if (v.mode === 'auto') { if (FF.pctSum(S.buckets) !== 100) return 'مجموع نسب الميزانية يجب أن يكون 100% — عدّلها أولًا'; alloc = FF.distribute(amt, S.buckets); }
        else if (v.mode === 'manual') { let t = 0; for (const b of S.buckets) { const x = v['a_' + b.id] === '' ? 0 : U.num(v['a_' + b.id]); if (isNaN(x) || x < 0) return 'مبلغ غير صحيح في ' + b.name; alloc[b.id] = U.r2(x); t += x; } if (U.r2(t) > amt) return 'مجموع التوزيع اليدوي أكبر من الدخل'; }
        push(Object.assign({ id: g, kind: 'income', from: 'EXT', to: 'unalloc', amount: amt, type: v.type, note: v.note }, base));
        Object.keys(alloc).forEach(k => alloc[k] > 0 && push(Object.assign({ kind: 'alloc', from: 'unalloc', to: k, amount: alloc[k] }, base)));
        commit('تمت إضافة الدخل' + (v.mode === 'auto' ? ' وتوزيعه' : '')); return true;
      });
  };

  A.addExpense = id => {
    const m = id && S.movements.find(x => x.id === id);
    modal(m ? 'تعديل مصروف' : 'إضافة مصروف', F('amount', 'المبلغ', 'num', m ? m.amount : '') + F('date', 'التاريخ', 'date', m ? m.date : today()) +
      F('scope', 'النوع', 'select', m ? m.scope : 'home', { opts: [['home', 'مصاريف البيت'], ['personal', 'مصاريف شخصية']] }) +
      F('category', 'التصنيف', 'select', m ? m.category : 'food', { opts: S.categories.filter(c => c.id !== 'debt').map(c => [c.id, c.name]) }) +
      F('from', 'الخصم من', 'select', m ? m.from : 'auto', { opts: [['auto', 'حسب النوع (تلقائي)']].concat(accOpts()) }) + F('desc', 'الوصف', 'text', m ? m.desc : ''),
      v => {
        const e = amountErr(v.amount) || dateErr(v.date); if (e) return e; const amt = U.r2(U.num(v.amount));
        const src = v.from === 'auto' ? (v.scope === 'personal' ? 'personal' : 'essentials') : v.from;
        if (!FF.accounts(S).some(a => a.id === src)) return 'بند الخصم غير موجود';
        if (m) Object.assign(m, { amount: amt, date: v.date, scope: v.scope, category: v.category, from: src, desc: v.desc });
        else push({ kind: 'expense', from: src, to: 'EXT', amount: amt, date: v.date, scope: v.scope, category: v.category, desc: v.desc });
        const over = bal(src) < 0; commit(over ? 'تم الحفظ — ⚠️ تجاوزت رصيد البند' : 'تم حفظ المصروف'); return true;
      });
  };

  A.addTransfer = from => {
    modal('تحويل بين البنود', F('from', 'من', 'select', from && S.buckets.some(b => b.id === from) ? from : 'unalloc', { opts: accOpts() }) + F('to', 'إلى', 'select', 'emergency', { opts: accOpts() }) +
      F('amount', 'المبلغ', 'num', '') + F('date', 'التاريخ', 'date', today()) + F('note', 'ملاحظات', 'text', '') + '<div class="note">التحويل لا يُعد دخلًا ولا مصروفًا ولا يغير إجمالي الرصيد.</div>',
      v => {
        const e = amountErr(v.amount) || dateErr(v.date); if (e) return e; if (v.from === v.to) return 'اختر بندين مختلفين'; const amt = U.r2(U.num(v.amount));
        if (amt > bal(v.from)) return 'الرصيد غير كافٍ في ' + FF.acctName(S, v.from) + ' (' + money(bal(v.from)) + ')';
        push({ kind: 'transfer', from: v.from, to: v.to, amount: amt, date: v.date, note: v.note }); commit('تم التحويل'); return true;
      });
  };
  A.delMove = id => { const m = S.movements.find(x => x.id === id); if (!m) return;
    confirmBox('هل تريد حذف هذه العملية؟' + (m.kind === 'income' ? ' سيُحذف توزيعها أيضًا.' : ''), () => { S.movements = S.movements.filter(x => x.id !== id && !(m.kind === 'income' && x.group === m.group)); commit('تم الحذف'); }); };
  A.mvType = id => { ui.mv.type = id; render(); }; A.mvPeriod = id => { ui.mv.period = id; render(); }; A.mvScope = id => { ui.mv.scope = id; render(); };

  A.budgetPct = () => {
    modal('تعديل نسب الميزانية', S.buckets.map(b => F('n_' + b.id, 'اسم البند', 'text', b.name) + F('p_' + b.id, 'النسبة %', 'num', b.pct)).join('<hr>') + '<div class="note">يجب أن يكون المجموع 100%. التعديل يؤثر على الدخل القادم فقط.</div>',
      v => { const nb = S.buckets.map(b => ({ ...b, name: (v['n_' + b.id] || '').trim(), pct: U.num(v['p_' + b.id]) }));
        if (nb.some(b => !b.name || isNaN(b.pct) || b.pct < 0)) return 'تحقق من الأسماء والنسب'; if (FF.pctSum(nb) !== 100) return 'مجموع النسب ' + FF.pctSum(nb) + '% ويجب أن يساوي 100%';
        S.buckets = nb; commit('تم حفظ النسب'); return true; });
  };
  A.redistribute = () => {
    const un = bal('unalloc'); if (un <= 0) return;
    modal('توزيع الفائض (' + money(un) + ')', F('mode', 'الطريقة', 'select', 'auto', { opts: [['auto', 'تلقائي حسب النسب'], ['manual', 'يدوي']] }) + S.buckets.map(b => F('a_' + b.id, esc(b.name), 'num', '')).join(''),
      v => { let alloc = {};
        if (v.mode === 'auto') { if (FF.pctSum(S.buckets) !== 100) return 'مجموع النسب ليس 100%'; alloc = FF.distribute(un, S.buckets); }
        else { let t = 0; for (const b of S.buckets) { const x = v['a_' + b.id] === '' ? 0 : U.num(v['a_' + b.id]); if (isNaN(x) || x < 0) return 'مبلغ غير صحيح'; alloc[b.id] = U.r2(x); t += x; } if (U.r2(t) > un) return 'المجموع أكبر من الفائض'; if (t <= 0) return 'أدخل مبلغًا'; }
        const g = U.uid(); Object.keys(alloc).forEach(k => alloc[k] > 0 && push({ kind: 'alloc', group: g, from: 'unalloc', to: k, amount: alloc[k], date: today() })); commit('تم توزيع الفائض'); return true; });
  };

  /* الأهداف */
  A.addGoal = id => {
    const g = id && S.goals.find(x => x.id === id);
    modal(g ? 'تعديل هدف' : 'هدف جديد', F('name', 'اسم الهدف', 'text', g ? g.name : '') + F('target', 'المبلغ المطلوب', 'num', g ? g.target : '') + F('deadline', 'الموعد المستهدف (اختياري)', 'date', g ? g.deadline || '' : '') +
      F('priority', 'الأولوية', 'select', g ? g.priority : 2, { opts: [[1, 'عالية'], [2, 'متوسطة'], [3, 'منخفضة']] }) +
      (g ? '' : F('start', 'مبلغ ابتدائي (اختياري)', 'num', '') + F('from', 'يُخصم من', 'select', 'unalloc', { opts: accOpts(null, true) })),
      v => { if (!v.name.trim()) return 'اكتب اسم الهدف'; const e = amountErr(v.target, 'المبلغ المطلوب'); if (e) return e; if (v.deadline && !U.validDate(v.deadline)) return 'التاريخ غير صحيح';
        if (g) { Object.assign(g, { name: v.name.trim(), target: U.r2(U.num(v.target)), deadline: v.deadline, priority: +v.priority }); commit('تم تعديل الهدف'); return true; }
        const ng = { id: U.uid(), name: v.name.trim(), target: U.r2(U.num(v.target)), deadline: v.deadline, priority: +v.priority };
        const st = v.start === '' ? 0 : U.num(v.start); if (isNaN(st) || st < 0) return 'المبلغ الابتدائي غير صحيح'; if (st > bal(v.from)) return 'الرصيد غير كافٍ في ' + FF.acctName(S, v.from);
        S.goals.push(ng); if (st > 0) push({ kind: 'transfer', from: v.from, to: 'g:' + ng.id, amount: U.r2(st), date: today(), note: 'رصيد ابتدائي' }); commit('تم إنشاء الهدف'); return true; });
  };
  A.goalAdd = id => { const g = S.goals.find(x => x.id === id);
    modal('إضافة مال إلى «' + esc(g.name) + '»', F('amount', 'المبلغ', 'num', '') + F('from', 'من', 'select', 'unalloc', { opts: accOpts('g:' + id) }) + F('date', 'التاريخ', 'date', today()),
      v => { const e = amountErr(v.amount) || dateErr(v.date); if (e) return e; const a = U.r2(U.num(v.amount)); if (a > bal(v.from)) return 'الرصيد غير كافٍ (' + money(bal(v.from)) + ')';
        push({ kind: 'transfer', from: v.from, to: 'g:' + id, amount: a, date: v.date, note: 'إضافة لهدف' }); commit('تمت الإضافة'); return true; }); };
  A.goalWd = id => { const g = S.goals.find(x => x.id === id);
    modal('سحب من «' + esc(g.name) + '» (' + money(bal('g:' + id)) + ')', F('amount', 'المبلغ', 'num', '') + F('to', 'إلى', 'select', 'unalloc', { opts: accOpts('g:' + id, true) }) + F('date', 'التاريخ', 'date', today()),
      v => { const e = amountErr(v.amount) || dateErr(v.date); if (e) return e; const a = U.r2(U.num(v.amount)); if (a > bal('g:' + id)) return 'المبلغ أكبر من رصيد الهدف';
        push({ kind: 'transfer', from: 'g:' + id, to: v.to, amount: a, date: v.date, note: 'سحب من هدف' }); commit('تم السحب'); return true; }); };
  A.delGoal = id => { const g = S.goals.find(x => x.id === id), b = bal('g:' + id);
    confirmBox(`حذف الهدف «${esc(g.name)}»؟` + (b > 0 ? ` سيُعاد ${money(b)} إلى «غير موزع».` : ''), () => { if (b > 0) push({ kind: 'transfer', from: 'g:' + id, to: 'unalloc', amount: b, date: today(), note: 'حذف هدف: ' + g.name }); S.goals = S.goals.filter(x => x.id !== id); commit('تم حذف الهدف'); }); };

  /* الطوارئ */
  A.emFund = () => modal('إضافة لصندوق الطوارئ', F('amount', 'المبلغ', 'num', '') + F('from', 'من', 'select', 'unalloc', { opts: accOpts('emergency', true) }) + F('date', 'التاريخ', 'date', today()),
    v => { const e = amountErr(v.amount) || dateErr(v.date); if (e) return e; const a = U.r2(U.num(v.amount)); if (a > bal(v.from)) return 'الرصيد غير كافٍ (' + money(bal(v.from)) + ')';
      push({ kind: 'transfer', from: v.from, to: 'emergency', amount: a, date: v.date, note: 'إضافة لصندوق الطوارئ' }); commit('تمت الإضافة'); return true; });
  A.emTarget = () => modal('هدف صندوق الطوارئ', F('t', 'المبلغ المستهدف', 'num', S.settings.emergencyTarget), v => { const e = amountErr(v.t); if (e) return e; S.settings.emergencyTarget = U.r2(U.num(v.t)); commit('تم تحديث الهدف'); return true; });
  A.emSet = id => { S.settings.emergencyTarget = +id; commit('تم اعتماد الهدف'); };

  /* الديون */
  A.debtEdit = id => { const d = id && S.debts.find(x => x.id === id);
    modal(d ? 'تعديل دين' : 'دين جديد', F('name', 'اسم الدين', 'text', d ? d.name : '') + F('type', 'النوع', 'select', d ? d.type : 'free', { opts: [['free', 'بدون فوائد'], ['interest', 'بفائدة']] }) +
      F('total', 'إجمالي المبلغ', 'num', d ? d.total : '') + F('rem', 'المبلغ المتبقي حاليًا', 'num', d ? FF.debtRemaining(S, d) : '') + F('installment', 'قيمة القسط', 'num', d ? d.installment : '') +
      F('dueDay', 'يوم السداد من الشهر (1-28)', 'num', d ? d.dueDay : 1) + F('rate', 'نسبة الفائدة السنوية % (للديون بفائدة)', 'num', d ? d.rate : 0) + F('notes', 'ملاحظات', 'textarea', d ? d.notes : ''),
      v => { if (!v.name.trim()) return 'اكتب اسم الدين'; const t = U.num(v.total), r = U.num(v.rem), i = v.installment === '' ? 0 : U.num(v.installment), dd = Math.round(U.num(v.dueDay)), rt = v.rate === '' ? 0 : U.num(v.rate);
        if (!(t > 0) || isNaN(r) || r < 0 || r > t || isNaN(i) || i < 0 || !(dd >= 1 && dd <= 31) || isNaN(rt) || rt < 0) return 'تحقق من الأرقام (المتبقي لا يزيد عن الإجمالي)';
        const o = { name: v.name.trim(), type: v.type, total: U.r2(t), installment: U.r2(i), dueDay: dd, rate: rt, notes: v.notes };
        if (d) { Object.assign(d, o); d.opening = U.r2(r + FF.debtPaid(S, d)); } else S.debts.push(Object.assign({ id: U.uid(), opening: U.r2(r) }, o));
        commit('تم حفظ الدين'); return true; }); };
  A.debtPay = id => { const d = S.debts.find(x => x.id === id), r = FF.debtRemaining(S, d);
    modal('سداد: ' + esc(d.name), F('amount', 'المبلغ (المتبقي ' + money(r) + ')', 'num', Math.min(d.installment || r, r)) + F('from', 'الدفع من', 'select', 'debt', { opts: accOpts() }) + F('date', 'التاريخ', 'date', today()) + F('desc', 'ملاحظات', 'text', ''),
      v => { const e = amountErr(v.amount) || dateErr(v.date); if (e) return e; const a = U.r2(U.num(v.amount)); if (a > r) return 'المبلغ أكبر من المتبقي من الدين';
        push({ kind: 'debtpay', from: v.from, to: 'EXT', amount: a, date: v.date, debtId: id, category: 'debt', scope: 'home', desc: v.desc }); commit(bal(v.from) < 0 ? 'تم السداد — ⚠️ تجاوزت رصيد البند' : 'تم تسجيل السداد'); return true; }); };
  A.debtSched = id => { const d = S.debts.find(x => x.id === id), sc = FF.schedule(S, d);
    info('جدول سداد: ' + esc(d.name), sc.infinite ? '<p class="neg">القسط الحالي لا يغطي الفائدة، فلن ينتهي الدين. ارفع القسط.</p>' : !sc.rows.length ? '<p>لا يوجد متبقٍ.</p>' : `<table><tr><th>#</th><th>التاريخ</th><th>القسط</th><th>فائدة</th><th>المتبقي</th></tr>${sc.rows.map(r => `<tr><td>${r.n}</td><td>${r.date}</td><td>${r.payment}</td><td>${r.interest}</td><td>${r.remaining}</td></tr>`).join('')}</table><div class="note">الجدول تقديري على افتراض الالتزام بالقسط والتواريخ.</div>`); };
  A.debtDel = id => { const d = S.debts.find(x => x.id === id), n = S.movements.filter(m => m.debtId === id).length;
    confirmBox(`حذف الدين «${esc(d.name)}»؟` + (n ? ` يوجد ${n} عملية سداد مرتبطة؛ ستبقى في سجل المصروفات.` : ''), () => { S.debts = S.debts.filter(x => x.id !== id); commit('تم حذف الدين'); }); };

  /* الاستثمار */
  A.invEdit = id => { const i = id && S.investments.find(x => x.id === id);
    modal(i ? 'تعديل أصل' : 'أصل جديد', F('name', 'اسم الأصل', 'text', i ? i.name : '') + F('type', 'نوع الاستثمار', 'select', i ? i.type : 'أخرى', { opts: FF.INV_TYPES.map(x => [x, x]) }) + F('invested', 'المبلغ المستثمر', 'num', i ? i.invested : '') +
      (i ? '' : F('value', 'القيمة الحالية', 'num', '')) + F('date', 'تاريخ الشراء', 'date', i ? i.date : today()) +
      (i ? '' : F('from', 'خصم المبلغ المستثمر من', 'select', 'none', { opts: [['none', 'بدون خصم (أصل موجود مسبقًا)']].concat(accOpts(null, true)) })),
      v => { if (!v.name.trim()) return 'اكتب اسم الأصل'; const inv = U.num(v.invested); if (!(inv > 0)) return 'المبلغ المستثمر غير صحيح'; const e = dateErr(v.date); if (e) return e;
        if (i) { Object.assign(i, { name: v.name.trim(), type: v.type, invested: U.r2(inv), date: v.date }); commit('تم التعديل'); return true; }
        const val = v.value === '' ? inv : U.num(v.value); if (isNaN(val) || val < 0) return 'القيمة الحالية غير صحيحة'; if (v.from !== 'none' && inv > bal(v.from)) return 'الرصيد غير كافٍ (' + money(bal(v.from)) + ')';
        const a = { id: U.uid(), name: v.name.trim(), type: v.type, invested: U.r2(inv), value: U.r2(val), date: v.date, history: [{ date: v.date, value: U.r2(inv) }, { date: today(), value: U.r2(val) }] };
        S.investments.push(a); if (v.from !== 'none') push({ kind: 'invest', from: v.from, to: 'EXT', amount: a.invested, date: v.date, assetId: a.id }); commit('تمت إضافة الأصل'); return true; }); };
  A.invValue = id => { const i = S.investments.find(x => x.id === id);
    modal('تحديث قيمة ' + esc(i.name), F('value', 'القيمة الحالية', 'num', i.value) + F('date', 'التاريخ', 'date', today()), v => { const n = U.num(v.value); if (isNaN(n) || n < 0) return 'قيمة غير صحيحة'; const e = dateErr(v.date); if (e) return e; i.value = U.r2(n); (i.history = i.history || []).push({ date: v.date, value: i.value }); commit('تم تحديث القيمة'); return true; }); };
  A.invSell = id => { const i = S.investments.find(x => x.id === id);
    modal('بيع ' + esc(i.name), F('amount', 'قيمة البيع', 'num', i.value) + F('to', 'إيداع في', 'select', 'unalloc', { opts: accOpts(null, true) }) + F('date', 'التاريخ', 'date', today()),
      v => { const n = U.num(v.amount); if (isNaN(n) || n < 0) return 'قيمة غير صحيحة'; const e = dateErr(v.date); if (e) return e; i.sold = true; i.soldFor = U.r2(n); i.value = 0;
        if (n > 0) push({ kind: 'sale', from: 'EXT', to: v.to, amount: U.r2(n), date: v.date, assetId: id }); commit('تم تسجيل البيع'); return true; }); };
  A.invDel = id => confirmBox('حذف سجل الأصل؟ لن يتم رد أي مبلغ للأرصدة.', () => { S.investments = S.investments.filter(x => x.id !== id); commit('تم الحذف'); });

  /* الزكاة */
  A.zakatEdit = () => { const z = S.settings.zakat, sm = FF.summary(S);
    modal('بيانات الزكاة', F('cash', 'المدخرات النقدية (اتركه فارغًا لاستخدام رصيد التطبيق ' + money(sm.cash) + ')', 'num', z.cash) + F('receivables', 'أموال مستحقة لك (مرجوّ سدادها)', 'num', z.receivables) +
      F('assets', 'أصول داخلة في الوعاء (تجارة/استثمار) — قيمتها الحالية ' + money(sm.invest) + ' كمرجع', 'num', z.assets) + F('debts', 'ديون حالّة تُخصم', 'num', z.debts) + F('nisab', 'قيمة النصاب بالعملة', 'num', z.nisab) + F('hawlStart', 'تاريخ بداية الحول', 'date', z.hawlStart),
      v => { const o = {}; for (const k of ['cash', 'receivables', 'assets', 'debts', 'nisab']) { if (v[k] === '') { o[k] = (k === 'cash' || k === 'nisab') ? '' : 0; continue; } const n = U.num(v[k]); if (isNaN(n) || n < 0) return 'قيمة غير صحيحة'; o[k] = U.r2(n); }
        if (v.hawlStart && !U.validDate(v.hawlStart)) return 'التاريخ غير صحيح'; S.settings.zakat = Object.assign(o, { hawlStart: v.hawlStart }); commit('تم الحفظ'); return true; }); };

  /* المراحل */
  A.advancePhase = () => { const p = FF.phase(S); if (!p.canAdvance) return toast('شروط المرحلة لم تكتمل', true); confirmBox('تأكيد الانتقال إلى المرحلة ' + (p.current + 1) + '؟', () => { S.settings.phase++; commit('مبروك! انتقلت للمرحلة التالية'); }, 'انتقال'); };

  /* التقارير */
  A.rpKind = id => { ui.rp.kind = id; render(); };
  A.rpPrint = () => window.print();
  function download(name, text, type) { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); }
  const movRows = ms => [['التاريخ', 'النوع', 'التصنيف/الوصف', 'من', 'إلى', 'المبلغ', 'ملاحظات']].concat(ms.slice().sort((a, b) => a.date.localeCompare(b.date)).map(m => [m.date, { income: 'دخل', expense: 'مصروف', debtpay: 'سداد دين', transfer: 'تحويل', invest: 'استثمار', sale: 'بيع أصل' }[m.kind], m.kind === 'income' ? incName(m.type) : m.category ? catName(m.category) : '', FF.acctName(S, m.from), FF.acctName(S, m.to), m.amount, m.note || m.desc || '']));
  A.rpCsv = () => { const { r } = reportData(); download(`report-${r.from}_${r.to}.csv`, FF.toCSV(movRows(S.movements.filter(m => m.kind !== 'alloc' && FF.inRange(m, r.from, r.to)))), 'text/csv;charset=utf-8'); toast('تم تصدير الملف'); };
  A.rpShare = async () => { const { r, cur } = reportData(); const t = `تقرير الحرية النهائية (${r.from} → ${r.to})\nالدخل: ${money(cur.income)}\nالمصروفات: ${money(cur.expenses)}\nسداد الديون: ${money(cur.debtPaid)}\nصافي التغير: ${money(cur.net)}`;
    try { if (navigator.share) await navigator.share({ title: 'تقرير مالي', text: t }); else { await navigator.clipboard.writeText(t); toast('تم نسخ التقرير'); } } catch (e) { } };

  /* الإعدادات */
  A.catMgr = () => {
    const used = id => S.movements.some(m => m.category === id);
    info('التصنيفات', S.categories.map(c => `<div class="item"><span>${esc(c.name)} ${c.essential ? '<span class="pill">أساسي</span>' : ''}</span>${c.id === 'debt' || used(c.id) ? '<span class="small mut">مستخدم</span>' : `<button class="btn sm" data-act="catDel" data-id="${c.id}">حذف</button>`}</div>`).join('') +
      `<form id="catf" class="row" style="margin-top:10px"><input name="n" placeholder="تصنيف جديد" style="margin:0"><label class="chk" style="margin:0;flex:none"><input type="checkbox" name="e"> أساسي</label><button class="btn pri" style="flex:none">إضافة</button></form>`);
    $('#catf').onsubmit = e => { e.preventDefault(); const f = e.target, n = f.n.value.trim(); if (!n) return; S.categories.push({ id: 'c_' + U.uid(), name: n, essential: f.e.checked }); commit(); A.catMgr(); };
  };
  A.catDel = id => { S.categories = S.categories.filter(c => c.id !== id); commit(); A.catMgr(); };
  A.notifOn = async () => { if (!('Notification' in window)) return toast('غير مدعوم', true); const p = await Notification.requestPermission(); toast(p === 'granted' ? 'تم تفعيل الإشعارات' : 'لم يتم منح الإذن', p !== 'granted'); render(); };
  A.bkExport = () => { download('final-freedom-backup-' + today() + '.json', JSON.stringify(S, null, 1), 'application/json'); toast('تم تنزيل النسخة الاحتياطية'); };
  A.allCsv = () => { download('final-freedom-all-' + today() + '.csv', FF.toCSV(movRows(S.movements.filter(m => m.kind !== 'alloc'))), 'text/csv;charset=utf-8'); toast('تم التصدير'); };
  A.bkImport = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = '.json,application/json'; i.onchange = async () => { try { const d = JSON.parse(await i.files[0].text());
    if (!d || !Array.isArray(d.movements) || !Array.isArray(d.buckets) || !d.settings) throw new Error('ملف غير صالح');
    confirmBox('سيتم استبدال بياناتك الحالية بالنسخة المختارة. تأكيد؟', () => { S = Object.assign(FF.defaultState(), d); commit('تمت استعادة البيانات'); }, 'استعادة'); } catch (e) { toast('فشل الاستيراد: ' + e.message, true); } }; i.click(); };
  A.wipe = () => confirmBox('سيتم حذف كل بياناتك نهائيًا من هذا الجهاز. هل أنت متأكد؟', async () => { await DB.clear(); S = FF.defaultState(); await commit('تم حذف البيانات'); }, 'حذف نهائي');

  /* ---------- تغييرات الحقول ---------- */
  const C = {
    currency: v => { S.settings.currency = v; commit(); }, theme: v => { S.settings.theme = v; commit(); },
    avgIncome: v => { const n = U.num(v); if (n >= 0) S.settings.avgIncome = n; commit('تم الحفظ'); }, lowBalance: v => { const n = U.num(v); if (n >= 0) S.settings.lowBalance = n; commit('تم الحفظ'); },
    remind: (v, el) => { S.settings.remind = el.checked; commit(); }, rpRef: v => { if (U.validDate(v)) { ui.rp.ref = v; render(); } }
  };

  document.addEventListener('click', e => {
    if (e.target.closest('[data-close]') || e.target.id === 'modal') return closeModal();
    const v = e.target.closest('[data-view]'); if (v) return go(v.dataset.view);
    const t = e.target.closest('[data-act]'); if (t && A[t.dataset.act]) A[t.dataset.act](t.dataset.id, t);
  });
  document.addEventListener('change', e => { const t = e.target.closest('[data-chg]'); if (t && C[t.dataset.chg]) C[t.dataset.chg](t.type === 'checkbox' ? t.checked : t.value, t); });
  document.addEventListener('input', e => { if (e.target.dataset.inp === 'mvq') { ui.mv.q = e.target.value; $('#mvlist').innerHTML = mvList(); } });

  /* ---------- الإقلاع ---------- */
  async function boot() {
    let d = null; try { d = await DB.load(); } catch (e) { }
    S = d ? Object.assign(FF.defaultState(), d) : FF.defaultState();
    S.settings = Object.assign(FF.defaultState().settings, S.settings);
    if (!d) { try { await DB.save(S); } catch (e) { toast('التخزين غير متاح في هذا المتصفح', true); } }
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { }
    render();
    try { if (S.settings.remind && 'Notification' in window && Notification.permission === 'granted' && localStorage.getItem('ff_n') !== today()) {
      const w = FF.alerts(S).filter(a => a.type === 'warn' || a.type === 'bad'); if (w.length) { localStorage.setItem('ff_n', today()); const reg = await navigator.serviceWorker.ready; reg.showNotification('الحرية النهائية', { body: w[0].msg, icon: 'icons/icon-192.png', dir: 'rtl', lang: 'ar' }); } } } catch (e) { }
  }
  window.addEventListener('error', e => toast('حدث خطأ: ' + e.message, true));
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
  boot();
})();
