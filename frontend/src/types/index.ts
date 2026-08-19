export type UserRole = 'ADMIN' | 'MANAGEMENT' | 'SALES' | 'FINANCE' | 'VIEWER'
export type CompanyStatus = 'PROSPECT' | 'CUSTOMER' | 'PARTNER' | 'INACTIVE'
export type DealStage = 'LEAD' | 'QUALIFIED' | 'REQUIREMENT' | 'PROPOSAL' | 'NEGOTIATION' | 'WON' | 'LOST'
export type DealActivityType = 'NOTE' | 'CALL' | 'MEETING' | 'EMAIL' | 'PROPOSAL' | 'FOLLOW_UP'
export type ExtractionStatus = 'UPLOADED' | 'PROCESSING' | 'EXTRACTED' | 'FAILED'
export type ValidationStatus = 'PENDING' | 'VALID' | 'REQUIRES_REVIEW' | 'REJECTED'
export type PeriodType = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL'
export type DocumentType =
  | 'PROFIT_LOSS'
  | 'BALANCE_SHEET'
  | 'CASH_FLOW'
  | 'BANK_STATEMENT'
  | 'MANAGEMENT_REPORT'
  | 'OTHER'

export interface User {
  id: string
  name: string
  email: string
  role: UserRole
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface Company {
  id: string
  name: string
  company_type: string
  industry: string
  website: string
  location: string
  status: CompanyStatus
  owner: User | null
  owner_id: string | null
  owner_name: string | null
  notes: string
  contact_count?: number
  contacts?: Contact[]
  created_at: string
  updated_at: string
}

export interface Contact {
  id: string
  company: string
  company_name?: string
  first_name: string
  last_name: string
  full_name: string
  designation: string
  email: string
  phone: string
  linkedin_url: string
  notes: string
  created_at: string
  updated_at: string
}

export interface Deal {
  id: string
  company: string
  company_name: string
  name: string
  description: string
  value: number
  currency: string
  stage: DealStage
  probability: number
  weighted_value: number
  expected_close_date: string | null
  owner: string | null
  owner_name: string | null
  source: string
  notes: string
  activities?: DealActivity[]
  created_at: string
  updated_at: string
}

export interface DealActivity {
  id: string
  deal: string
  type: DealActivityType
  subject: string
  description: string
  activity_date: string
  created_by: string | null
  created_by_name: string | null
  created_at: string
}

export interface FinancialPeriod {
  id: string
  period_type: PeriodType
  start_date: string
  end_date: string
  label: string
  created_at: string
}

export interface FinancialDocument {
  id: string
  file_name: string
  file_type: string
  document_type: DocumentType
  financial_period: string | null
  period_label?: string
  uploaded_by: string | null
  uploaded_by_name?: string
  extraction_status: ExtractionStatus
  validation_status: ValidationStatus
  extraction_error: string
  created_at: string
  updated_at: string
}

export interface FinancialMetric {
  id: string
  financial_period: string
  period_label: string
  metric_code: string
  value: number
  currency: string
  source_document: string | null
  source_reference: string
  confidence: number | null
  is_manual: boolean
  created_at: string
}

export interface PaginatedResponse<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface ApiError {
  error: boolean
  message: string
  details: Record<string, unknown> | null
}

export interface CompanyStats {
  total: number
  customers: number
  prospects: number
  partners: number
  inactive: number
}

export interface PipelineSummary {
  total_pipeline: number
  weighted_pipeline: number
  active_deals_count: number
  closing_soon_count: number
  won_this_month_count: number
  won_this_month_value: number
  by_stage: { stage: DealStage; count: number; total_value: number }[]
}

export interface FinancialSummary {
  revenue: number
  expenses: number
  gross_profit: number
  operating_profit: number
  net_profit: number
  cash: number
  receivables: number
  payables: number
  assets: number
  liabilities: number
  equity: number
  profit_margin: number | null
}

export interface RevenueTrendPoint {
  period: string
  revenue: number
  net_profit: number
}

export interface DashboardData {
  period: string | null
  business: CompanyStats
  pipeline: PipelineSummary
  financial: FinancialSummary
  revenue_trend: RevenueTrendPoint[]
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthTokens {
  access: string
  refresh: string
  user: User
}