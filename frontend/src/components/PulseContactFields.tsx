import {
  COUNTRY_PRESETS,
  DEPARTMENT_PRESETS,
  DESIGNATION_PRESETS,
  citiesForCountry,
  countryHasLocationMap,
  statesForCountry,
} from '../lib/pulsePresets'
import { mergeOptionsWithRecents } from '../lib/pulseRecent'
import { validateContactForm } from '../lib/pulseValidation'
import SuggestSelect from './SuggestSelect'
import { fieldClass, labelClass } from './Modal'

export const emptyContactForm = {
  name: '',
  company_name: '',
  designation: '',
  department: '',
  email: '',
  company_email: '',
  phone: '',
  address_1: '',
  city: '',
  state: '',
  country: '',
  gst_number: '',
}

export type ContactFormValues = typeof emptyContactForm

export function contactFromRow(row: {
  name: string
  company_name: string
  designation: string
  department: string
  email: string
  company_email: string
  phone: string
  address_1: string
  city: string
  state: string
  country: string
  gst_number: string
}): ContactFormValues {
  return {
    name: row.name,
    company_name: row.company_name,
    designation: row.designation ?? '',
    department: row.department ?? '',
    email: row.email ?? '',
    company_email: row.company_email ?? '',
    phone: row.phone ?? '',
    address_1: row.address_1 ?? '',
    city: row.city ?? '',
    state: row.state ?? '',
    country: row.country ?? '',
    gst_number: row.gst_number ?? '',
  }
}

/** @deprecated use validateContactForm from lib/pulseValidation */
export function missingContactField(form: ContactFormValues): string | null {
  const errors = validateContactForm(form)
  const first = Object.values(errors)[0]
  return first ?? null
}

export function PulseContactFields({
  form,
  onChange,
  errors = {},
}: {
  form: ContactFormValues
  onChange: (key: keyof ContactFormValues, value: string) => void
  errors?: Partial<Record<keyof ContactFormValues, string>>
}) {
  const field = (key: keyof ContactFormValues) => (event: { target: { value: string } }) => {
    onChange(key, event.target.value)
  }

  const designationOptions = mergeOptionsWithRecents('designation', DESIGNATION_PRESETS)
  const departmentOptions = mergeOptionsWithRecents('department', DEPARTMENT_PRESETS)
  const countryOptions = mergeOptionsWithRecents('country', COUNTRY_PRESETS)
  const stateOptions = mergeOptionsWithRecents('state', statesForCountry(form.country))
  const cityOptions = mergeOptionsWithRecents('city', citiesForCountry(form.country))

  const onCountryChange = (next: string) => {
    const mapped = countryHasLocationMap(next)
    const allowedStates = mapped
      ? new Set(statesForCountry(next).map((s) => s.toLowerCase()))
      : null
    const allowedCities = mapped
      ? new Set(citiesForCountry(next).map((c) => c.toLowerCase()))
      : null
    onChange('country', next)
    if (allowedStates && form.state && !allowedStates.has(form.state.toLowerCase())) {
      onChange('state', '')
    }
    if (allowedCities && form.city && !allowedCities.has(form.city.toLowerCase())) {
      onChange('city', '')
    }
  }

  return (
    <>
      <Field label="Company Name*" value={form.company_name} onChange={field('company_name')} error={errors.company_name} required />
      <Field label="Contact Name*" value={form.name} onChange={field('name')} error={errors.name} required />
      <SuggestSelect
        label="Designation"
        value={form.designation}
        options={designationOptions}
        onChange={(value) => onChange('designation', value)}
        error={errors.designation}
      />
      <SuggestSelect
        label="Department*"
        value={form.department}
        options={departmentOptions}
        onChange={(value) => onChange('department', value)}
        error={errors.department}
        required
      />
      <Field label="Contact Email" type="email" value={form.email} onChange={field('email')} error={errors.email} />
      <Field label="Company Email" type="email" value={form.company_email} onChange={field('company_email')} error={errors.company_email} />
      <Field label="Phone" value={form.phone} onChange={field('phone')} error={errors.phone} />
      <Field label="Address_1" value={form.address_1} onChange={field('address_1')} />
      <SuggestSelect
        label="Country*"
        value={form.country}
        options={countryOptions}
        onChange={onCountryChange}
        error={errors.country}
        required
      />
      <SuggestSelect
        label="State*"
        value={form.state}
        options={stateOptions}
        onChange={(value) => onChange('state', value)}
        error={errors.state}
        required
      />
      <SuggestSelect
        label="City*"
        value={form.city}
        options={cityOptions}
        onChange={(value) => onChange('city', value)}
        error={errors.city}
        required
      />
      <Field label="GST Number" value={form.gst_number} onChange={field('gst_number')} />
    </>
  )
}

function Field({
  label,
  value,
  onChange,
  type = 'text',
  error,
  required,
}: {
  label: string
  value: string
  onChange: (event: { target: { value: string } }) => void
  type?: string
  error?: string
  required?: boolean
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      <input
        type={type}
        className={`${fieldClass}${error ? ' border-danger' : ''}`}
        value={value}
        onChange={onChange}
        required={required}
      />
      {error ? <p className="text-xs text-danger mt-1">{error}</p> : null}
    </div>
  )
}
