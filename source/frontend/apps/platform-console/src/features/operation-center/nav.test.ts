import { describe, expect, it } from 'vitest'
import { ocNavActive, visibleOcNav } from './nav'

describe('Operation Center navigation', () => {
  it('shows Overview / Gyms / Support / Settings to every platform role', () => {
    const paths = (role: string) => visibleOcNav(role).map((item) => item.path)
    expect(paths('platform_support')).toEqual(['/oc', '/oc/gyms', '/oc/support', '/oc/settings'])
    expect(paths('platform_ops')).toEqual(['/oc', '/oc/gyms', '/oc/sales', '/oc/support', '/oc/settings'])
    expect(paths('platform_admin')).toEqual(['/oc', '/oc/gyms', '/oc/sales', '/oc/support', '/oc/settings'])
  })

  it('hides Sales from support-only operators', () => {
    expect(visibleOcNav('platform_support').some((item) => item.id === 'sales')).toBe(false)
    expect(visibleOcNav('platform_sales').some((item) => item.id === 'sales')).toBe(true)
  })

  it('treats nested gym routes as Gyms, not Overview', () => {
    expect(ocNavActive('/oc', '/oc')).toBe(true)
    expect(ocNavActive('/oc/gyms', '/oc')).toBe(false)
    expect(ocNavActive('/oc/gyms/local/1', '/oc/gyms')).toBe(true)
  })
})
