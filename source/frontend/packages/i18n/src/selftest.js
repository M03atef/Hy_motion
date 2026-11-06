import {
  t,
  pickBilingual,
  splitSlashBilingual,
  statusLabel,
  formatMoney,
  listKeys,
} from './index.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

assert(t('common.save', undefined, 'en') === 'Save', 'en save');
assert(t('common.save', undefined, 'ar') === 'حفظ', 'ar save');
assert(t('members.greeting', { name: 'Ali' }, 'en') === 'Hello, Ali', 'interp');
assert(statusLabel('active', 'ar') === 'نشط', 'status');
assert(pickBilingual('Hi', 'مرحبا', 'ar') === 'مرحبا', 'pick');
assert(splitSlashBilingual('A / ب').messageAr === 'ب', 'slash');
const money = formatMoney(12500, 'en');
assert(money.includes('12') && money.includes('EGP'), 'money ' + money);
assert(listKeys().length > 50, 'keys');

console.log('@gymflowpro/i18n selftest OK (' + listKeys().length + ' keys)');
