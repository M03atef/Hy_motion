import { describe, expect, it, vi } from 'vitest'
import { openSalesContractPrint } from './OcSalesContractPanel'

describe('openSalesContractPrint', () => {
  it('writes html and calls print when a window opens', () => {
    const print = vi.fn()
    const write = vi.fn()
    const close = vi.fn()
    const focus = vi.fn()
    const open = vi.spyOn(window, 'open').mockReturnValue({
      document: { open: vi.fn(), write, close },
      focus,
      print,
    } as unknown as Window)
    expect(openSalesContractPrint('<html>demo</html>')).toBe(true)
    expect(write).toHaveBeenCalledWith('<html>demo</html>')
    expect(print).toHaveBeenCalled()
    open.mockRestore()
  })

  it('returns false when pop-up is blocked', () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    expect(openSalesContractPrint('<html />')).toBe(false)
    open.mockRestore()
  })
})
