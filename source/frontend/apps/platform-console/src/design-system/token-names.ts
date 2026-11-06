export const DS_TOKEN_GROUPS = {
  lime: ['--ds-lime-100', '--ds-lime-400', '--ds-lime-500', '--ds-lime-600'],
  teal: ['--ds-teal-500', '--ds-teal-700'],
  bg: ['--ds-bg-canvas', '--ds-bg-sidebar', '--ds-bg-topbar', '--ds-bg-input'],
  surface: ['--ds-surface', '--ds-surface-2', '--ds-surface-3'],
  border: ['--ds-border', '--ds-border-strong'],
  text: ['--ds-text', '--ds-text-muted', '--ds-text-faint', '--ds-text-on-lime'],
  action: ['--ds-action', '--ds-action-hover', '--ds-action-fg', '--ds-action-soft'],
  status: [
    '--ds-status-success',
    '--ds-status-success-bg',
    '--ds-status-warning',
    '--ds-status-warning-bg',
    '--ds-status-danger',
    '--ds-status-danger-bg',
    '--ds-status-info',
    '--ds-status-info-bg',
  ],
} as const
