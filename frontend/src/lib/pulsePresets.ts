export const DESIGNATION_PRESETS = [
  'CEO',
  'CTO',
  'CFO',
  'Founder',
  'Director',
  'VP Sales',
  'Sales Manager',
  'Procurement Head',
] as const

export const DEPARTMENT_PRESETS = [
  'Sales',
  'Marketing',
  'IT',
  'Finance',
  'Operations',
  'Procurement',
  'Management',
  'Consulting',
] as const

export const LEAD_SOURCE_PRESETS = [
  'Website',
  'Referral',
  'LinkedIn',
  'Cold Call',
  'Partner',
  'Event',
  'Existing Customer',
  'Trade Show',
] as const

export const COUNTRY_PRESETS = [
  'India',
  'United States',
  'United Kingdom',
  'Singapore',
  'United Arab Emirates',
  'Australia',
  'Canada',
  'Germany',
  'France',
  'Japan',
  'Netherlands',
  'Saudi Arabia',
  'South Africa',
  'Brazil',
  'China',
] as const

export const INDIA_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const

export const STATE_PRESETS = [
  ...INDIA_STATES,
  'California',
  'New York',
  'Texas',
  'England',
  'Scotland',
  'Ontario',
  'Dubai',
  'Abu Dhabi',
  'New South Wales',
  'Victoria',
  'Bavaria',
  'Île-de-France',
  'Tokyo',
] as const

export const CITY_PRESETS = [
  'Mumbai',
  'Delhi',
  'Bengaluru',
  'Hyderabad',
  'Chennai',
  'Pune',
  'Kolkata',
  'Ahmedabad',
  'Jaipur',
  'Lucknow',
  'Kochi',
  'Chandigarh',
  'London',
  'New York',
  'Singapore',
  'Dubai',
  'Sydney',
  'Toronto',
  'San Francisco',
  'Berlin',
  'Paris',
  'Tokyo',
  'Hong Kong',
  'Shanghai',
] as const

const COUNTRY_TO_STATES: Record<string, readonly string[]> = {
  India: INDIA_STATES,
  'United States': ['California', 'New York', 'Texas', 'Florida', 'Washington'],
  'United Kingdom': ['England', 'Scotland', 'Wales', 'Northern Ireland'],
  Singapore: ['Singapore'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah'],
  Australia: ['New South Wales', 'Victoria', 'Queensland', 'Western Australia'],
  Canada: ['Ontario', 'British Columbia', 'Quebec', 'Alberta'],
  Germany: ['Bavaria', 'Berlin', 'Hamburg', 'North Rhine-Westphalia'],
  France: ['Île-de-France', 'Provence-Alpes-Côte d\'Azur', 'Auvergne-Rhône-Alpes'],
  Japan: ['Tokyo', 'Osaka', 'Kanagawa'],
  Netherlands: ['North Holland', 'South Holland', 'Utrecht'],
  'Saudi Arabia': ['Riyadh', 'Makkah', 'Eastern Province'],
  'South Africa': ['Gauteng', 'Western Cape', 'KwaZulu-Natal'],
  Brazil: ['São Paulo', 'Rio de Janeiro', 'Minas Gerais'],
  China: ['Beijing', 'Shanghai', 'Guangdong'],
}

const COUNTRY_TO_CITIES: Record<string, readonly string[]> = {
  India: [
    'Mumbai',
    'Delhi',
    'Bengaluru',
    'Hyderabad',
    'Chennai',
    'Pune',
    'Kolkata',
    'Ahmedabad',
    'Jaipur',
    'Lucknow',
    'Kochi',
    'Chandigarh',
  ],
  'United States': ['New York', 'San Francisco', 'Los Angeles', 'Chicago', 'Austin', 'Seattle'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Edinburgh'],
  Singapore: ['Singapore'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah'],
  Australia: ['Sydney', 'Melbourne', 'Brisbane', 'Perth'],
  Canada: ['Toronto', 'Vancouver', 'Montreal', 'Calgary'],
  Germany: ['Berlin', 'Munich', 'Hamburg', 'Frankfurt'],
  France: ['Paris', 'Lyon', 'Marseille'],
  Japan: ['Tokyo', 'Osaka', 'Yokohama'],
  Netherlands: ['Amsterdam', 'Rotterdam', 'The Hague'],
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Dammam'],
  'South Africa': ['Johannesburg', 'Cape Town', 'Durban'],
  Brazil: ['São Paulo', 'Rio de Janeiro', 'Brasília'],
  China: ['Shanghai', 'Beijing', 'Shenzhen', 'Hong Kong'],
}

export function statesForCountry(country: string): readonly string[] {
  const key = country.trim()
  if (!key) return STATE_PRESETS
  return COUNTRY_TO_STATES[key] ?? STATE_PRESETS
}

export function citiesForCountry(country: string): readonly string[] {
  const key = country.trim()
  if (!key) return CITY_PRESETS
  return COUNTRY_TO_CITIES[key] ?? CITY_PRESETS
}

export function countryHasLocationMap(country: string): boolean {
  const key = country.trim()
  return Boolean(key && COUNTRY_TO_STATES[key])
}
