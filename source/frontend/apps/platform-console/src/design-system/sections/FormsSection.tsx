import { useState } from 'react'
import {
  CheckboxField,
  PasswordInput,
  RadioGroup,
  SearchInput,
  SelectField,
  SwitchField,
  TextAreaField,
  TextInput,
} from '../components/forms'
import { DsButton } from '../components/Button'
import { usePreview } from '../preview-context'

export function FormsSection() {
  const { t } = usePreview()
  const [email, setEmail] = useState('ops@sample.invalid')
  const [emailError, setEmailError] = useState<string | undefined>()
  const [password, setPassword] = useState('••••••••')
  const [gym, setGym] = useState('Nile Athletics')
  const [region, setRegion] = useState('cairo')
  const [install, setInstall] = useState('local')
  const [notify, setNotify] = useState(true)
  const [maint, setMaint] = useState(false)
  const [notes, setNotes] = useState('')
  const [date, setDate] = useState('2026-09-22')
  const [query, setQuery] = useState('')

  function validate() {
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    setEmailError(ok ? undefined : t('errorEmail'))
  }

  return (
    <section id="forms" className="ds-section">
      <p className="ds-section-kicker">E</p>
      <h2 className="ds-section-title">{t('formsTitle')}</h2>
      <p className="ds-section-lead">{t('formsLead')}</p>

      <form
        className="ds-card grid gap-4 md:grid-cols-2"
        onSubmit={(e) => {
          e.preventDefault()
          validate()
        }}
      >
        <TextInput label={`${t('text')} · ${t('default')}`} value="" placeholder={t('sampleGym')} readOnly />
        <TextInput label={`${t('text')} · ${t('filled')}`} value={gym} onChange={(e) => setGym(e.target.value)} hint={t('helper')} />
        <TextInput
          label={t('email')}
          type="email"
          required
          value={email}
          error={emailError}
          onChange={(e) => setEmail(e.target.value)}
        />
        <PasswordInput
          label={t('password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          showPasswordLabel={t('showPassword')}
          hidePasswordLabel={t('hidePassword')}
        />
        <SearchInput label={t('search')} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('search')} />
        <SelectField label={t('select')} value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="cairo">{t('cairo')}</option>
          <option value="giza">Giza</option>
          <option value="alex">Alexandria</option>
        </SelectField>
        <TextInput label={`${t('email')} · ${t('disabled')}`} value="disabled@sample.invalid" disabled />
        <TextInput label={t('date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        <div className="flex flex-col gap-3">
          <RadioGroup
            legend={t('radio')}
            name="install-type"
            value={install}
            onChange={setInstall}
            options={[
              { value: 'local', label: t('radioA') },
              { value: 'cloud', label: t('radioB') },
            ]}
          />
          <CheckboxField label={t('checkbox')} checked={notify} onChange={setNotify} />
          <SwitchField label={t('switch')} checked={maint} onChange={setMaint} />
        </div>
        <TextAreaField label={t('textarea')} value={notes} onChange={(e) => setNotes(e.target.value)} hint={t('focus')} />
        <div className="md:col-span-2">
          <DsButton type="submit">{t('validate')}</DsButton>
        </div>
      </form>
    </section>
  )
}
