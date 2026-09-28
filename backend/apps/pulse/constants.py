HIGH_VALUE_INR = 10_000_000

MAX_IMPORT_BYTES = 2 * 1024 * 1024
MAX_STAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024
MAX_STAGE_ATTACHMENTS = 10
STAGE_ATTACHMENT_EXTENSIONS = {
    '.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg', '.xlsx', '.csv',
}

CURRENCIES = [
    'INR',
    'USD',
    'EUR',
    'GBP',
    'AED',
    'SGD',
    'JPY',
    'CNY',
]

SERVICE_PILLARS = [
    'PreSales',
    'PostSales',
    'Marketing',
    'Finance',
    'Software Dev',
    'Consulting',
    'Cybersecurity',
]

SUB_CATEGORIES = [
    'Resources',
    'Training',
    'BidBrain',
    'Brand Assets',
    'CMO services',
    'ICP & ABM',
    'Agentic Tool',
    'Cashflow finance',
    'Bill Discounting',
    'Growth Advisory',
    'FinOps/Biz Ops',
    'Cyber Security',
    'CMS / CLM',
    'Consulting Agentic Tool',
]

SALES_STAGES = [
    'Prospect',
    'Qualify',
    'Approach',
    'Demo',
    'Commercial',
    'Negotiation',
    'Win',
    'Lost',
    'Cancelled',
]

WON_STAGES = {'Win'}
LOST_STAGES = {'Lost', 'Cancelled'}
CLOSED_OUT_STAGES = WON_STAGES | LOST_STAGES
OPEN_PIPELINE_STAGES = [s for s in SALES_STAGES if s not in CLOSED_OUT_STAGES]

CONTACT_HEADERS = [
    'Company Name',
    'Contact Name',
    'Designation',
    'Department',
    'Contact Email',
    'Company Email',
    'Phone',
    'Address_1',
    'City',
    'State',
    'Country',
    'GST Number',
    'Created At',
]

OPPORTUNITY_HEADERS = [
    'Prospect Number',
    'Prospect Name',
    'Company name',
    'Contact Names',
    'Lead Source',
    'Service Pillar',
    'Sub-Categories',
    'Delivery Partner',
    'Expected Amount',
    'Currency',
    'Final Negotiated Amount',
    'Sales Stage',
    'Assigned To',
    'Created Date',
    'Updated At',
    'Followup Date',
    'Expected Close Date',
    'Notes',
]

_PILLAR_ALIASES = {
    'pre sales': 'PreSales',
    'presales': 'PreSales',
    'post sales': 'PostSales',
    'postsales': 'PostSales',
    'software development': 'Software Dev',
    'software dev': 'Software Dev',
    'cyber security': 'Cybersecurity',
    'cybersecurity': 'Cybersecurity',
    'growth consulting': 'Consulting',
}

_SUB_ALIASES = {
    'cmo services': 'CMO services',
    'cashflow finance': 'Cashflow finance',
    'finops/biz ops': 'FinOps/Biz Ops',
    'finops': 'FinOps/Biz Ops',
    'cyber security': 'Cyber Security',
}

_STAGE_ALIASES = {
    'lead generation': 'Prospect',
    'prospect': 'Prospect',
    'prospect qualification': 'Qualify',
    'lead qualification': 'Qualify',
    'assign': 'Qualify',
    'first contact': 'Qualify',
    'qualify': 'Qualify',
    'discovery meeting': 'Approach',
    'approach or demo': 'Approach',
    'approch or demo': 'Approach',
    'approach': 'Approach',
    'demo': 'Demo',
    'converted': 'Commercial',
    'commercial proposal': 'Commercial',
    'commertial prospect': 'Commercial',
    'commercial prospect': 'Commercial',
    'commercial': 'Commercial',
    'negotiation': 'Negotiation',
    'win': 'Win',
    'closed': 'Win',
    'lost': 'Lost',
    'cancel': 'Cancelled',
    'cancelled': 'Cancelled',
}


def coerce_pillar(value: str) -> str:
    text = (value or '').strip()
    if text in SERVICE_PILLARS:
        return text
    return _PILLAR_ALIASES.get(text.lower(), text)


def coerce_sub_category(value: str) -> str:
    text = (value or '').strip()
    if text in SUB_CATEGORIES:
        return text
    return _SUB_ALIASES.get(text.lower(), text)


def coerce_sales_stage(value: str) -> str:
    text = (value or '').strip()
    if text in SALES_STAGES:
        return text
    lowered = {item.lower(): item for item in SALES_STAGES}
    mapped = lowered.get(text.lower()) or _STAGE_ALIASES.get(text.lower())
    return mapped or text


def coerce_currency(value: str) -> str:
    text = (value or '').strip().upper()
    if text in CURRENCIES:
        return text
    return text or 'INR'


def status_for_sales_stage(stage: str) -> str:
    if stage in WON_STAGES:
        return 'WON'
    if stage in LOST_STAGES:
        return 'LOST'
    return 'OPEN'
