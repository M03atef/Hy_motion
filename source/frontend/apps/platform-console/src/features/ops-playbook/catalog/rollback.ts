import type { Playbook } from '../types'
import { bi } from '../i18n'

export const rollbackPlaybook: Playbook = {
  id: 'rollback-prerestore',
  category: 'recovery',
  title: { en: 'Rollback / disaster recovery (PreRestore)', ar: 'الرجوع / التعافي (PreRestore)' },
  purpose: {
    en: 'Undo a restore using the safety copy HyMotion took automatically just before it overwrote the gym.',
    ar: 'ألغي استعادة باستخدام النسخة الاحترازية اللي HyMotion أخدها لوحده قبل ما يكتب فوق النادي.',
  },
  whenToUse: {
    en: 'After a restore that must be undone. Support-only. Not a customer Desk action.',
    ar: 'بعد استعادة لازم تتلغي. للدعم بس. مش إجراء في مكتب العميل.',
  },
  preconditions: [
    bi('A PreRestore_* folder exists under C:\\ProgramData\\HyMotion\\Backups and integrity passes.', 'مجلد PreRestore_* موجود تحت Backups والسلامة تعدي.'),
    bi('Owner approved another short outage.', 'المالك وافق على توقف قصير تاني.'),
  ],
  requiredAccess: { en: 'Windows Administrator. Support view.', ar: 'مسؤول ويندوز. رؤية الدعم.' },
  risk: 'destructive',
  audience: 'support',
  customerSummary: {
    en: 'We are putting the gym back to how it was just before the last restore. Do not use the Desk.',
    ar: 'بنرجّع النادي لوضعه قبل آخر استعادة. متستخدمش المكتب.',
  },
  lifecycle: [
    bi('Restore ran', 'الاستعادة اتنفّذت'),
    bi('Safety PreRestore_* exists', 'PreRestore_* موجود'),
    bi('Diagnose', 'تشخيص'),
    bi('Rollback decision', 'قرار الرجوع'),
    bi('Restore PreRestore_*', 'استعادة PreRestore_*'),
    bi('Service + health', 'الخدمة والصحة'),
    bi('Login + data', 'دخول وبيانات'),
    bi('Close incident', 'قفل الحادثة'),
  ],
  steps: [
    {
      id: 'identify',
      action: bi('List backups. Pick the PreRestore_* created immediately before the bad restore.', 'اعرض النسخ. اختار PreRestore_* اللي قبل الاستعادة الغلط.'),
      who: 'support',
      expected: bi('The folder name is the backup id. Status is Healthy or Partial, and the files still match.', 'اسم المجلد هو معرف النسخة. الحالة سليم أو جزئي، والملفات لسه مطابقة.'),
      verification: bi('Do not use -Latest. That would put back the restore you are trying to undo.', 'متستخدمش -Latest. ده هيرجع الاستعادة اللي بتحاول تلغيها.'),
      risk: 'support_only',
      audience: 'support',
      tech: bi('PreRestore_* lives under C:\\ProgramData\\HyMotion\\Backups. Integrity same as HyMotionBackup_*. Exit 2 Partial was allowed when the safety copy was taken.', 'PreRestore_* تحت Backups. نفس فحص السلامة. خروج 2 جزئي كان مسموح وقت أخذ الاحترازية.'),
      commands: [
        {
          id: 'list',
          label: bi('List backup folders', 'عرض مجلدات النسخ'),
          text: 'Get-ChildItem C:\\ProgramData\\HyMotion\\Backups | Select-Object Name, LastWriteTime',
          supportOnly: true,
        },
      ],
    },
    {
      id: 'run',
      action: bi('Administrator PowerShell from the HyMotion service folder: Restore-HyMotion.ps1 -BackupId PreRestore_…', 'PowerShell كمسؤول من مجلد الخدمة: -BackupId PreRestore_…'),
      who: 'support',
      expected: bi('A new safety copy of the bad state may be taken first. Then the old live gym comes back.', 'ممكن تتاخد نسخة احترازية جديدة للحالة الغلط الأول. بعدين النادي القديم يرجع.'),
      verification: bi('Exit 0, health 200, members and sales match before the incident.', 'خروج 0، صحة 200، الأعضاء والبيع يطابقوا قبل الحادثة.'),
      risk: 'destructive',
      audience: 'support',
      tech: bi('Restore-HyMotion.ps1 -BackupId PreRestore_yyyy-MM-dd_HHmmss from the HyMotion service directory. Same flow as restore (integrity, confirm RESTORE, optional new PreRestore, SQL REPLACE, uploads). Do not -SkipSafetyBackup unless a known-good PreRestore already exists.', '-BackupId PreRestore_… من مجلد الخدمة. نفس مسار الاستعادة. متتخطاش الاحترازية إلا لو PreRestore كويس موجود.'),
      commands: [
        {
          id: 'prerestore',
          label: bi('Rollback (replace the id)', 'رجوع (بدّل المعرف)'),
          text: `$dir = Split-Path ((Get-CimInstance Win32_Service -Filter "Name='HyMotion'").PathName.Trim('"'))
Set-Location $dir
.\\install-scripts\\backup\\Restore-HyMotion.ps1 -BackupId PreRestore_yyyy-MM-dd_HHmmss`,
          supportOnly: true,
        },
      ],
    },
    {
      id: 'uploads-rollback',
      action: bi('If photos still wrong, check C:\\ProgramData\\HyMotion\\uploads.rollback-* from the failed swap.', 'لو الصور لسه غلط، راجع uploads.rollback-* من التبديل الفاشل.'),
      who: 'support',
      expected: bi('Do not invent a second unzip tool; prefer another official restore.', 'متخترعش أداة فك تانية؛ فضّل استعادة رسمية.'),
      verification: bi('Upload count vs backup zip.', 'عدد الملفات مقابل الـ zip.'),
      risk: 'support_only',
      audience: 'support',
    },
  ],
  failures: [
    {
      id: 'no-prerestore',
      title: bi('No PreRestore folder', 'مفيش مجلد PreRestore'),
      whatHappened: bi('SkipSafetyBackup was used, or PreRestore failed and someone continued anyway (should not).', 'اتخطّت الاحترازية، أو PreRestore فشل واتكمّل (مفروضش).'),
      doNot: bi('Do not invent a backup from SQL snapshots we do not ship.', 'متخترعش نسخة من لقطات SQL مش موجودة في المنتج.'),
      immediate: bi('Look for any older Healthy HyMotionBackup_*. Restore that id if the owner accepts that date.', 'دور على HyMotionBackup_* أقدم سليم.'),
      recovery: bi('If nothing exists, this is data-loss communication — see policies.', 'لو مفيش، دي رسالة فقدان بيانات — شوف السياسات.'),
      escalation: bi('Always escalate missing PreRestore after a destructive restore.', 'صعّد دايمًا لو PreRestore ضاع بعد استعادة تدميرية.'),
      logs: bi('Backups directory listing', 'قائمة مجلد Backups'),
      customerMessage: bi('There is no automatic undo copy. We can only restore an older backup if you have one.', 'مفيش نسخة تراجع تلقائية. نقدر نستعيد أقدم نسخة لو عندكم.'),
      closure: bi('Owner informed; next action agreed.', 'المالك اتعرف؛ الخطوة الجاية متفق عليها.'),
    },
  ],
  recovery: {
    en: 'Older Healthy HyMotionBackup_* on PC or USB.',
    ar: 'HyMotionBackup_* أقدم سليم على الجهاز أو USB.',
  },
  escalation: {
    en: 'Missing PreRestore, integrity fail on PreRestore, or SQL rollback failure.',
    ar: 'ضياع PreRestore، فشل سلامته، أو فشل رجوع SQL.',
  },
  customerCommunication: {
    en: 'Support is undoing the last restore. Another short outage.',
    ar: 'الدعم بيلغي آخر استعادة. توقف قصير تاني.',
  },
  securityWarnings: [bi('Support-only commands. Never send -SkipSafetyBackup to the owner.', 'أوامر دعم. متبعتش -SkipSafetyBackup للمالك.')],
  finalVerification: [
    bi('Health 200', 'صحة 200'),
    bi('Owner login', 'دخول المالك'),
    bi('Data matches pre-restore expectation', 'البيانات تطابق المتوقع قبل الاستعادة'),
  ],
  closure: [
    bi('Incident timeline recorded', 'الجدول الزمني اتسجل'),
    bi('Owner informed', 'المالك اتعرف'),
    bi('Case closed', 'الحالة اتقفلت'),
  ],
}
