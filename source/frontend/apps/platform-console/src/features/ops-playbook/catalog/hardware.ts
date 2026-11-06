import type { Playbook } from '../types'
import { bi } from '../i18n'

export const accessCardsPlaybook: Playbook = {
  id: 'access-cards-pvc',
  category: 'hardware',
  title: { en: 'Member cards', ar: 'كروت الأعضاء' },
  purpose: {
    en: 'Print blank gym cards and assign them to members. The card belongs to the gym, not to HyMotion.',
    ar: 'اطبع كروت النادي الفارغة وعلّقها على الأعضاء. الكرت للنادي مش لـ HyMotion.',
  },
  whenToUse: {
    en: 'You print gym cards, restock, or a member lost a card.',
    ar: 'بتطبعوا كروت النادي، أو بتعيدوا مخزون، أو عضو ضيّع الكرت.',
  },
  preconditions: [
    bi('Gym Settings identity is filled (logo, English name, Arabic name, card color).', 'هوية إعدادات النادي متعبية (لوجو، اسم إنجليزي، اسم عربي، لون الكرت).'),
    bi('Windows printer works. There is no separate HyMotion printer wizard.', 'طابعة ويندوز تشتغل. مفيش معالج طابعة منفصل في HyMotion.'),
  ],
  requiredAccess: {
    en: 'Desk staff with access-cards permission. Owner for gym identity. Inventory if cards are stocked as products.',
    ar: 'موظفو المكتب بصلاحية الكروت. المالك لهوية النادي. المخزن لو الكروت أصناف مخزن.',
  },
  risk: 'safe',
  audience: 'both',
  customerSummary: {
    en: 'Cards show your gym name and logo. Print blanks, then assign a card to a member.',
    ar: 'الكروت باسم ناديكم واللوجو. اطبعوا فاضي، بعدين علّقوا الكرت على العضو.',
  },
  steps: [
    {
      id: 'identity',
      action: bi('Owner: Settings → gym name, logo, card color. Check it looks like your gym.', 'المالك: الإعدادات ← اسم النادي، اللوجو، لون الكرت. تأكد إنه شبه ناديكم.'),
      who: 'owner',
      expected: bi('The name and logo look right.', 'الاسم واللوجو صح.'),
      verification: bi('Arabic name is readable. Then print.', 'الاسم العربي مقروء. بعدين اطبع.'),
      risk: 'safe',
      audience: 'both',
    },
    {
      id: 'blank',
      action: bi('Open Access Cards. Print one blank card first. The gym name should be large. HyMotion may appear as a tiny line only.', 'افتح كروت الدخول. اطبع كرت فاضي واحد الأول. اسم النادي كبير. HyMotion ممكن سطر صغير بس.'),
      who: 'staffOnPc',
      expected: bi('The card is your gym, not HyMotion as the gym.', 'الكرت ناديكم، مش HyMotion كنادي.'),
      verification: bi('No member name or photo on the blank. Owner likes one card before a pile.', 'مفيش اسم عضو أو صورة على الفاضي. المالك عاجبه كرت واحد قبل الكمية.'),
      risk: 'safe',
      audience: 'both',
      tech: bi('AccessCardHtmlBuilder.BuildBlankStockBatch. GET /api/access-cards/print-html. Barcode is AccessCard.Code (Code128), not MemberNumber.', 'الدفعة من AccessCardHtmlBuilder. الباركود AccessCard.Code مش رقم العضو.'),
    },
    {
      id: 'assign',
      action: bi('Open the member. Assign the card (scan it or type the code on the card).', 'افتح العضو. عيّن الكرت (امسحه أو اكتب الكود اللي عليه).'),
      who: 'staffOnPc',
      expected: bi('The member shows that card.', 'العضو فيه الكرت ده.'),
      verification: bi('Scan at the door. The member checks in.', 'امسح عند الباب. العضو يدخل.'),
      risk: 'safe',
      audience: 'both',
      tech: bi('POST attendance barcode-checkin { code }. EntryMethod=barcode. AccessCard.Code is the payload, not MemberNumber.', 'check-in بالباركود على AccessCard.Code.'),
    },
    {
      id: 'printer',
      action: bi('Use the Windows printer dialog from the print HTML. If the contract sold a card printer, install its Windows driver — HyMotion has no printer setup wizard.', 'استخدم حوار طابعة ويندوز من HTML الطباعة. لو العقد باع طابعة كروت، ثبّت درايفر ويندوز — مفيش معالج طابعة في HyMotion.'),
      who: 'support',
      expected: bi('One test card. Mark N/A only if this gym is QR/phone only.', 'كرت تجربة. غير منطبق بس لو النادي QR/موبايل بس.'),
      verification: bi('Contract line HY-HW-PVC / HY-HW-PRINTER matches what is on site, or N/A.', 'بند العقد HY-HW-PVC / HY-HW-PRINTER يطابق الموقع، أو غير منطبق.'),
      risk: 'safe',
      audience: 'support',
    },
  ],
  failures: [
    {
      id: 'hymotion-branded',
      title: bi('Cards printed with HyMotion as the gym', 'الكروت اتطبعت و HyMotion هو النادي'),
      whatHappened: bi('Gym identity was empty or the wrong builder was used.', 'هوية النادي فاضية أو اتستخدم باني غلط.'),
      doNot: bi('Do not ship a hundred HyMotion-branded cards. Do not put member photos on blank stock.', 'متشحنش مية كرت بعلامة HyMotion. ومتتحطش صور أعضاء على المخزون الفاضي.'),
      immediate: bi('Fix Gym Settings, reprint one, shred the wrong blanks if they went to members.', 'صلّح إعدادات النادي، اطبع واحد، إعدم الغلط لو وصل للأعضاء.'),
      recovery: bi('Blank stock must lead with tenant gym logo and names.', 'المخزون الفاضي يبدأ بلوجو وأسماء النادي.'),
      escalation: bi('Escalate if a vendor file overrode the HTML builder.', 'صعّد لو ملف مورّد غلب باني HTML.'),
      logs: bi('Print HTML; Gym Settings', 'HTML الطباعة؛ إعدادات النادي'),
      customerMessage: bi('We will reprint with your gym name. Please do not hand out the wrong batch.', 'هنطبع تاني باسم ناديكم. متوزّعوش الدفعة الغلط.'),
      closure: bi('Owner accepted one correctly branded card.', 'المالك قبل كرت بعلامتهم.'),
    },
  ],
  recovery: {
    en: 'Reprint blanks after identity is correct. Re-assign the member’s card code if the physical card changed.',
    ar: 'أعد طباعة الفاضي بعد ما الهوية تصح. أعد تعيين كود الكرت لو الكرت الفيزيائي اتغيّر.',
  },
  escalation: {
    en: 'Printer driver failure, or attendance scan that still expects MemberNumber only.',
    ar: 'فشل درايفر الطابعة، أو مسح حضور لسه متوقع رقم العضو بس.',
  },
  customerCommunication: {
    en: 'These are your gym’s cards. Keep unused blanks in the office. Lost card: assign a new code; do not print the member’s photo on blanks.',
    ar: 'دي كروت ناديكم. الفاضي في المكتب. كرت ضايع: عيّنوا كود جديد؛ متطبعوش صورة العضو على الفاضي.',
  },
  securityWarnings: [
    bi('Blank stock must not carry member PII.', 'المخزون الفاضي من غير بيانات عضو.'),
    bi('Treat card codes like door tokens — do not publish a sheet of unassigned codes.', 'كود الكرت زي مفتاح باب — متنشروش شيت أكواد مش متعينة.'),
  ],
  finalVerification: [
    bi('One branded blank + one assigned member scan at attendance', 'كرت فاضي بعلامة النادي + مسح عضو معيّن في الحضور'),
  ],
  closure: [
    bi('Gym identity confirmed', 'هوية النادي اتأكدت'),
    bi('Test print accepted or N/A', 'طبعة التجربة اتقبلت أو غير منطبقة'),
    bi('Check-in by card works or N/A', 'الحضور بالكرت شغال أو غير منطبق'),
  ],
}
