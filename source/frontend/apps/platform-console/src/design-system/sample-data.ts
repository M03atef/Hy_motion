export const SAMPLE_INSTALLS = [
  {
    id: 'HM-2041',
    gymEn: 'Nile Athletics',
    gymAr: 'Ù†Ø§ÙŠÙ„ Ø£Ø«Ù„ÙŠØªÙƒØ³',
    license: 'Local Edition',
    status: 'active' as const,
    installEn: 'Front desk Â· Cairo',
    installAr: 'Ø§Ù„Ø§Ø³ØªÙ‚Ø¨Ø§Ù„ Â· Ø§Ù„Ù‚Ø§Ù‡Ø±Ø©',
    updated: '16 Sep 2026',
  },
  {
    id: 'HM-2042',
    gymEn: 'Delta Fit',
    gymAr: 'Ø¯Ù„ØªØ§ ÙØª',
    license: 'Local Edition',
    status: 'expiring' as const,
    installEn: 'Workstation 02',
    installAr: 'Ù…Ø­Ø·Ø© 02',
    updated: '14 Sep 2026',
  },
  {
    id: 'HM-1988',
    gymEn: 'Red Sea Club',
    gymAr: 'Ù†Ø§Ø¯ÙŠ Ø§Ù„Ø¨Ø­Ø± Ø§Ù„Ø£Ø­Ù…Ø±',
    license: 'Local Edition',
    status: 'suspended' as const,
    installEn: 'Offline 11 days',
    installAr: 'ØºÙŠØ± Ù…ØªØµÙ„ 11 ÙŠÙˆÙ…Ø§Ù‹',
    updated: '05 Sep 2026',
  },
  {
    id: 'HM-2104',
    gymEn: 'October Strength',
    gymAr: 'Ø£ÙƒØªÙˆØ¨Ø± Ø³ØªØ±ÙŠÙ†Ø«',
    license: 'Cloud gym',
    status: 'pending' as const,
    installEn: 'Activation queued',
    installAr: 'Ø¨Ø§Ù†ØªØ¸Ø§Ø± Ø§Ù„ØªÙØ¹ÙŠÙ„',
    updated: '16 Sep 2026',
  },
] as const

export const SAMPLE_TICKETS = [
  { id: 'SR-118', gymEn: 'Delta Fit', gymAr: 'Ø¯Ù„ØªØ§ ÙØª', topicEn: 'Card reader timeout', topicAr: 'Ø§Ù†ØªÙ‡Ø§Ø¡ Ù…Ù‡Ù„Ø© Ù‚Ø§Ø±Ø¦ Ø§Ù„Ø¨Ø·Ø§Ù‚Ø§Øª', tone: 'warning' as const },
  { id: 'SR-121', gymEn: 'Nile Athletics', gymAr: 'Ù†Ø§ÙŠÙ„ Ø£Ø«Ù„ÙŠØªÙƒØ³', topicEn: 'Backup verification', topicAr: 'Ø§Ù„ØªØ­Ù‚Ù‚ Ù…Ù† Ø§Ù„Ù†Ø³Ø®Ø©', tone: 'info' as const },
]
