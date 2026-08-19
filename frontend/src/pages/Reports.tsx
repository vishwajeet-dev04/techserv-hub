import type { ReactNode } from 'react'

const InfoIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
)

const ClockIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
)

const CalendarIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

const PipelineIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
    <polyline points="17 6 23 6 23 12" />
  </svg>
)

const ChartIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 3v18h18" />
    <path d="M18 9l-5 5-4-4-3 3" />
  </svg>
)

const UsersIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
)

interface ReportCardData {
  id: string
  title: string
  description: string
  icon: ReactNode
}

const reports: ReportCardData[] = [
  {
    id: 'monthly-summary',
    title: 'Monthly Business Summary',
    description:
      'A complete overview of business activity, deals closed, revenue, and key highlights for the month.',
    icon: <CalendarIcon />,
  },
  {
    id: 'sales-pipeline',
    title: 'Sales Pipeline Report',
    description:
      'Breakdown of all active deals by stage, owner, and expected close date with weighted pipeline analysis.',
    icon: <PipelineIcon />,
  },
  {
    id: 'financial-summary',
    title: 'Financial Summary',
    description:
      'Profit & Loss, Balance Sheet highlights, cash position, receivables and payables summary.',
    icon: <ChartIcon />,
  },
  {
    id: 'customer-revenue',
    title: 'Customer Revenue Report',
    description: 'Revenue contribution by customer, top accounts, and concentration risk analysis.',
    icon: <UsersIcon />,
  },
]

function ReportCard({ report }: { report: ReportCardData }) {
  return (
    <div className="bg-white border border-[#e5e5ea] shadow-sm rounded-2xl p-6 hover:shadow-md hover:border-[#d1d1d6] transition-all">
      <div className="w-10 h-10 rounded-xl bg-[#f5f5f7] border border-[#e5e5ea] flex items-center justify-center text-[#6e6e73] mb-4">
        {report.icon}
      </div>
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="text-sm font-semibold text-[#1a1a1a]">{report.title}</h3>
        <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 border border-amber-200 shrink-0">
          <span className="text-amber-700">
            <ClockIcon />
          </span>
          <span className="text-[10px] text-amber-700 font-medium">Coming Soon</span>
        </span>
      </div>
      <p className="text-xs text-[#6e6e73] leading-relaxed">{report.description}</p>
    </div>
  )
}

export default function Reports() {
  return (
    <div className="p-6 max-w-screen-xl mx-auto space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-[#1a1a1a]">Reports</h2>
        <p className="text-xs text-[#6e6e73] mt-0.5">Business and financial reports</p>
      </div>

      <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
        <div className="text-blue-700 mt-0.5">
          <InfoIcon />
        </div>
        <p className="text-xs text-blue-700 leading-relaxed">
          Reports use live KPI data from the same services that power the dashboard. All calculations
          are deterministic and traceable to source records.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {reports.map((report) => (
          <ReportCard key={report.id} report={report} />
        ))}
      </div>
    </div>
  )
}
