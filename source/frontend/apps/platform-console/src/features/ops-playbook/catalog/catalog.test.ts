import { describe, expect, it } from 'vitest'
import { filterPlaybooks, getPlaybook, PLAYBOOKS } from './index'
import type { Bi, Playbook } from '../types'

function assertBi(value: Bi, path: string) {
  expect(value.en.trim().length, `${path}.en`).toBeGreaterThan(0)
  expect(value.ar.trim().length, `${path}.ar`).toBeGreaterThan(0)
}

function walk(p: Playbook) {
  assertBi(p.title, `${p.id}.title`)
  assertBi(p.purpose, `${p.id}.purpose`)
  assertBi(p.whenToUse, `${p.id}.whenToUse`)
  assertBi(p.requiredAccess, `${p.id}.requiredAccess`)
  assertBi(p.customerSummary, `${p.id}.customerSummary`)
  p.steps.forEach((s) => {
    assertBi(s.action, `${p.id}.${s.id}.action`)
    assertBi(s.expected, `${p.id}.${s.id}.expected`)
    assertBi(s.verification, `${p.id}.${s.id}.verification`)
    if (s.tech) assertBi(s.tech, `${p.id}.${s.id}.tech`)
  })
  p.kit?.forEach((k) => {
    assertBi(k.title, `${p.id}.kit.${k.id}.title`)
    assertBi(k.why, `${p.id}.kit.${k.id}.why`)
    assertBi(k.howToGet, `${p.id}.kit.${k.id}.howToGet`)
  })
  p.phases?.forEach((ph) => {
    assertBi(ph.title, `${p.id}.phase.${ph.id}.title`)
    assertBi(ph.hint, `${p.id}.phase.${ph.id}.hint`)
  })
  p.failures.forEach((f) => {
    assertBi(f.title, `${p.id}.${f.id}.title`)
    assertBi(f.doNot, `${p.id}.${f.id}.doNot`)
    assertBi(f.customerMessage, `${p.id}.${f.id}.customerMessage`)
    if (f.tech) assertBi(f.tech, `${p.id}.${f.id}.tech`)
  })
}

describe('ops playbook catalog', () => {
  it('includes the required cases', () => {
    const ids = PLAYBOOKS.map((p) => p.id)
    expect(ids).toEqual(
      expect.arrayContaining([
        'local-desktop-setup',
        'customer-onboard',
        'field-kit-usb',
        'new-gym-setup',
        'golive-handover',
        'access-cards-pvc',
        'backup-local',
        'restore-local',
        'rollback-prerestore',
        'license-lifecycle',
        'support-ticket',
        'svc-wont-open',
        'access-login',
        'pc-replace',
        'update-local',
        'ops-policies',
      ]),
    )
  })

  it('keeps bilingual content on every playbook', () => {
    PLAYBOOKS.forEach(walk)
  })

  it('documents the USB field kit folders', () => {
    const kit = getPlaybook('field-kit-usb')
    expect(kit?.kit?.map((k) => k.id)).toEqual(['sql', 'setup', 'fallback', 'scripts', 'home', 'desktop', 'inno'])
    expect(kit?.phases).toHaveLength(5)
    const texts = kit?.steps.flatMap((s) => s.commands ?? []).map((c) => c.text).join('\n') ?? ''
    expect(texts).toContain('$kit')
    expect(texts).toContain('Test-SqlServerAvailability.ps1')
    expect(texts).toContain('install-service.ps1')
    expect(texts).toContain('HyMotionSetup.exe')
    expect(texts).toContain('BusType')
    expect(texts).not.toContain('Program Files\\HyMotion\\app')
  })
  it('documents 17 restore failure cases', () => {
    const restore = getPlaybook('restore-local')
    expect(restore?.failures).toHaveLength(17)
  })

  it('states update is not verified', () => {
    const update = getPlaybook('update-local')
    expect(update?.steps.some((s) => s.unsupported)).toBe(true)
    expect(update?.customerSummary.en).toMatch(/NOT VERIFIED/)
  })

  it('hides team-only guides from the gym list and gym search', () => {
    const ids = filterPlaybooks({ audience: 'customer' }).map((p) => p.id)
    expect(ids).not.toContain('field-kit-usb')
    expect(ids).not.toContain('ops-policies')
    expect(ids).not.toContain('update-local')
    expect(ids).not.toContain('pc-replace')
    expect(ids).not.toContain('license-lifecycle')
    expect(ids).not.toContain('customer-onboard')
    expect(ids).not.toContain('new-gym-setup')
    expect(ids).not.toContain('support-ticket')
    expect(ids).toContain('local-desktop-setup')
    expect(ids).toContain('backup-local')
    expect(ids).toContain('svc-wont-open')
    expect(filterPlaybooks({ audience: 'customer', query: 'CREATE DATABASE' })).toEqual([])
  })

  it('keeps Local gym install as a short desktop-app path', () => {
    const p = getPlaybook('local-desktop-setup')
    expect(p?.audience).toBe('both')
    expect(p?.steps).toHaveLength(5)
    expect(p?.requiredAccess.en).not.toMatch(/Run as administrator/i)
    expect(p?.requiredAccess.en).toMatch(/do not need admin/i)
    const gymText = p!.steps
      .filter((s) => s.audience !== 'support')
      .flatMap((s) => [s.action.en, s.expected.en, s.verification.en])
      .join('\n')
    expect(gymText).not.toMatch(/PowerShell|GMS\.Api|localhost:7140|CREATE DATABASE|BusType/i)
    expect(gymText).toMatch(/Next/)
    const kitIds = getPlaybook('field-kit-usb')!.steps.map((s) => s.id)
    expect(kitIds.indexOf('install-exe')).toBeLessThan(kitIds.indexOf('sql-gui'))
    expect(getPlaybook('new-gym-setup')?.audience).toBe('support')
    const gymHandover = getPlaybook('golive-handover')!.steps.filter((s) => s.audience !== 'support')
    expect(gymHandover.map((s) => s.id)).toEqual(['login', 'members', 'attendance', 'backup', 'i18n'])
    expect(getPlaybook('restore-local')!.failures.every((f) => f.audience === 'support')).toBe(true)
    expect(getPlaybook('support-ticket')?.audience).toBe('support')
  })

  it('filters by category, risk, and search', () => {
    expect(filterPlaybooks({ category: 'restore' }).map((p) => p.id)).toEqual(['restore-local'])
    expect(filterPlaybooks({ query: 'CREATE DATABASE' }).some((p) => p.id === 'backup-local')).toBe(true)
    expect(filterPlaybooks({ query: 'HyMotionFieldKit' }).some((p) => p.id === 'field-kit-usb')).toBe(true)
    expect(filterPlaybooks({ query: 'PlatformCustomer' }).some((p) => p.id === 'customer-onboard')).toBe(true)
    expect(filterPlaybooks({ query: 'AccessCard.Code' }).some((p) => p.id === 'access-cards-pvc')).toBe(true)
    expect(filterPlaybooks({ query: 'zzzz-none' })).toEqual([])
    expect(filterPlaybooks({ risk: 'destructive' }).every((p) => p.risk === 'destructive')).toBe(true)
    expect(filterPlaybooks({ category: 'installation' }).map((p) => p.id)).toEqual(['field-kit-usb'])
  })

  it('does not claim contracts are missing from the product', () => {
    const setup = getPlaybook('new-gym-setup')
    expect(setup?.steps.find((s) => s.id === 'commercial')?.unsupported).toBeFalsy()
    expect(setup?.steps.find((s) => s.id === 'commercial')?.expected.en).toMatch(/HY-CTR/)
  })

  it('keeps license issue on Ops, not Sales', () => {
    const onboard = getPlaybook('customer-onboard')
    expect(onboard?.steps.find((s) => s.id === 'license')?.action.en).toMatch(/Ops\/Admin/)
    expect(onboard?.securityWarnings.some((w) => /Sales must not issue/i.test(w.en))).toBe(true)
  })

  it('restore latest command uses the live service path, not a guessed Program Files folder', () => {
    const restore = getPlaybook('restore-local')
    const cmd = restore?.steps.flatMap((s) => s.commands ?? []).find((c) => c.id === 'latest')
    expect(cmd?.text).toContain("Name='HyMotion'")
    expect(cmd?.text).toContain('Restore-HyMotion.ps1 -Latest')
    expect(cmd?.supportOnly).toBe(true)
  })
})
