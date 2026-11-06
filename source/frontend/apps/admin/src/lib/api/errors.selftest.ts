/**
 * Prompt 1 unit-style checks for auth client helpers (no network).
 * Run: npx tsx src/lib/api/errors.selftest.ts
 */
import { parseApiErrorBody } from './errors.ts'

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg)
}

const pd = parseApiErrorBody({
  title: 'OPEN_SHIFT_REQUIRED',
  detail: 'Open a shift first / افتح وردية أولاً',
  status: 409,
})
assert(pd.code === 'OPEN_SHIFT_REQUIRED', 'ProblemDetails title should be code')
assert(pd.message.includes('Open a shift'), 'detail should be display message')

const adHoc = parseApiErrorBody({ error: 'Invalid gym code.' })
assert(adHoc.message === 'Invalid gym code.', 'ad-hoc error field')

const msgOnly = parseApiErrorBody({ message: 'Not found' })
assert(msgOnly.message === 'Not found', 'ad-hoc message field')

console.log('errors.selftest: OK')
