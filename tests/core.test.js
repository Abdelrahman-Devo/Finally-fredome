const assert = require('assert');
const F = require('../js/core.js');
const { U } = F;
let pass = 0; const t = (n, f) => { f(); pass++; console.log('✓', n); };
const S = F.defaultState();
const today = '2026-11-21';
const mk = (o) => S.movements.push(Object.assign({ id: U.uid(), date: today }, o));

t('مجموع النسب الافتراضية = 100', () => assert.strictEqual(F.pctSum(S.buckets), 100));
t('التوزيع يساوي المبلغ بالضبط (حتى مع الكسور)', () => {
  [6000, 1234.57, 999.99, 1, 7777.77].forEach(a => { const d = F.distribute(a, S.buckets); assert.strictEqual(U.r2(Object.values(d).reduce((x, y) => x + y, 0)), a); });
});
t('دخل 6000 يوزع تلقائيًا ولا يضاعف الرصيد', () => {
  const g = 'g1'; mk({ kind: 'income', group: g, from: 'EXT', to: 'unalloc', amount: 6000, type: 'salary' });
  const d = F.distribute(6000, S.buckets); S.buckets.forEach(b => mk({ kind: 'alloc', group: g, from: 'unalloc', to: b.id, amount: d[b.id] }));
  const m = F.summary(S, today);
  assert.strictEqual(m.cash, 6000); assert.strictEqual(m.unalloc, 0); assert.strictEqual(m.bal.essentials, 3600);
  assert.strictEqual(m.bal.emergency, 1002); assert.strictEqual(m.income, 6000); assert.strictEqual(m.netWorth, 6000 - 18000);
});
t('المصروف يخصم من البند ومن الإجمالي', () => {
  mk({ kind: 'expense', from: 'essentials', to: 'EXT', amount: 500, category: 'food', scope: 'home' });
  const m = F.summary(S, today); assert.strictEqual(m.cash, 5500); assert.strictEqual(m.bal.essentials, 3100); assert.strictEqual(m.expenses, 500);
});
t('التحويل بين البنود لا يغير الإجمالي ولا الدخل ولا المصروفات', () => {
  S.goals.push({ id: 'x', name: 'لابتوب', target: 1000, priority: 1 });
  mk({ kind: 'transfer', from: 'personal', to: 'g:x', amount: 100 });
  const m = F.summary(S, today); assert.strictEqual(m.cash, 5500); assert.strictEqual(m.income, 6000); assert.strictEqual(m.expenses, 500);
  assert.strictEqual(m.bal.personal, 200); assert.strictEqual(m.bal['g:x'], 100); assert.strictEqual(m.goalsPct, 10);
});
t('سداد دين يحدّث المتبقي تلقائيًا ويخصم من البند', () => {
  mk({ kind: 'debtpay', from: 'debt', to: 'EXT', amount: 700, debtId: 'd_main', category: 'debt' });
  const m = F.summary(S, today); assert.strictEqual(m.debts, 17300); assert.strictEqual(m.cash, 4800);
  assert.strictEqual(m.netWorth, 4800 - 17300);
});
t('صافي الثروة لا يتأثر بسداد الدين (يتغير فقط بقدر الخصم من النقد مقابل الدين)', () => {
  const before = F.summary(S, today).netWorth; mk({ kind: 'debtpay', from: 'debt', to: 'EXT', amount: 98, debtId: 'd_main', category: 'debt' });
  assert.strictEqual(F.summary(S, today).netWorth, before);
});
t('جدول السداد 17202 / 800', () => {
  const sc = F.schedule(S, S.debts[0], today); assert.strictEqual(sc.months, Math.ceil(17202 / 800));
  assert.strictEqual(sc.rows[sc.rows.length - 1].remaining, 0);
});
t('دين بفائدة أقل من الفائدة الشهرية = لا ينتهي', () => {
  const d = { id: 'z', opening: 10000, installment: 50, type: 'interest', rate: 24, dueDay: 5 }; assert.ok(F.schedule({ movements: [] }, d, today).infinite);
});
t('الطوارئ: النسبة والمتبقي', () => {
  const e = F.emergency(S, today); assert.strictEqual(e.balance, 1002); assert.strictEqual(e.remaining, 2598); assert.strictEqual(e.pct, 28);
});
t('الدخل: متوسط 3 و6 شهور', () => {
  mk({ kind: 'income', from: 'EXT', to: 'unalloc', amount: 3000, date: '2026-10-10', group: 'a' });
  const s = F.incomeStats(S, today); assert.strictEqual(s.month, 6000); assert.strictEqual(s.avg3, 3000); assert.strictEqual(s.avg6, 1500);
});
t('الزكاة', () => {
  assert.strictEqual(F.zakat({ cash: 100000, nisab: 200000, hawlStart: '2025-01-01', today }).due, 0);
  const z = F.zakat({ cash: 300000, receivables: 20000, debts: 20000, nisab: 200000, hawlStart: '2025-10-01', today }); assert.strictEqual(z.due, 7500);
  assert.strictEqual(F.zakat({ cash: 300000, nisab: 200000, hawlStart: '2026-10-01', today }).due, 0);
});
t('التقرير الشهري', () => {
  const r = F.report(S, '2026-11-01', '2026-11-30'); assert.strictEqual(r.income, 6000); assert.strictEqual(r.debtPaid, 798); assert.strictEqual(r.net, 5500);
  assert.strictEqual(r.cat.food, 500);
});
t('الفترات: الأسبوع يبدأ السبت', () => { const r = F.range('week', '2026-11-21'); assert.strictEqual(r.from, '2026-11-21'); assert.strictEqual(r.to, '2026-11-27'); });
t('المراحل: لا ينتقل تلقائيًا', () => { const p = F.phase(S, today); assert.strictEqual(p.current, 1); assert.strictEqual(p.canAdvance, false); });
t('rescale للدخل المعدّل', () => {
  const al = S.movements.filter(m => m.group === 'g1' && m.kind === 'alloc'); const n = F.scaleAllocs(al, 3000);
  assert.strictEqual(U.r2(n.reduce((a, x) => a + x, 0)), 3000);
});
t('الأرقام العربية والتحويل', () => { assert.strictEqual(U.num('١٢٣٫٥'), 123.5); assert.strictEqual(U.num('1,200'), 1200); assert.ok(isNaN(U.num('abc'))); });
t('التنبيهات تعمل', () => { assert.ok(Array.isArray(F.alerts(S, today))); });
console.log('\nكل الاختبارات نجحت:', pass);
