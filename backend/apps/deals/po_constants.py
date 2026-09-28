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
    'Expiry',
    'Total value',
    'Value per Invoice',
    'Billing Cycle',
    'Billing Due',
]

BILLING_ENTITIES = ['India', 'SG']
PO_SERVICE_PILLARS = ['AIDA', 'FinOps', 'Loan', 'PRAS', 'BizOps', 'Sprouts', 'Consultancy']
AGREEMENTS = ['Yes', 'NA']
BILLING_CYCLES = ['Monthly', 'Quarterly', 'One-time', 'Event']
BILLING_DUES = [
    'Event Specific',
    '31st of Month',
    '5th of Next month',
    '1st of Month',
    '15th of Month',
    '15th of November',
]
