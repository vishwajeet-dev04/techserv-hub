export const INDIA_DIAL_CODE = '+91'

const OTHER_DIAL_CODES: { code: string; label: string }[] = [
  { code: '+93', label: 'Afghanistan +93' },
  { code: '+54', label: 'Argentina +54' },
  { code: '+61', label: 'Australia +61' },
  { code: '+43', label: 'Austria +43' },
  { code: '+973', label: 'Bahrain +973' },
  { code: '+880', label: 'Bangladesh +880' },
  { code: '+32', label: 'Belgium +32' },
  { code: '+975', label: 'Bhutan +975' },
  { code: '+55', label: 'Brazil +55' },
  { code: '+855', label: 'Cambodia +855' },
  { code: '+56', label: 'Chile +56' },
  { code: '+86', label: 'China +86' },
  { code: '+57', label: 'Colombia +57' },
  { code: '+420', label: 'Czech Republic +420' },
  { code: '+45', label: 'Denmark +45' },
  { code: '+20', label: 'Egypt +20' },
  { code: '+358', label: 'Finland +358' },
  { code: '+33', label: 'France +33' },
  { code: '+49', label: 'Germany +49' },
  { code: '+30', label: 'Greece +30' },
  { code: '+852', label: 'Hong Kong +852' },
  { code: '+62', label: 'Indonesia +62' },
  { code: '+98', label: 'Iran +98' },
  { code: '+353', label: 'Ireland +353' },
  { code: '+972', label: 'Israel +972' },
  { code: '+39', label: 'Italy +39' },
  { code: '+81', label: 'Japan +81' },
  { code: '+962', label: 'Jordan +962' },
  { code: '+254', label: 'Kenya +254' },
  { code: '+965', label: 'Kuwait +965' },
  { code: '+60', label: 'Malaysia +60' },
  { code: '+52', label: 'Mexico +52' },
  { code: '+212', label: 'Morocco +212' },
  { code: '+95', label: 'Myanmar +95' },
  { code: '+977', label: 'Nepal +977' },
  { code: '+31', label: 'Netherlands +31' },
  { code: '+64', label: 'New Zealand +64' },
  { code: '+234', label: 'Nigeria +234' },
  { code: '+47', label: 'Norway +47' },
  { code: '+968', label: 'Oman +968' },
  { code: '+92', label: 'Pakistan +92' },
  { code: '+63', label: 'Philippines +63' },
  { code: '+48', label: 'Poland +48' },
  { code: '+351', label: 'Portugal +351' },
  { code: '+974', label: 'Qatar +974' },
  { code: '+7', label: 'Russia +7' },
  { code: '+966', label: 'Saudi Arabia +966' },
  { code: '+65', label: 'Singapore +65' },
  { code: '+27', label: 'South Africa +27' },
  { code: '+82', label: 'South Korea +82' },
  { code: '+34', label: 'Spain +34' },
  { code: '+94', label: 'Sri Lanka +94' },
  { code: '+46', label: 'Sweden +46' },
  { code: '+41', label: 'Switzerland +41' },
  { code: '+886', label: 'Taiwan +886' },
  { code: '+66', label: 'Thailand +66' },
  { code: '+90', label: 'Turkey +90' },
  { code: '+380', label: 'Ukraine +380' },
  { code: '+971', label: 'United Arab Emirates +971' },
  { code: '+44', label: 'United Kingdom +44' },
  { code: '+1', label: 'United States / Canada +1' },
  { code: '+84', label: 'Vietnam +84' },
  { code: '+967', label: 'Yemen +967' },
]

export const DIAL_CODES: { code: string; label: string }[] = [
  { code: '+91', label: 'India +91' },
  ...OTHER_DIAL_CODES,
]

const CALLING_CODES = [...new Set(DIAL_CODES.map((item) => item.code.slice(1)))].sort(
  (a, b) => b.length - a.length,
)

/** Display and storage form: "+91 9986047767". Numbers without a code are shown as India. */
export function displayPhone(value: string | null | undefined): string {
  const text = (value || '').trim()
  if (!text || text === '—') return text
  const explicit = text.startsWith('+') || text.startsWith('00')
  let digits = text.replace(/\D/g, '')
  if (explicit && digits.startsWith('00')) digits = digits.slice(2)
  if (!digits) return text
  let code = ''
  let national = digits
  if (explicit || digits.length > 10) {
    const match = CALLING_CODES.find((item) => digits.startsWith(item) && digits.length - item.length >= 6)
    if (match && (explicit || digits.length > 10)) {
      code = match
      national = digits.slice(match.length)
    }
  }
  if (!code && digits.length === 10) {
    code = '91'
    national = digits
  } else if (!code && digits.length === 12 && digits.startsWith('91')) {
    code = '91'
    national = digits.slice(2)
  }
  if (!code) {
    code = '91'
    national = digits
  }
  return `+${code} ${national}`
}

export function splitPhone(value: string | null | undefined): { phone_country: string; phone: string } {
  const shown = displayPhone(value)
  const match = /^\+(\d+)\s+(\d+)$/.exec(shown)
  if (!match) return { phone_country: INDIA_DIAL_CODE, phone: '' }
  return { phone_country: `+${match[1]}`, phone: match[2] }
}

export function joinPhone(countryCode: string, national: string): string {
  const digits = national.replace(/\D/g, '')
  if (!digits) return ''
  const code = (countryCode || INDIA_DIAL_CODE).replace(/\D/g, '') || '91'
  return `+${code} ${digits}`
}

export function telHref(value: string): string {
  const shown = displayPhone(value)
  return `tel:${shown.replace(/\s/g, '')}`
}
