MAX_IMPORT_BYTES = 2 * 1024 * 1024

PO_WORKFLOW_HEADERS = [
    'Customer',
    'Billing Entity',
    'Service Pillar',
    'PO Number',
    'PO Date',
    'Agreement',
    'Start Date',
    'End Date',
    'Hand Over Date',
    'Total value',
    'Value per Invoice',
    'Billing Cycle',
    'Milestone Details',
    'Billing Due',
]

BILLING_ENTITIES = ['India', 'SG']
PO_SERVICE_PILLARS = ['AIDA', 'FinOps', 'Loan', 'PRAS', 'BizOps', 'Sprouts', 'Consultancy']
AGREEMENTS = ['Yes', 'NA']
MILESTONE_CYCLE = 'Milestone'
LEGACY_MILESTONE_CYCLE = 'Event'
BILLING_CYCLES = ['Monthly', 'Quarterly', 'One-time', MILESTONE_CYCLE]
BILLING_DUES = [
    'Event Specific',
    '31st of Month',
    '5th of Next month',
    '1st of Month',
    '15th of Month',
    '15th of November',
]

PO_ISSUE_REASONS = {
    'WRONG_DOCUMENT': 'Wrong document uploaded',
    'PO_MISSING': 'PO copy missing',
    'NOT_SIGNED': 'Not signed or stamped',
    'AMOUNT_MISMATCH': 'Amount does not match opportunity',
    'CUSTOMER_MISMATCH': 'Customer or billing entity mismatch',
    'WRONG_DATES': 'Dates incorrect or expired',
    'UNREADABLE': 'File unreadable or corrupt',
    'OTHER': 'Other (explain in note)',
}
