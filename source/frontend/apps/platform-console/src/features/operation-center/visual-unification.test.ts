import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

describe('HyMotion visual unification (CP→DS bridge)', () => {
  const ocCss = readFileSync(path.resolve(__dirname, './oc.css'), 'utf8')
  const gyms = readFileSync(path.resolve(__dirname, '../gyms/GymsPage.tsx'), 'utf8')

  it('remaps CP tokens to DS under [data-oc]', () => {
    expect(ocCss).toContain('--accent: var(--ds-action)')
    expect(ocCss).toContain('--canvas: var(--ds-bg-canvas)')
    expect(ocCss).toContain('--surface: var(--ds-surface)')
  })

  it('neutralizes light Tailwind utilities under OcShell only', () => {
    expect(ocCss).toContain('[data-oc] .bg-white')
    expect(ocCss).toContain('background-color: var(--ds-surface)')
    expect(ocCss).toContain('[data-oc] .border-gray-200')
  })

  it('Gyms list uses DS chrome, not CP PageHeader/cp-segment', () => {
    expect(gyms).toContain('DsPageHeader')
    expect(gyms).toContain('ds-segment')
    expect(gyms).toContain('oc-attention')
    expect(gyms).not.toContain("from '@/components/PageHeader'")
    expect(gyms).not.toContain('cp-segment')
    expect(gyms).not.toContain('bg-white')
  })
})
