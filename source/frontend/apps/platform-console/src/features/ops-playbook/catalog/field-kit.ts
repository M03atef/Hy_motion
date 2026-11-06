import type { Playbook } from '../types'
import { bi } from '../i18n'

const SET_KIT = `# Change E: to this USB/SSD letter if Windows assigned another letter.
$kit = 'E:\\HyMotionFieldKit'
Get-ChildItem $kit | Format-Table Name, Mode`

const MAKE_FOLDERS = `$kit = 'E:\\HyMotionFieldKit'
New-Item -ItemType Directory -Force -Path @(
  "$kit\\01-sql-express",
  "$kit\\02-hymotion-setup",
  "$kit\\03-fallback-app",
  "$kit\\04-install-scripts",
  "$kit\\04-install-scripts\\backup",
  "$kit\\05-take-home-backups"
) | Out-Null
Get-ChildItem $kit`

const COPY_SCRIPTS = `# Run from the HyMotion repo on the build PC.
$kit = 'E:\\HyMotionFieldKit'
$src = 'D:\\GMS\\GMS\\scripts\\local-install'
Copy-Item "$src\\Test-SqlServerAvailability.ps1" "$kit\\04-install-scripts\\" -Force
Copy-Item "$src\\install-service.ps1" "$kit\\04-install-scripts\\" -Force
Copy-Item "$src\\uninstall-service.ps1" "$kit\\04-install-scripts\\" -Force
Copy-Item "$src\\backup\\*" "$kit\\04-install-scripts\\backup\\" -Force
Get-ChildItem "$kit\\04-install-scripts" -Recurse -File | Select-Object FullName`

const COPY_DESKTOP = `# After publish-local.ps1 / build-desktop.ps1. Exes sit at the kit root (pack-usb.ps1).
$kit = 'E:\\HyMotionFieldKit'
$publish = 'D:\\GMS\\GMS\\publish-local'
Copy-Item "$publish\\HyMotionSetup.exe" "$kit\\HyMotionSetup.exe" -Force
Copy-Item "$publish\\HyMotionLauncher.exe" "$kit\\HyMotionLauncher.exe" -Force
Copy-Item "$publish\\HyMotionBackup.exe" "$kit\\HyMotionBackup.exe" -Force
Get-ChildItem $kit\\HyMotion*.exe | Select-Object Name, Length`

const USB_BUS = `# USB HDD / UASP often shows as DriveType Fixed. Use disk BusType, not Removable only.
Get-CimInstance -Namespace root\\Microsoft\\Windows\\Storage -ClassName MSFT_Disk |
  Where-Object { $_.BusType -in 7, 12, 13 } |
  Select-Object Number, FriendlyName, BusType, Size, PartitionStyle
Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, DriveType, VolumeName, @{n='GB';e={[math]::Round($_.Size/1GB,1)}}
# BusType 7 = USB, 12 = SD, 13 = MMC. Do not offer C: or the other partition of the boot SSD.`

const COPY_PUBLISH = `# After publish-local.ps1 finished. Change the publish path if yours is different.
$kit = 'E:\\HyMotionFieldKit'
$publish = 'D:\\GMS\\GMS\\publish-local'
Copy-Item "$publish\\*" "$kit\\03-fallback-app\\" -Recurse -Force
Test-Path "$kit\\03-fallback-app\\GMS.Api.exe"
Test-Path "$kit\\03-fallback-app\\HyMotionSetup.exe"
Test-Path "$kit\\03-fallback-app\\install-scripts\\backup\\Restore-HyMotion.ps1"`

const VERIFY_KIT = `$kit = 'E:\\HyMotionFieldKit'
Write-Host '--- root desktop apps ---'
Get-ChildItem "$kit\\HyMotion*.exe" | Select-Object Name
Write-Host '--- 01 SQL Express installer (filename comes from Microsoft) ---'
Get-ChildItem "$kit\\01-sql-express"
Write-Host '--- 02 optional old Inno setup ---'
Get-ChildItem "$kit\\02-hymotion-setup"
Write-Host '--- 03 fallback app ---'
Test-Path "$kit\\03-fallback-app\\GMS.Api.exe"
Write-Host '--- 04 scripts ---'
Get-ChildItem "$kit\\04-install-scripts\\backup" | Select-Object Name`

const PC_CHECK = `Write-Host "64-bit: $([Environment]::Is64BitOperatingSystem)"
Write-Host "Windows: $([System.Environment]::OSVersion.VersionString)"
Get-CimInstance Win32_OperatingSystem | Select-Object Caption, Version, OSArchitecture
# Gym Desk is Local on this PC only.
Write-Host 'Use http://localhost:7140 after HyMotion is installed — not a LAN IP.'`

const SQL_DETECT = `$kit = 'E:\\HyMotionFieldKit'
Set-Location "$kit\\04-install-scripts"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\Test-SqlServerAvailability.ps1`

const SQL_WRITE = `# Administrator PowerShell. Creates HyMotionLocal and grants NETWORK SERVICE db_owner on that database only.
$kit = 'E:\\HyMotionFieldKit'
Set-Location "$kit\\04-install-scripts"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\Test-SqlServerAvailability.ps1 -WriteConfig`

const INSTALL_SERVICE = `# Administrator PowerShell. Use this when there is no HyMotionLocalSetup exe.
# Copy off the USB first — do not point the Windows service at the USB or it will die when you unplug.
$kit = 'E:\\HyMotionFieldKit'
$dest = 'C:\\HyMotion\\app'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
Copy-Item "$kit\\03-fallback-app\\*" $dest -Recurse -Force
Copy-Item "$kit\\04-install-scripts\\*" "$dest\\install-scripts\\" -Recurse -Force
Test-Path "$dest\\GMS.Api.exe"
Set-Location "$dest\\install-scripts"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\install-service.ps1 -InstallDir $dest`

const HEALTH = `Get-Service HyMotion | Format-List Status, StartType, Name
Invoke-WebRequest http://localhost:7140/health -UseBasicParsing | Select-Object StatusCode, Content`

const SERVICE_DIR = `$dir = Split-Path ((Get-CimInstance Win32_Service -Filter "Name='HyMotion'").PathName.Trim('"'))
Set-Location $dir
Get-ChildItem .\\install-scripts\\backup | Select-Object Name`

const NIGHTLY = `$dir = Split-Path ((Get-CimInstance Win32_Service -Filter "Name='HyMotion'").PathName.Trim('"'))
Set-Location $dir
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\\install-scripts\\backup\\Register-BackupTask.ps1
Get-ScheduledTask -TaskName "HyMotion Nightly Backup" | Select-Object TaskName, State`

const COPY_BACKUPS_HOME = `$kit = 'E:\\HyMotionFieldKit'
$src = 'C:\\ProgramData\\HyMotion\\Backups'
New-Item -ItemType Directory -Force -Path "$kit\\05-take-home-backups" | Out-Null
Copy-Item "$src\\HyMotionBackup_*" "$kit\\05-take-home-backups\\" -Recurse -Force
Get-ChildItem "$kit\\05-take-home-backups" | Select-Object Name, LastWriteTime`

export const fieldKitPlaybook: Playbook = {
  id: 'field-kit-usb',
  category: 'installation',
  title: { en: 'Support field kit — USB / SSD for a new gym', ar: 'حقيبة الدعم — USB / SSD لنادي جديد' },
  purpose: {
    en: 'Pack one external drive at the office, then follow the same numbered steps on every new Local gym PC. This screen does not install software for you.',
    ar: 'جهّز هارد خارجي في المكتب، وبعدين امشي نفس الخطوات المرقّمة على كل جهاز نادي محلي. الشاشة دي مش بتثبّت برامج لوحدها.',
  },
  whenToUse: {
    en: 'Before you travel to a new gym, and again on the gym PC during first install.',
    ar: 'قبل ما تروح لنادي جديد، وتاني على جهاز النادي وقت أول تثبيت.',
  },
  preconditions: [
    bi('This kit is for HyMotion Local on a Windows 64-bit PC. Cloud (SaaS) gyms do not need SQL Express on the gym PC.', 'الحقيبة دي لـ HyMotion المحلي على ويندوز 64. النادي السحابي مش محتاج SQL Express على جهاز النادي.'),
    bi('You can issue a Local license in Control Plane before or during the visit.', 'تقدر تصدر ترخيص محلي من لوحة التحكم قبل أو أثناء الزيارة.'),
    bi('The gym PC is Windows 64-bit. Setup does not need Administrator. SQL Express (Microsoft) may ask Windows for permission once if it is missing. PowerShell is already part of Windows — do not install a second PowerShell.', 'جهاز النادي ويندوز 64. الإعداد مش محتاج مسؤول. SQL Express (مايكروسوفت) ممكن يطلب إذن ويندوز مرة لو ناقص. PowerShell موجود في ويندوز — متثبّتش PowerShell تاني.'),
  ],
  requiredAccess: {
    en: 'A Windows user on the gym PC. SQL Express installer may ask Windows permission once. Ops/Admin in Control Plane for the Local license.',
    ar: 'مستخدم ويندوز على جهاز النادي. مثبّت SQL Express ممكن يطلب إذن ويندوز مرة. عمليات/إدارة في لوحة التحكم للترخيص المحلي.',
  },
  risk: 'admin',
  audience: 'support',
  customerSummary: {
    en: 'Support will double-click HyMotionSetup and click Next until Finish, like any Windows program. Extra SQL or scripts only if Setup stops.',
    ar: 'الدعم هيدوس HyMotionSetup وبعدين التالي لحد إنهاء، زي أي برنامج ويندوز. SQL أو سكربتات بس لو الإعداد وقف.',
  },
  lifecycle: [
    bi('Pack USB', 'تجهيز USB'),
    bi('Gym PC check', 'فحص جهاز النادي'),
    bi('Setup Next → Finish', 'إعداد التالي ← إنهاء'),
    bi('Only if Setup stops', 'بس لو الإعداد وقف'),
    bi('Open + backup', 'فتح + نسخة'),
  ],
  kitLayout: bi(
    `HyMotionFieldKit
  HyMotionSetup.exe       team installer (this Windows user, no Administrator) — primary gym-visit path
  HyMotionLauncher.exe    gym desktop icon (daily use)
  HyMotionBackup.exe      owner Save to USB + Restore (type RESTORE in the app)
  01-sql-express          Microsoft SQL Server Express 64-bit installer (offline if the gym has no internet)
  02-hymotion-setup       optional old Inno HyMotionLocalSetup-*.exe — not required if Setup.exe is at the root
  03-fallback-app         Full publish-local folder (GMS.Api.exe + the three desktop exes)
  04-install-scripts      Test-SqlServerAvailability.ps1, install-service.ps1, uninstall-service.ps1, backup\\
  05-take-home-backups    Empty at the start. Copy HyMotionBackup_* here before you leave`,
    `HyMotionFieldKit
  HyMotionSetup.exe       مثبّت الفريق (مستخدم الجهاز، من غير مسؤول) — طريق زيارة النادي الأساسي
  HyMotionLauncher.exe    أيقونة سطح المكتب اليومية
  HyMotionBackup.exe      حفظ المالك على USB + استعادة (اكتب RESTORE في التطبيق)
  01-sql-express          مثبّت SQL Server Express 64 بت (أوفلاين لو النادي من غير نت)
  02-hymotion-setup       Inno قديم اختياري — مش مطلوب لو Setup.exe في الجذر
  03-fallback-app         مجلد publish-local كامل
  04-install-scripts      سكربتات SQL والخدمة والنسخ
  05-take-home-backups    فاضي في الأول. انسخ HyMotionBackup_* هنا قبل ما تمشي`,
  ),
  kit: [
    {
      id: 'sql',
      folder: '01-sql-express',
      title: bi('SQL Server Express (64-bit)', 'SQL Server Express (64 بت)'),
      why: bi('HyMotion Local does not bundle SQL. The installer stops if no local SQL instance is found.', 'HyMotion المحلي مش شايل SQL جواه. المثبّت بيقف لو مفيش SQL محلي.'),
      howToGet: bi('Download from Microsoft (free): https://www.microsoft.com/en-us/sql-server/sql-server-downloads — pick Express. Prefer the offline 64-bit installer so a gym without internet still works. Keep Microsoft’s filename. Default instance or named SQLEXPRESS both work. Do not grant extra SQL rights later.', 'حمّل من مايكروسوفت (مجاني) من صفحة SQL Server Downloads — Express. فضّل مثبّت 64 بت أوفلاين. اسم الملف من مايكروسوفت. الإنستانس الافتراضي أو SQLEXPRESS الاتنين تمام.'),
      required: true,
    },
    {
      id: 'setup',
      folder: '02-hymotion-setup (optional) + kit root',
      title: bi('HyMotionSetup.exe (team installer)', 'HyMotionSetup.exe (مثبّت الفريق)'),
      why: bi('This is the gym-visit install: This PC → SQL → Install → desktop icon. Do not paste PowerShell as the first owner-facing step.', 'ده تثبيت زيارة النادي: الجهاز ← SQL ← التثبيت ← أيقونة سطح المكتب. متلصقش PowerShell كأول خطوة للمالك.'),
      howToGet: bi('scripts/local-install/build-desktop.ps1 (or publish-local.ps1) copies HyMotionSetup.exe, HyMotionLauncher.exe, HyMotionBackup.exe into publish-local. pack-usb.ps1 puts them at the USB kit root. Old Inno HyMotionLocalSetup-*.exe in folder 02 is optional leftover — do not claim it is built unless ISCC produced it.', 'build-desktop.ps1 أو publish-local بينسخ الثلاثة إلى publish-local. pack-usb.ps1 بيحطهم في جذر الـ USB. ملف Inno في مجلد 02 اختياري — متقولش إنه مبني إلا لو ISCC طلّعه.'),
      required: true,
    },
    {
      id: 'fallback',
      folder: '03-fallback-app',
      title: bi('Fallback app folder (self-contained)', 'مجلد بديل للتطبيق'),
      why: bi('If the setup exe is missing, you copy this folder and register the Windows service by script. No .NET, Node, or Visual Studio is needed on the gym PC.', 'لو ملف الإعداد مش موجود، تنسخ المجلد وتسجّل خدمة ويندوز بالسكربت. جهاز النادي مش محتاج .NET ولا Node ولا Visual Studio.'),
      howToGet: bi('On the build PC: run scripts/local-install/publish-local.ps1 then copy the output folder here. Confirm GMS.Api.exe and install-scripts\\backup\\Restore-HyMotion.ps1 exist. publish-local does not copy install-service.ps1 — that stays in folder 04.', 'على جهاز البناء: شغّل publish-local.ps1 وانسخ الناتج هنا. أكد وجود GMS.Api.exe و Restore-HyMotion.ps1. publish-local مش بينسخ install-service.ps1 — ده في مجلد 04.'),
      required: true,
    },
    {
      id: 'scripts',
      folder: '04-install-scripts',
      title: bi('Install and backup scripts', 'سكربتات التثبيت والنسخ'),
      why: bi('SQL check, service register, and restore must sit next to a real GMS.Api.exe on the gym PC. Folder publishes often forget these files.', 'فحص SQL وتسجيل الخدمة والاستعادة لازم يكونوا جنب GMS.Api.exe الحقيقي. نشر المجلدات غالبًا بينسى الملفات دي.'),
      howToGet: bi('Copy from the repo: Test-SqlServerAvailability.ps1, install-service.ps1, uninstall-service.ps1, and the whole backup folder (Backup-HyMotion.ps1, Restore-HyMotion.ps1, Register-BackupTask.ps1, BackupCommon.ps1).', 'انسخ من المستودع: سكربت فحص SQL، install-service، uninstall-service، ومجلد backup كامل.'),
      required: true,
    },
    {
      id: 'home',
      folder: '05-take-home-backups',
      title: bi('Take-home backups (empty at start)', 'نسخ للرجوع (فاضي في الأول)'),
      why: bi('A copy only on the gym PC is lost if that PC dies. Before you leave, copy Healthy HyMotionBackup_* folders here.', 'النسخة على جهاز النادي بس تضيع لو الجهاز عطل. قبل ما تمشي انسخ مجلدات HyMotionBackup_* السليمة هنا.'),
      howToGet: bi('Create the empty folder when you pack the disk. Fill it at the end of the visit from C:\\ProgramData\\HyMotion\\Backups. Treat it as confidential.', 'اعمل المجلد فاضي وأنت بتجهّز الديسك. املأه في آخر الزيارة من مجلد Backups. اعتبره سري.'),
      required: true,
    },
    {
      id: 'desktop',
      folder: '(kit root)',
      title: bi('HyMotionLauncher.exe + HyMotionBackup.exe', 'HyMotionLauncher.exe + HyMotionBackup.exe'),
      why: bi('Launcher is the daily gym desktop icon. Backup is owner Save to USB and Open Restore (type RESTORE in the app).', 'Launcher أيقونة النادي اليومية. Backup حفظ المالك على USB وفتح الاستعادة (اكتب RESTORE في التطبيق).'),
      howToGet: bi('Same build-desktop / publish-local output. Keep all three exes next to GMS.Api.exe on the gym PC after install.', 'نفس ناتج البناء. خلّي الثلاثة جنب GMS.Api.exe على جهاز النادي بعد التثبيت.'),
      required: true,
    },
    {
      id: 'inno',
      folder: '(HQ PC only — not on the gym USB)',
      title: bi('Inno Setup 6 (build machine only)', 'Inno Setup 6 (جهاز البناء بس)'),
      why: bi('Needed only if you still compile HyMotionLocal.iss. Gyms never run ISCC. Team install is HyMotionSetup.exe, not Inno.', 'مطلوب بس لو لسه بتبني HyMotionLocal.iss. النوادي مش بتشغّل ISCC. تثبيت الفريق HyMotionSetup.exe مش Inno.'),
      howToGet: bi('https://jrsoftware.org/isinfo.php — free. Skip this if publish-local already has HyMotionSetup.exe.', 'من موقع jrsoftware — مجاني. تخطّاه لو publish-local فيه HyMotionSetup.exe.'),
      required: false,
      hqOnly: true,
    },
  ],
  phases: [
    { id: 'pack', title: bi('A — Pack the disk at the office', 'أ — جهّز الديسك في المكتب'), hint: bi('Create folders, copy SQL + app + desktop exes + scripts, then verify the listing.', 'اعمل المجلدات، انسخ SQL والتطبيق وبرامج سطح المكتب والسكربتات، وبعدين راجع القائمة.'), stepIds: ['usb-letter', 'folders', 'copy-sql', 'copy-app', 'copy-desktop', 'copy-scripts', 'verify-kit'] },
    { id: 'site-pc', title: bi('B — Gym PC before any install', 'ب — جهاز النادي قبل أي تثبيت'), hint: bi('Windows 64-bit. Setup does not need Administrator. SQL Express may ask Windows once if it is missing.', 'ويندوز 64. الإعداد مش محتاج مسؤول. SQL Express ممكن يطلب ويندوز مرة لو ناقص.'), stepIds: ['pc-check'] },
    { id: 'app', title: bi('C — Run Setup like any desktop app', 'ج — شغّل الإعداد زي أي برنامج'), hint: bi('Double-click HyMotionSetup.exe. Next until Finish. Same shape as Git or Chrome setup.', 'دبل كليك HyMotionSetup.exe. التالي لحد إنهاء. نفس شكل إعداد Git أو Chrome.'), stepIds: ['install-exe'] },
    { id: 'if-fail', title: bi('D — Only if Setup stops', 'د — بس لو الإعداد وقف'), hint: bi('SQL Express or the fallback folder. Skip this whole phase when Setup finished.', 'SQL Express أو مجلد البديل. تخطّى المرحلة دي كلها لو الإعداد خلّص.'), stepIds: ['sql-gui', 'sql-detect', 'sql-write', 'install-folder'] },
    { id: 'prove', title: bi('E — Open HyMotion, then copy a backup off the PC', 'هـ — افتح HyMotion، بعدين انسخ نسخة برا الجهاز'), hint: bi('Desktop icon works, owner login, Save a copy now, copy Healthy folders onto the USB.', 'أيقونة سطح المكتب تشتغل، دخول المالك، احفظ نسخة دلوقتي، انسخ المجلدات السليمة على الـ USB.'), stepIds: ['health', 'nightly', 'backup-desk', 'take-home'] },
  ],
  steps: [
    {
      id: 'usb-letter',
      action: bi('Plug in the USB/SSD. Note the drive letter. External USB disks often look like a normal Fixed drive — do not require DriveType Removable.', 'ركّب الـ USB/SSD. سجّل حرف الدرايف. الهارد الخارجي USB غالبًا بيظهر كدرايف ثابت — متطلبش إنه Removable.'),
      who: 'support',
      expected: bi('Explorer shows the disk. You will replace E: if the letter is different. Do not pick C: or the other partition of the boot SSD.', 'الإكسبلورر بيبين الديسك. بدّل E: لو الحرف مختلف. متختارش C: ولا بارتيشن البوت التاني.'),
      verification: bi('Get-ChildItem on $kit does not say path not found. MSFT_Disk BusType USB (7) if the letter is unclear.', 'Get-ChildItem على $kit مش بيقول المسار مش موجود. BusType USB لو الحرف مش واضح.'),
      risk: 'safe',
      audience: 'support',
      commands: [
        { id: 'usb-bus', label: bi('List USB disks (BusType, not Removable only)', 'عرض أقراص USB (BusType مش Removable بس)'), text: USB_BUS, supportOnly: true },
        { id: 'set-kit', label: bi('Set $kit and list the disk', 'ظبّط $kit واعرض الديسك'), text: SET_KIT, supportOnly: true },
      ],
      tech: bi('Windows PowerShell 5.1. HyMotion Backup uses MSFT_Disk BusType USB/SD/MMC union Removable. JMicron UASP volumes often enumerate as Fixed. Do not install PowerShell 7 unless you already standardized on it.', 'PowerShell 5.1. HyMotion Backup بيستخدم BusType USB. أقراص JMicron غالبًا Fixed.'),
    },
    {
      id: 'folders',
      action: bi('Create the five kit folders. Keep these names so every technician uses the same map.', 'اعمل الخمس مجلدات. خلّي الأسامي ثابتة عشان كل الفني يمشي على نفس الخريطة.'),
      who: 'support',
      expected: bi('01 through 05 exist under HyMotionFieldKit.', 'من 01 لـ 05 موجودين تحت HyMotionFieldKit.'),
      verification: bi('The listing shows five directories.', 'القائمة فيها خمس مجلدات.'),
      risk: 'safe',
      audience: 'support',
      commands: [{ id: 'mkdir', label: bi('Create the kit folders', 'إنشاء مجلدات الحقيبة'), text: MAKE_FOLDERS, supportOnly: true }],
    },
    {
      id: 'copy-sql',
      action: bi('Put the SQL Server Express 64-bit installer into 01-sql-express. Do not unzip it into a mystery folder.', 'حط مثبّت SQL Server Express 64 بت في 01-sql-express. متفكّوش في مجلد عشوائي.'),
      who: 'support',
      expected: bi('One Microsoft installer file (or the official Express layout) is in folder 01.', 'ملف مثبّت مايكروسوفت (أو هيكل Express الرسمي) في مجلد 01.'),
      verification: bi('Get-ChildItem 01-sql-express shows at least one .exe.', 'مجلد 01 فيه على الأقل ملف .exe.'),
      failurePath: bi('If the gym has no internet, the web bootstrapper is not enough — you need the offline Express installer from Microsoft’s download page.', 'لو النادي من غير نت، مثبّت الويب مش كفاية — محتاج مثبّت Express أوفلاين من صفحة مايكروسوفت.'),
      risk: 'safe',
      audience: 'support',
      tech: bi('HyMotion does not redistribute SQL Server. Official page: https://www.microsoft.com/en-us/sql-server/sql-server-downloads. Default instance (.) or .\\SQLEXPRESS both pass Test-SqlServerAvailability.ps1. Do not add SSMS unless you personally need it — the product does not require it.', 'HyMotion مش بيوزّع SQL. الصفحة الرسمية من مايكروسوفت. الإنستانس الافتراضي أو SQLEXPRESS. SSMS مش مطلوب للمنتج.'),
    },
    {
      id: 'copy-app',
      action: bi('Always copy the publish-local app into 03. Copy an old Inno HyMotionLocalSetup-*.exe into 02 only if you still have one — the team installer is HyMotionSetup.exe at the kit root.', 'ديمًا انسخ تطبيق publish-local إلى 03. انسخ Inno قديم إلى 02 بس لو لسه عندك — مثبّت الفريق HyMotionSetup.exe في جذر الحقيبة.'),
      who: 'support',
      expected: bi('03 contains GMS.Api.exe. 02 may be empty if Inno was not built.', '03 فيه GMS.Api.exe. 02 ممكن يبقى فاضي لو Inno ماتبنيش.'),
      verification: bi('Test-Path for GMS.Api.exe is True. Restore-HyMotion.ps1 exists under 03\\install-scripts\\backup or you will copy scripts in the next step.', 'مسار GMS.Api.exe True. سكربت الاستعادة تحت 03 أو هيتنسخ في الخطوة الجاية.'),
      risk: 'admin',
      audience: 'support',
      commands: [{ id: 'copy-pub', label: bi('Copy the published app onto the USB', 'نسخ التطبيق المنشور على الـ USB'), text: COPY_PUBLISH, supportOnly: true }],
      tech: bi('publish-local.ps1 is self-contained win-x64. Target PC does not need .NET. pack-usb.ps1 also copies HyMotionSetup/Launcher/Backup to the kit root. Do not copy Jwt secrets or ProgramData from a live gym onto this kit.', 'publish-local ذاتي الاحتواء. pack-usb بينسخ برامج سطح المكتب لجذر الحقيبة. متنسخش أسرار أو ProgramData من نادي حي.'),
    },
    {
      id: 'copy-desktop',
      action: bi('Copy HyMotionSetup.exe, HyMotionLauncher.exe, and HyMotionBackup.exe to the USB kit root. This is what the team double-clicks on site.', 'انسخ HyMotionSetup و Launcher و Backup إلى جذر الـ USB. ده اللي الفريق بيدوس عليه في الموقع.'),
      who: 'support',
      expected: bi('Get-ChildItem HyMotion*.exe at $kit shows three files. Folder 02 may still be empty.', 'جذر $kit فيه ثلاثة HyMotion*.exe. مجلد 02 ممكن يبقى فاضي.'),
      verification: bi('Test-Path HyMotionSetup.exe at the kit root is True.', 'HyMotionSetup.exe في جذر الحقيبة True.'),
      risk: 'admin',
      audience: 'support',
      commands: [{ id: 'copy-desk', label: bi('Copy desktop apps to the kit root', 'نسخ برامج سطح المكتب لجذر الحقيبة'), text: COPY_DESKTOP, supportOnly: true }],
    },
    {
      id: 'copy-scripts',
      action: bi('Copy the three install scripts and the backup folder into 04. publish-local does not copy install-service.ps1 by itself.', 'انسخ سكربتات التثبيت الثلاثة ومجلد النسخ إلى 04. publish-local مش بينسخ install-service.ps1 لوحده.'),
      who: 'support',
      expected: bi('04 has Test-SqlServerAvailability.ps1, install-service.ps1, uninstall-service.ps1, and backup\\Restore-HyMotion.ps1.', '04 فيه سكربت SQL والخدمة والاستعادة.'),
      verification: bi('The recursive file list includes Restore-HyMotion.ps1 and Register-BackupTask.ps1.', 'القائمة فيها Restore و Register-BackupTask.'),
      risk: 'safe',
      audience: 'support',
      commands: [{ id: 'copy-scr', label: bi('Copy install scripts onto the USB', 'نسخ سكربتات التثبيت على الـ USB'), text: COPY_SCRIPTS, supportOnly: true }],
    },
    {
      id: 'verify-kit',
      action: bi('Run the kit check before you leave the office. Fix empty folders now, not at the gym.', 'شغّل فحص الحقيبة قبل ما تمشي من المكتب. صلّح المجلدات الفاضية دلوقتي مش عند النادي.'),
      who: 'support',
      expected: bi('01 has SQL. Root has HyMotionSetup.exe. 03 has GMS.Api.exe. 04 has scripts. 05 is empty.', '01 فيه SQL. الجذر فيه HyMotionSetup.exe. 03 فيه GMS.Api.exe. 04 فيه سكربتات. 05 فاضي.'),
      verification: bi('Someone else on the team can follow the same $kit paths without asking you.', 'حد تاني في التيم يقدر يمشي على نفس مسارات $kit من غير ما يسألك.'),
      risk: 'safe',
      audience: 'support',
      commands: [{ id: 'verify', label: bi('Verify the kit before you travel', 'تأكد من الحقيبة قبل السفر'), text: VERIFY_KIT, supportOnly: true }],
    },
    {
      id: 'pc-check',
      action: bi('On the gym PC: Windows 64-bit, antivirus will allow the Microsoft and HyMotion installers. HyMotion Setup does not need Administrator.', 'على جهاز النادي: ويندوز 64، الأنتي فيرس هيسمح بمثبّت مايكروسوفت و HyMotion. إعداد HyMotion مش محتاج مسؤول.'),
      who: 'support',
      expected: bi('OSArchitecture is 64-bit. A normal Windows user can double-click HyMotionSetup.', 'المعمارية 64 بت. مستخدم ويندوز عادي يقدر يدوس HyMotionSetup.'),
      verification: bi('The owner agrees the PC will be offline for installs. Staff are not taking sales on it yet.', 'المالك موافق إن الجهاز هيقف للتثبيت. الموظفين مش بيبيعوا عليه لسه.'),
      risk: 'safe',
      audience: 'support',
      commands: [{ id: 'pc', label: bi('Confirm 64-bit Windows', 'تأكيد ويندوز 64 بت'), text: PC_CHECK, supportOnly: true }],
    },
    {
      id: 'install-exe',
      action: bi('On the gym PC: double-click HyMotionSetup.exe as the Windows user who will use the gym. Do not Run as administrator. Click Next until Finish, like Git or any Windows program. Leave ticks as they are. Do not open PowerShell first.', 'على جهاز النادي: دبل كليك HyMotionSetup.exe بنفس مستخدم ويندوز اللي هيستخدم النادي. متشغّلش كمسؤول. دوّس التالي لحد إنهاء، زي Git أو أي برنامج ويندوز. سيب العلامات. متفتحش PowerShell الأول.'),
      who: 'support',
      expected: bi('Finish closes. HyMotion is on the desktop. Skip the SQL / folder steps if Setup finished.', 'إنهاء يقفل. HyMotion على سطح المكتب. تخطّى خطوات SQL / المجلد لو الإعداد خلّص.'),
      verification: bi('Double-click the HyMotion desktop icon. A sign-in or first-run screen opens. Gym people can follow local-desktop-setup.', 'دبل كليك أيقونة HyMotion. شاشة دخول أو أول تشغيل تفتح. ناس النادي على دليل local-desktop-setup.'),
      failurePath: bi('If Setup names SQL, continue with the SQL steps below. If there is no Setup.exe, skip to the fallback folder step.', 'لو الإعداد سمّى SQL، كمّل بخطوات SQL تحت. لو مفيش Setup.exe، روح لخطوة مجلد البديل.'),
      risk: 'safe',
      audience: 'support',
      tech: bi('Setup is asInvoker. Default folder %LOCALAPPDATA%\\HyMotion\\app. Launcher starts GMS.Api.exe as the signed-in user (ASPNETCORE_ENVIRONMENT=Local, HYMOTION_DATA_DIR). Windows service HyMotion is optional and only if someone later runs install-service.ps1 as Administrator. http://localhost:7140.', 'الإعداد asInvoker. المجلد الافتراضي LocalAppData\\HyMotion\\app. Launcher يشغّل GMS.Api كالمستخدم. خدمة ويندوز اختيارية لاحقًا. المنفذ 7140.'),
    },
    {
      id: 'sql-gui',
      action: bi('Only if HyMotionSetup stopped and named SQL: install SQL Server Express from folder 01. Use the Microsoft wizard. Mixed mode is not required.', 'بس لو HyMotionSetup وقف وسمّى SQL: ثبّت SQL Server Express من مجلد 01. استخدم معالج مايكروسوفت. Mixed mode مش مطلوب.'),
      who: 'support',
      expected: bi('Express setup finishes. A default instance or SQLEXPRESS is present.', 'إعداد Express يخلّص. إنستانس افتراضي أو SQLEXPRESS موجود.'),
      verification: bi('Services.msc shows SQL Server (MSSQLSERVER) or SQL Server (SQLEXPRESS) Running.', 'الخدمات بتبين SQL شغال.'),
      failurePath: bi('If Express asks for a reboot, reboot, then run HyMotionSetup again. Do not start PowerShell as the gym-facing path.', 'لو Express طلب ريستارت، اعمل ريستارت وبعدين شغّل HyMotionSetup تاني. متخلّيش PowerShell طريق النادي.'),
      risk: 'admin',
      audience: 'support',
      tech: bi('Do not invent silent SQL flags here — they are not verified in this playbook. The HyMotion installer message: default instance or named SQLEXPRESS both work. Do not grant NETWORK SERVICE sysadmin.', 'متخترعش أوامر SQL صامتة هنا. رسالة مثبّت HyMotion: الإنستانس الافتراضي أو SQLEXPRESS. متديش NETWORK SERVICE صلاحية sysadmin.'),
    },
    {
      id: 'sql-detect',
      action: bi('Only if Setup still fails after Express: from the USB, run the HyMotion SQL detect script (no write).', 'بس لو الإعداد لسه فاشل بعد Express: من الـ USB شغّل سكربت كشف SQL (من غير كتابة).'),
      who: 'support',
      expected: bi('The script prints a usable server such as . or .\\SQLEXPRESS and exits 0.', 'السكربت يطبع سيرفر صالح زي . أو .\\SQLEXPRESS ويخرج 0.'),
      verification: bi('If it prints the Microsoft download link and exits non-zero, Express is not ready — go back to folder 01.', 'لو طبع رابط التحميل وخرج بفشل، Express مش جاهز — ارجع لمجلد 01.'),
      risk: 'safe',
      audience: 'support',
      commands: [{ id: 'detect', label: bi('Detect SQL (read only)', 'كشف SQL (قراءة بس)'), text: SQL_DETECT, supportOnly: true }],
    },
    {
      id: 'sql-write',
      action: bi('Only if Setup still cannot create the gym database: as Administrator run the same script with -WriteConfig, then run HyMotionSetup again.', 'بس لو الإعداد لسه مش قادر ينشئ قاعدة النادي: كمسؤول نفس السكربت بـ -WriteConfig، بعدين شغّل HyMotionSetup تاني.'),
      who: 'support',
      expected: bi('Config file under ProgramData points at Database=HyMotionLocal. NETWORK SERVICE is db_owner on that database only.', 'ملف الإعداد تحت ProgramData على HyMotionLocal. NETWORK SERVICE = db_owner على القاعدة دي بس.'),
      verification: bi('Re-run detect if you are unsure. Then Finish on HyMotionSetup.', 'أعد الكشف لو مش متأكد. بعدين إنهاء على HyMotionSetup.'),
      risk: 'admin',
      audience: 'support',
      commands: [{ id: 'write', label: bi('Create database + grant service login', 'إنشاء القاعدة + صلاحية الخدمة'), text: SQL_WRITE, supportOnly: true }],
      tech: bi('Writes C:\\ProgramData\\HyMotion\\config\\appsettings.json. Grant is db_owner on HyMotionLocal only — not CREATE DATABASE, not sysadmin. Idempotent.', 'بيكتب appsettings.json. الصلاحية db_owner على HyMotionLocal بس. آمن يتكرر.'),
    },
    {
      id: 'install-folder',
      action: bi('Only if there is no setup exe: copy 03 onto a fixed folder on the PC, then register the service with the script from 04.', 'بس لو مفيش ملف إعداد: انسخ 03 لمجلد ثابت على الجهاز، بعدين سجّل الخدمة من سكربت 04.'),
      who: 'support',
      expected: bi('Get-Service HyMotion is Running. The service PathName points at the folder you copied, not a guess.', 'خدمة HyMotion Running. PathName على المجلد اللي نسخته، مش تخمين.'),
      verification: bi('Test-Path GMS.Api.exe in that folder is True. Copy 04\\backup into that folder\\install-scripts\\backup if publish missed it.', 'GMS.Api.exe موجود. انسخ سكربتات 04 إلى install-scripts\\backup لو النشر نسيها.'),
      risk: 'admin',
      audience: 'support',
      commands: [
        { id: 'svc', label: bi('Register the HyMotion service from the USB app folder', 'تسجيل خدمة HyMotion من مجلد الـ USB'), text: INSTALL_SERVICE, supportOnly: true },
      ],
      tech: bi('install-service.ps1 -InstallDir must be the folder that contains GMS.Api.exe. After this, always discover the path with Win32_Service Name=HyMotion — do not assume Program Files.', 'InstallDir = مجلد GMS.Api.exe. بعد كده PathName من الخدمة HyMotion — متفترضش Program Files.'),
    },
    {
      id: 'health',
      action: bi('Confirm the service and open the health address. Then sign in as the owner after on-box setup.', 'أكد الخدمة وافتح عنوان الصحة. بعدين دخول المالك بعد تجهيز النادي على الجهاز.'),
      who: 'support',
      expected: bi('StatusCode 200. Login page at http://localhost:7140 — not another port.', '200. صفحة الدخول على 7140 مش بورت تاني.'),
      verification: bi('Owner can sign in. Cashier cannot open Backup & Recovery.', 'المالك يدخل. الكاشير يفتحش النسخ.'),
      risk: 'safe',
      audience: 'both',
      commands: [
        { id: 'health', label: bi('Service status + health', 'حالة الخدمة + الصحة'), text: HEALTH, supportOnly: true },
        { id: 'dir', label: bi('Go to the real service folder', 'روح لمجلد الخدمة الحقيقي'), text: SERVICE_DIR, supportOnly: true },
      ],
    },
    {
      id: 'nightly',
      action: bi('If Backup & Recovery says nightly is not scheduled, register the task from the service folder.', 'لو صفحة النسخ بتقول الليلي مش متجدول، سجّل المهمة من مجلد الخدمة.'),
      who: 'support',
      expected: bi('Task HyMotion Nightly Backup exists, or the gap is written on the case.', 'مهمة HyMotion Nightly Backup موجودة، أو الفجوة مكتوبة على الحالة.'),
      verification: bi('Get-ScheduledTask returns the task, or you documented why not.', 'Get-ScheduledTask بيرجع المهمة، أو وثّقت السبب.'),
      risk: 'admin',
      audience: 'support',
      commands: [{ id: 'task', label: bi('Register nightly backup', 'تسجيل النسخ الليلي'), text: NIGHTLY, supportOnly: true }],
    },
    {
      id: 'backup-desk',
      action: bi('On the Desk: Administration → Backup & Recovery → Save a copy now. Wait, then Refresh. You need a Looks good / Healthy row before you leave.', 'في المكتب: الإدارة ← النسخ ← احفظ نسخة دلوقتي. استنى، بعدين تحديث. محتاج صف تمام/سليم قبل ما تمشي.'),
      who: 'owner',
      expected: bi('A HyMotionBackup_* folder exists under ProgramData. Status Healthy (Partial only if photos truly do not matter).', 'مجلد HyMotionBackup_* تحت ProgramData. الحالة سليم.'),
      verification: bi('Failed is not acceptable for a new gym. Continue with the Backup playbook if the row is Failed.', 'فشل مش مقبول لنادي جديد. كمّل دليل النسخ لو الصف فشل.'),
      risk: 'safe',
      audience: 'both',
      tech: bi('POST /backup/run → Backup-HyMotion.ps1 next to GMS.Api.exe. Folder C:\\ProgramData\\HyMotion\\Backups\\HyMotionBackup_yyyy-MM-dd_HHmmss.', 'النسخ من المكتب يشغّل السكربت جنب الـ exe.'),
    },
    {
      id: 'take-home',
      action: bi('Owner: Save to USB (HyMotion Backup copies to <USB>:\\HyMotionBackups\\). Team: also copy Healthy folders onto 05-take-home-backups before you unplug.', 'المالك: احفظ على USB (HyMotion Backup بينسخ إلى HyMotionBackups على الفلاشة). الفريق: كمان انسخ المجلدات السليمة إلى 05 قبل ما تشيل الديسك.'),
      who: 'support',
      expected: bi('USB has the same folder names as ProgramData Backups. Owner also keeps a copy if they have another disk.', 'الـ USB فيه نفس أسماء المجلدات. المالك يحتفظ بنسخة لو عنده ديسك تاني.'),
      verification: bi('Open manifest.json on the USB and confirm status Healthy. Do not email database.bak.', 'افتح manifest.json على الـ USB وتأكد الحالة سليم. متبعتش database.bak بالإيميل.'),
      risk: 'admin',
      audience: 'support',
      commands: [{ id: 'home', label: bi('Copy backups onto the USB', 'نسخ الاحتياطي على الـ USB'), text: COPY_BACKUPS_HOME, supportOnly: true }],
    },
  ],
  failures: [
    {
      id: 'no-sql-offline',
      title: bi('Gym has no internet and folder 01 is empty', 'النادي من غير نت ومجلد 01 فاضي'),
      whatHappened: bi('The kit was packed with a bookmark instead of the Express installer.', 'الحقيبة اتعملها لينك بدل مثبّت Express.'),
      doNot: bi('Do not skip SQL and hope HyMotion will create it. Do not download a random SQL from a USB of unknown origin.', 'متتخطاش SQL. ومتحمّلش SQL عشوائي من ديسك مجهول.'),
      immediate: bi('Stop the visit install. Get the official offline Express installer onto the kit, then return.', 'قف التثبيت. حط مثبّت Express الأوفلاين الرسمي على الحقيبة، بعدين ارجع.'),
      recovery: bi('Microsoft SQL Server Express download page is the source.', 'مصدر التحميل صفحة مايكروسوفت.'),
      escalation: bi('Escalate if the PC cannot run 64-bit Express.', 'صعّد لو الجهاز مش قادر يشغّل Express 64 بت.'),
      logs: bi('Empty 01-sql-express listing', 'قائمة 01 فاضية'),
      customerMessage: bi('We need SQL Server Express on this PC before HyMotion Local can open. We will come back with the installer on the disk.', 'محتاجين SQL Express على الجهاز قبل ما HyMotion المحلي يفتح. هنرجع بالمثبّت على الديسك.'),
      closure: bi('Folder 01 has the Express installer and detect script exits 0.', 'مجلد 01 فيه Express وسكربت الكشف يخرج 0.'),
    },
    {
      id: 'no-setup-no-publish',
      title: bi('No setup exe and no GMS.Api.exe on the USB', 'لا ملف إعداد ولا GMS.Api.exe على الـ USB'),
      whatHappened: bi('The kit only has scripts. There is nothing to install.', 'الحقيبة فيها سكربتات بس. مفيش حاجة تتثبت.'),
      doNot: bi('Do not clone the git repo onto the gym PC as an install. Do not install Node or Visual Studio on the gym to “build it there”.', 'متستنسخش git على جهاز النادي كطريقة تثبيت. ومتثبّتش Node أو Visual Studio هناك عشان تبني.'),
      immediate: bi('Return to the office, run publish-local.ps1, copy 03 and 04, then come back.', 'ارجع المكتب، شغّل publish-local.ps1، انسخ 03 و 04، بعدين ارجع.'),
      recovery: bi('Preferred long-term: a built HyMotionLocalSetup-1.1.0.exe in folder 02.', 'على المدى: ملف إعداد مبني في مجلد 02.'),
      escalation: bi('Escalate if no one can produce a self-contained publish.', 'صعّد لو محدش قادر يطلع نشر ذاتي الاحتواء.'),
      logs: bi('VERIFY_KIT output', 'مخرجات فحص الحقيبة'),
      customerMessage: bi('The install files are not on the disk we brought. We will return with the program files.', 'ملفات التثبيت مش على الديسك. هنرجع بملفات البرنامج.'),
      closure: bi('Test-Path GMS.Api.exe on the kit is True.', 'GMS.Api.exe على الحقيبة True.'),
    },
  ],
  recovery: {
    en: 'If install fails after SQL succeeded, do not restore. Fix the service path or copy missing scripts next to GMS.Api.exe, then health.',
    ar: 'لو التثبيت فشل بعد نجاح SQL، متستعيدش. صلّح مسار الخدمة أو انسخ السكربتات الناقصة جنب GMS.Api.exe، بعدين الصحة.',
  },
  escalation: {
    en: 'Escalate 32-bit Windows, SQL that only listens remotely, or a license/device mismatch in Control Plane.',
    ar: 'صعّد ويندوز 32 بت، SQL سامع على الشبكة بس، أو اختلاف ترخيص/جهاز في لوحة التحكم.',
  },
  customerCommunication: {
    en: 'We will run HyMotion Setup on this PC like any Windows program (Next until Finish). The computer will be busy for a few minutes. We will copy a backup onto our disk before we leave.',
    ar: 'هنشغّل إعداد HyMotion على الجهاز زي أي برنامج ويندوز (التالي لحد إنهاء). الجهاز هيبقى مشغول دقايق. هننسخ نسخة على الديسك قبل ما نمشي.',
  },
  securityWarnings: [
    bi('The take-home backup folder is the gym database. Do not leave the USB in a car. Do not email .bak files.', 'مجلد النسخ للرجوع هو قاعدة النادي. متسيبش الـ USB في العربية. متبعتش .bak.'),
    bi('Do not put Jwt secrets, owner passwords, or Control Plane passwords on the USB.', 'متتحطش أسرار JWT أو كلمات سر المالك أو لوحة التحكم على الـ USB.'),
    bi('Do not grant NETWORK SERVICE sysadmin. Do not install random “SQL tools” packs from the internet onto the gym PC.', 'متديش NETWORK SERVICE sysadmin. ومتثبّتش حزم SQL عشوائية من النت على جهاز النادي.'),
  ],
  finalVerification: [
    bi('Kit folders 01–05 packed as listed', 'مجلدات الحقيبة 01–05 زي الجدول'),
    bi('SQL detect exits 0 on the gym PC', 'كشف SQL يخرج 0 على جهاز النادي'),
    bi('http://localhost:7140/health is 200', 'الصحة 200'),
    bi('Owner signed in', 'المالك دخل'),
    bi('Healthy backup on PC and on USB folder 05', 'نسخة سليمة على الجهاز وعلى مجلد 05'),
  ],
  closure: [
    bi('USB packed before travel', 'الـ USB اتجهز قبل السفر'),
    bi('SQL Express installed', 'SQL Express اتثبت'),
    bi('HyMotion service Running', 'خدمة HyMotion شغالة'),
    bi('Healthy backup copied to USB', 'نسخة سليمة اتنسخت على الـ USB'),
    bi('Owner shown Backup & Recovery', 'المالك شاف صفحة النسخ'),
  ],
}
