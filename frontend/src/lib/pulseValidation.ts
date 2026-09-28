import type { ContactFormValues } from '../components/PulseContactFields'

const EMAIL_RE =
  /^[^\s@]+(?:\.[^\s@]+)*@[^\s@]+(?:\.[^\s@]+)*\.[a-zA-Z]{2,}$/

export function normalizePulseText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

export function normalizeContactForm(form: ContactFormValues): ContactFormValues {
  return {
    company_name: normalizePulseText(form.company_name),
    name: normalizePulseText(form.name),
    designation: normalizePulseText(form.designation),
    department: normalizePulseText(form.department),
    email: form.email.trim(),
    company_email: form.company_email.trim(),
    phone: form.phone.trim(),
    address_1: normalizePulseText(form.address_1),
    city: normalizePulseText(form.city),
    state: normalizePulseText(form.state),
    country: normalizePulseText(form.country),
    gst_number: normalizePulseText(form.gst_number),
  }
}

export function isValidContactEmail(value: string): boolean {
  const text = value.trim()
  if (!text || /\s/.test(text)) return false
  if (text.includes('..')) return false
  const [local, domain] = text.split('@')
  if (!local || !domain || text.split('@').length !== 2) return false
  if (local.startsWith('.') || local.endsWith('.') || domain.startsWith('.') || domain.endsWith('.')) {
    return false
  }
  return EMAIL_RE.test(text)
}

export function phoneDigitCount(value: string): number {
  const trimmed = value.trim()
  const digits = trimmed.replace(/\D/g, '')
  return digits.length
}

export function isValidContactPhone(value: string): boolean {
  const digits = phoneDigitCount(value)
  return digits >= 10 && digits <= 15
}

export function validateContactForm(form: ContactFormValues): Record<string, string> {
  const normalized = normalizeContactForm(form)
  const errors: Record<string, string> = {}
  const required: Array<[keyof ContactFormValues, string]> = [
    ['company_name', 'Company name'],
    ['name', 'Contact name'],
    ['department', 'Department'],
    ['city', 'City'],
    ['state', 'State'],
    ['country', 'Country'],
  ]
  for (const [key, label] of required) {
    if (!normalized[key].trim()) {
      errors[key] = `${label} is required.`
    }
  }
  if (normalized.email && !isValidContactEmail(normalized.email)) {
    errors.email = 'Enter a valid email address.'
  }
  if (normalized.company_email && !isValidContactEmail(normalized.company_email)) {
    errors.company_email = 'Enter a valid email address.'
  }
  if (normalized.phone && !isValidContactPhone(normalized.phone)) {
    errors.phone = 'Enter a valid phone number (10–15 digits).'
  }
  return errors
}

export type OpportunityFormValues = {
  name: string
  company_name: string
  contact: string
  owner: string
  service_pillar: string
  sub_category: string
  stage: string
  expected_amount: string
  negotiated_amount: string
  currency: string
  expected_close_date: string
  lead_source?: string
  delivery_partner?: string
  comments?: string
  follow_up_date?: string
}

export function normalizeOpportunityTextFields<T extends Record<string, string>>(form: T): T {
  const next = { ...form }
  for (const key of Object.keys(next) as Array<keyof T>) {
    const value = next[key]
    if (typeof value !== 'string') continue
    if (
      key === 'expected_amount' ||
      key === 'negotiated_amount' ||
      key === 'contact' ||
      key === 'owner' ||
      key === 'follow_up_date' ||
      key === 'expected_close_date'
    ) {
      continue
    }
    if (key === 'email' || key === 'company_email' || key === 'phone') {
      next[key] = value.trim() as T[keyof T]
      continue
    }
    next[key] = normalizePulseText(value) as T[keyof T]
  }
  return next
}

export function validateOpportunityForm(form: OpportunityFormValues): Record<string, string> {
  const errors: Record<string, string> = {}
  if (!normalizePulseText(form.name)) errors.name = 'Prospect name is required.'
  if (!normalizePulseText(form.company_name)) errors.company_name = 'Company is required.'
  if (!form.contact.trim()) errors.contact = 'Contact is required.'
  if (!form.owner.trim()) errors.owner = 'Assigned to is required.'
  if (!form.service_pillar) errors.service_pillar = 'Service pillar is required.'
  if (!form.sub_category) errors.sub_category = 'Sub-category is required.'
  if (!form.stage) errors.stage = 'Sales stage is required.'
  if (!form.currency.trim()) errors.currency = 'Currency is required.'
  if (!form.expected_close_date.trim()) errors.expected_close_date = 'Expected close date is required.'
  const expected = Number(form.expected_amount)
  if (!form.expected_amount.trim() || Number.isNaN(expected) || expected <= 0) {
    errors.expected_amount = 'Expected amount must be greater than zero.'
  }
  if (form.negotiated_amount?.trim()) {
    const negotiated = Number(form.negotiated_amount)
    if (Number.isNaN(negotiated) || negotiated < 0) {
      errors.negotiated_amount = 'Final negotiated amount cannot be negative.'
    }
  }
  return errors
}

export function validateReminderForm(
  title: string,
  due: string,
  editing: boolean,
): Record<string, string> {
  const errors: Record<string, string> = {}
  const trimmed = normalizePulseText(title)
  if (!trimmed) errors.title = 'Title is required.'
  else if (trimmed.length > 255) errors.title = 'Title is too long (max 255 characters).'
  if (!editing && !due.trim()) errors.due_date = 'Due date is required.'
  return errors
}
