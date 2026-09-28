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
  deal_count?: number
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
  service_pillar: string
  sub_category: string
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

export interface PoWorkflow {
  id: string
  company: string
  company_name: string
  customer_name: string
  billing_entity: string
  service_pillar: string
  po_number: string
  po_date: string | null
  agreement: string
  start_date: string | null
  end_date: string | null
  expiry: string | null
  total_value: number | null
  value_per_invoice: number | null
  billing_cycle: string
  billing_due: string
  status: 'Active' | 'Completed'
  po_display: string
  finance_approved: boolean
  finance_approved_at: string | null
  finance_purchase_order: string | null
  opportunity: string | null
  opportunity_prospect_number: string | null
  opportunity_name: string | null
  opportunity_company_name: string | null
  created_at: string
  updated_at: string
}

export interface PoWorkflowDashboard {
  kpis: {
    active_pos: number
    total_contract_value: number
    avg_monthly_billing: number
    avg_duration_months: number
  }
  by_category: { name: string; value: number }[]
  timeline: {
    id: string
    po_display: string
    customer_name: string
    start: string | null
    end: string | null
    status: 'Active' | 'Completed'
  }[]
  rows: PoWorkflow[]
  clients: string[]
  vendors: string[]
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

export interface PipelineStageRow {
  stage: DealStage
  count: number
  total_value: number
  weighted_value?: number
}

export interface PipelineBreakdown {
  name: string
  count: number
  total_value: number
  weighted_value: number
  won_count: number
  lost_count: number
  active_count: number
}

export interface PipelineSummary {
  total_pipeline: number
  weighted_pipeline: number
  active_deals_count: number
  closing_soon_count: number
  won_this_month_count: number
  won_this_month_value: number
  won_count?: number
  won_value?: number
  lost_count?: number
  lost_value?: number
  win_rate?: number
  by_stage: PipelineStageRow[]
  funnel?: PipelineStageRow[]
  by_pillar?: PipelineBreakdown[]
  by_owner?: PipelineBreakdown[]
  by_source?: PipelineBreakdown[]
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
  latest_period?: string | null
  business: CompanyStats
  pipeline: PipelineSummary
  financial: FinancialSummary
  revenue_trend: RevenueTrendPoint[]
  active_deals_count?: number
  overdue_deals_count?: number
  deals_closing_this_week?: number
}

export type AlertSeverity = 'info' | 'warning' | 'critical'

export interface DashboardAlert {
  type: string
  severity: AlertSeverity
  title: string
  description: string
  count: number
  data: Record<string, unknown>[]
}

export interface DashboardAlertsResponse {
  alerts: DashboardAlert[]
  total_alerts: number
  critical_count: number
  warning_count: number
  info_count: number
}

export interface ReportPeriodOption {
  id: string
  label: string
}

export interface MonthlySummaryReport {
  report_type: 'monthly_summary'
  period: string | null
  generated_at: string
  financial: FinancialSummary
  pipeline: PipelineSummary
  business: CompanyStats
  revenue_trend: RevenueTrendPoint[]
  highlights: string[]
  available_periods: ReportPeriodOption[]
}

export interface SalesPipelineReport {
  report_type: 'sales_pipeline'
  generated_at: string
  summary: PipelineSummary
  deals: Deal[]
  by_owner: {
    owner_name: string
    deal_count: number
    total_value: number
    weighted_value: number
  }[]
  by_stage: {
    stage: DealStage
    count: number
    total_value: number
    weighted_value: number
  }[]
  by_company: {
    company_name: string
    deal_count: number
    total_value: number
  }[]
}

export interface FinancialReportMetrics extends FinancialSummary {
  cost_of_goods_sold?: number
  operating_expenses?: number
  tax?: number
}

export interface FinancialSummaryReport {
  report_type: 'financial_summary'
  period: string | null
  generated_at: string
  metrics: FinancialReportMetrics
  all_periods: RevenueTrendPoint[]
  available_periods: ReportPeriodOption[]
  ratios: {
    profit_margin: number | null
    receivables_to_revenue: number | null
    debt_to_equity: number | null
  }
}

export interface CustomerRevenueRow {
  company_id: string
  company_name: string
  status: CompanyStatus
  deal_count: number
  total_deal_value: number
  won_deal_value: number
  active_deal_value: number
}

export interface CustomerRevenueReport {
  report_type: 'customer_revenue'
  generated_at: string
  companies: CustomerRevenueRow[]
  top_customers: CustomerRevenueRow[]
  concentration_risk: {
    top_customer_percentage: number
    top_3_percentage: number
    is_concentrated: boolean
  }
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

export interface OpsInvoiceRow {
  id: string
  invoice_number: string
  customer_name: string
  amount: number
  invoice_date: string
  due_date: string | null
  pending_since: string
  days_pending: number
}

export interface OpsSummary {
  po_metrics: { total_po_value: number; open_po: number; to_be_invoiced: number }
  revenue_metrics: { invoiced: number }
  receivables: {
    total: number
    due: number
    due_0_7: number
    due_8_30: number
    overdue: number
    due_invoices: OpsInvoiceRow[]
    overdue_invoices: OpsInvoiceRow[]
  }
  cashflow_metrics: {
    total_inflow: number
    total_outflow: number
    net_cash_movement: number
    revenue_inflow: number
    revenue_outflow: number
    capital_inflow: number
    capital_outflow: number
  }
  payables_pending: number
  capital: Record<string, number>
  counts: Record<string, number>
  as_of: string
}

export interface BankPositionAccount {
  available: boolean
  label: string
  subtitle: string
  opening: number | null
  transfer_in?: number
  transfer_out?: number
  revenue_receipts?: number
  all_outflows?: number
  disbursements?: number | null
  transfer_to_ops?: number | null
  closing: number | null
  status?: string
}

export interface BankPosition {
  period_label: string
  combined_closing: number
  combined_scope: string
  operational: BankPositionAccount
  seed: BankPositionAccount
  internal_transfer: number
}

export interface OpsDashboardMonthPoint {
  month: string
  label: string
  billed?: number
  received?: number
  inflow?: number
  outflow?: number
  net?: number
  amount?: number
}

export interface OpsDashboardSeries {
  as_of: string
  billing_vs_collections: Array<{ month: string; label: string; billed: number; received: number }>
  cash_in_out: Array<{ month: string; label: string; inflow: number; outflow: number; net: number }>
  inflow_by_category: Array<{ category: string; amount: number }>
  aging: Array<{ bucket: string; amount: number }>
  net_cash_monthly: Array<{ month: string; label: string; net: number }>
  receivables_trend: Array<{ month: string; label: string; amount: number }>
}

export interface PurchaseOrder {
  id: string
  po_number: string
  company: string | null
  company_name: string | null
  customer_name: string
  billing_entity: string
  service_category: string
  description: string
  po_date: string | null
  start_date: string | null
  end_date: string | null
  total_value: number
  monthly_billing: number
  billing_cycle: string
  status: string
  invoiced_value: number
  remaining_value: number
  progress: number
  notes: string
}

export interface OpsInvoice {
  id: string
  invoice_number: string
  purchase_order: string | null
  po_number: string | null
  company: string | null
  company_name: string | null
  customer_name: string
  amount: number
  taxable_amount: number
  gst_amount: number
  tds_amount: number
  tds_section: string
  amount_received: number
  balance: number
  gross_payable: number
  net_payable: number
  invoice_date: string
  due_date: string | null
  received_date: string | null
  status: string
  notes: string
}

export interface OpsPayable {
  id: string
  vendor: string
  category: string
  invoice_number: string
  month_label: string
  taxable_amount: number
  gst_amount: number
  tds_amount: number
  total_amount: number
  payable_amount: number
  due_date: string | null
  status: string
  notes: string
}

export interface CashflowRow {
  id: string
  entry_date: string
  direction: 'INFLOW' | 'OUTFLOW'
  bucket: string
  category: string
  sub_category: string
  entity: string
  voucher_no: string
  amount: number
  notes: string
}

export interface MisImportResult {
  invoices: { created: number; updated: number }
  payables: { created: number; updated: number }
  cashflow: { created: number; updated: number }
  errors: Array<{ sheet?: string; row?: number; message: string }>
}

export interface LedgerCashflowSummary {
  total_inflow: number
  total_outflow: number
  net: number
  by_category: Array<{
    category: string
    inflow: number
    outflow: number
    net: number
    amount: number
    direction: string
  }>
  cards: Array<{
    category: string
    amount: number
    direction: string
    inflow: number
    outflow: number
    net: number
  }>
}

export interface LedgerPayablesSummary {
  total_payable: number
  total_paid: number
  outstanding: number
  tds_deducted: number
  paid_count: number
  pending_count: number
  by_category: Array<{ category: string; amount: number; count: number }>
}

export interface LedgerInvoicesSummary {
  count: number
  billed: number
  gst: number
  tds: number
  taxable: number
  received: number
  outstanding: number
}

export interface LedgerClientsSummary {
  active_clients: number
  clients: Array<{
    id: string
    name: string
    service_line: string
    gst_number: string
    active_pos: number
    total_invoiced: number
    total_paid: number
  }>
}

export interface LedgerPoSummary {
  count: number
  active: number
}

export type LedgerListParams = {
  from?: string
  to?: string
  search?: string
  client?: string
  vendor?: string
  status?: string
  direction?: string
  category?: string
  page_size?: number
}

export interface CapitalRow {
  id: string
  capital_type: string
  counterparty: string
  amount: number
  entry_date: string
  status: string
  notes: string
}

export interface MisUpload {
  id: string
  file_name: string
  file_type: string
  byte_size: number
  storage_path: string
  uploaded_by: string | null
  uploaded_by_name: string | null
  import_result?: MisImportResult | null
  created_at: string
  updated_at: string
}

export type ComplianceStatus = 'PENDING' | 'COMPLETED' | 'NOT_APPLICABLE'

export interface ComplianceItem {
  id: string
  title: string
  form_name: string
  applicable_act: string
  period_month: string
  due_date: string | null
  due_date_note: string
  status: ComplianceStatus
  notes: string
  created_by: string | null
  created_by_name: string | null
  created_at: string
  updated_at: string
}

export type PulseOppStatus = 'OPEN' | 'WON' | 'LOST'

export type PulseReminderType =
  | 'FOLLOW_UP'
  | 'TASK'
  | 'HIGH_VALUE_ALERT'
  | 'CLOSE_DATE'
  | 'STALE_OPPORTUNITY'

export interface PulseContact {
  id: string
  name: string
  company: string
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
  created_at: string
  updated_at: string
}

export interface PulseOpportunity {
  id: string
  prospect_number: string
  name: string
  company: string
  company_name: string
  contact: string
  contact_name: string
  owner: string | null
  owner_name: string
  owner_display: string
  lead_source: string
  service_pillar: string
  sub_category: string
  delivery_partner: string
  stage: string
  status: PulseOppStatus
  expected_amount: string | number
  negotiated_amount: string | number
  currency: string
  display_amount: number
  is_high_value: boolean
  department: string
  follow_up_date: string | null
  expected_close_date: string | null
  comments: string
  linked_po_count: number
  linked_po_value: number
  linked_pos: { id: string; po_number: string; status: string; total_value: number }[]
  created_at: string
  updated_at: string
}

export interface PulseOpportunityActivityAttachment {
  id: string
  file_name: string
  content_type: string
  byte_size: number
  url: string | null
  created_at: string
  uploaded_by_name?: string | null
}

export interface PulseOpportunityActivity {
  id: string
  opportunity: string
  actor: string | null
  actor_name: string | null
  action: 'STAGE_CHANGE' | 'NOTE' | 'FIELD_UPDATE'
  from_stage: string
  to_stage: string
  note: string
  follow_up_date: string | null
  attachments: PulseOpportunityActivityAttachment[]
  created_at: string
}

export interface PulseOpsUpdate {
  id: string
  opportunity_id: string
  prospect_number: string
  opportunity_name: string
  company_name: string | null
  actor: string | null
  actor_name: string | null
  action: 'STAGE_CHANGE' | 'NOTE' | 'FIELD_UPDATE'
  from_stage: string
  to_stage: string
  note: string
  attachment_count: number
  attachments: PulseOpportunityActivityAttachment[]
  created_at: string
}

export interface PulseReminder {
  id: string
  title: string
  reminder_type: PulseReminderType
  status: 'PENDING' | 'DONE'
  due_date: string | null
  description: string
  opportunity: string | null
  opportunity_name: string | null
  contact: string | null
  contact_name: string | null
}

export interface PulsePipelineFlowItem {
  key: string
  label: string
  count: number
  value?: number
  crm_label?: string
}

export interface PulseOpenPipeline {
  count: number
  value: number
  by_stage: { stage: string; count: number; value: number }[]
}

export interface PulsePipelineDashboard {
  contacts: number
  opportunities: number
  total_prospects: number
  win_rate: number
  pipeline_value: number
  open_opportunities: number
  open_pipeline: PulseOpenPipeline
  insight: string
  flow: PulsePipelineFlowItem[]
  by_source: { name: string; count: number }[]
  by_stage: { stage: string; count: number; value: number }[]
  expected_vs_negotiated: { name: string; expected: number; negotiated: number }[]
}

export interface PulseTeamRep {
  name: string
  total_leads: number
  converted: number
  won_count: number
  lost_count: number
  win_rate: number
  won_value: number
}

export interface PulseTeamDashboard {
  active_reps: number
  total_leads: number
  top_rep: string
  total_won_value: number
  by_rep: PulseTeamRep[]
}

export interface PulseFunnelStep {
  key: string
  label: string
  count: number
  from_label: string
  conversion: number
}

export interface PulseExecutiveDashboard {
  revenue_won: number
  pipeline_value: number
  win_rate: number
  deals_closed: number
  won_count: number
  leads: number
  deals: number
  revenue_won_prior: number | null
  pipeline_value_prior: number | null
  win_rate_prior: number | null
  deals_closed_prior: number | null
  funnel: {
    steps: PulseFunnelStep[]
    drop: { from_label: string; to_label: string; percent: number }
  }
  pipeline_health: { stage: string; count: number; value: number }[]
  attention: { stage: string; count: number; value: number }[]
  by_pillar_won: { name: string; count: number; share: number }[]
  by_pillar_revenue: {
    win: { name: string; value: number; share: number }[]
    closed: { name: string; value: number; share: number }[]
    both: { name: string; value: number; share: number }[]
  }
  volume: { week: string; leads: number; deals: number; won_value: number; win: number; lost: number }[]
  sales_cycle_days: number
  insights: { effective: string[]; attention: string[] }
  benchmarks: {
    avg_deal_size: number
    sales_cycle_days: number
    lead_conversion: number
  }
}

export interface PulseAssignee {
  id: string
  name: string
  role: string
}

export interface PulseSummary {
  contacts: number
  opportunities: number
  open_opportunities: number
  won_opportunities: number
  lost_opportunities: number
  pending_reminders: number
  pipeline_expected: number
  pipeline_negotiated: number
  pipeline_final: number
  high_value_threshold: number
  service_pillars: string[]
  sub_categories: string[]
  sales_stages: string[]
}

export interface PulseSettings {
  high_value_threshold: number
  default_currency: string
  service_pillars: string[]
  sub_categories: string[]
  sales_stages: string[]
  currencies: string[]
  companies: string[]
}

export interface PulseImportResult {
  created: number
  errors: { row: number; message: string }[]
}