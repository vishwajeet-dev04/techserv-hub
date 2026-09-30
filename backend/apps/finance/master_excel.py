"""Excel template, export and import for finance clients and vendors."""

from __future__ import annotations

from decimal import Decimal, InvalidOperation

from openpyxl import Workbook
from rest_framework.exceptions import ValidationError as DrfValidationError

from apps.finance.models import FinanceClient, FinanceVendor
from apps.pulse.excel import (
    _add_list_validation,
    _autosize,
    _workbook_bytes,
    cell_at,
    cell_text,
    format_phone,
    iter_data_rows,
    open_upload,
)

YES_NO = ['Yes', 'No']
TRUE_WORDS = {'yes', 'y', 'true', '1', 'active'}

CLIENT_COLUMNS = [
    ('Client Name', 'name'),
    ('Service Line', 'service_line'),
    ('Contact Person', 'contact_person'),
    ('Email', 'email'),
    ('Mobile', 'mobile'),
    ('PAN', 'pan'),
    ('GSTIN', 'gstin'),
    ('MSME', 'msme_registered'),
    ('MSME Number', 'msme_number'),
    ('Billing Address', 'billing_address'),
    ('City', 'city'),
    ('State', 'state'),
    ('Payment Terms (Days)', 'payment_terms_days'),
    ('Active', 'is_active'),
    ('Notes', 'notes'),
]

VENDOR_COLUMNS = [
    ('Vendor Name', 'name'),
    ('Category', 'category'),
    ('Contact Person', 'contact_person'),
    ('Email', 'email'),
    ('Mobile', 'mobile'),
    ('PAN', 'pan'),
    ('GSTIN', 'gstin'),
    ('MSME', 'msme_registered'),
    ('MSME Number', 'msme_number'),
    ('TDS Applicable', 'tds_applicable'),
    ('TDS Section', 'tds_section'),
    ('TDS Rate (%)', 'tds_rate'),
    ('Address', 'address'),
    ('City', 'city'),
    ('State', 'state'),
    ('Bank Account Name', 'bank_account_name'),
    ('Bank Account Number', 'bank_account_number'),
    ('IFSC', 'ifsc'),
    ('Active', 'is_active'),
    ('Notes', 'notes'),
]

BOOL_FIELDS = {'msme_registered', 'tds_applicable', 'is_active'}
NAME_ALIASES = {
    'name': ('client name', 'vendor name', 'name'),
    'email': ('email', 'mail id', 'mail'),
    'mobile': ('mobile', 'mobile number', 'phone'),
    'gstin': ('gstin', 'gstn', 'gst number', 'gst'),
    'tds_rate': ('tds rate', 'tds rate %'),
    'payment_terms_days': ('payment terms days', 'payment terms'),
    'msme_registered': ('msme', 'msme registered'),
    'tds_applicable': ('tds applicable', 'tds applicability', 'tds'),
}

SHEET_TITLES = {FinanceClient: 'Clients', FinanceVendor: 'Vendors'}


def _columns_for(model):
    return CLIENT_COLUMNS if model is FinanceClient else VENDOR_COLUMNS


def _cell_value(obj, field):
    value = getattr(obj, field)
    if field in BOOL_FIELDS:
        return 'Yes' if value else 'No'
    if isinstance(value, Decimal):
        return float(value)
    return '' if value is None else value


def _build_workbook(model, rows: list[list]) -> bytes:
    columns = _columns_for(model)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = SHEET_TITLES[model]
    sheet.append([header for header, _ in columns])
    for row in rows:
        sheet.append(row)
    max_rows = max(200, len(rows) + 50)
    for index, (_, field) in enumerate(columns, start=1):
        if field in BOOL_FIELDS:
            _add_list_validation(sheet, index, YES_NO, rows=max_rows)
    _autosize(sheet)
    return _workbook_bytes(workbook)


def _export(model) -> bytes:
    columns = _columns_for(model)
    rows = [[_cell_value(obj, field) for _, field in columns] for obj in model.objects.order_by('name')]
    return _build_workbook(model, rows)


def export_clients_xlsx() -> bytes:
    return _export(FinanceClient)


def export_vendors_xlsx() -> bytes:
    return _export(FinanceVendor)


def client_template_xlsx() -> bytes:
    return _build_workbook(FinanceClient, [[
        'Sample Client Pvt Ltd', 'Managed Services', 'Priya Sharma', 'accounts@sampleclient.in',
        '9876543210', 'ABCDE1234F', '29ABCDE1234F1Z5', 'No', '', '12 MG Road',
        'Bengaluru', 'Karnataka', 30, 'Yes', 'Sample row - replace or delete.',
    ]])


def vendor_template_xlsx() -> bytes:
    return _build_workbook(FinanceVendor, [[
        'Sample Vendor LLP', 'Rent', 'Ravi Kumar', 'billing@samplevendor.in',
        '9123456780', 'AAAFS1234K', '29AAAFS1234K1Z2', 'Yes', 'UDYAM-KR-03-0012345',
        'Yes', '194I', 10, '4 Residency Road', 'Bengaluru', 'Karnataka',
        'Sample Vendor LLP', '001234567890', 'HDFC0001234', 'Yes', 'Sample row - replace or delete.',
    ]])


def _parse_bool(value, default: bool) -> bool:
    text = cell_text(value).lower()
    if not text:
        return default
    return text in TRUE_WORDS


def _parse_number(value, *, integer: bool = False):
    text = cell_text(value).replace(',', '').rstrip('%').strip()
    if not text:
        return None
    try:
        number = Decimal(text)
    except InvalidOperation as exc:
        raise ValueError(f'"{text}" is not a number.') from exc
    return int(number) if integer else number


def _parse_row(model, raw, headers) -> dict:
    data: dict = {}
    for header, field in _columns_for(model):
        names = NAME_ALIASES.get(field, ()) + (header,)
        value = cell_at(raw, headers, *names)
        if field in BOOL_FIELDS:
            data[field] = _parse_bool(value, default=field == 'is_active')
        elif field == 'mobile':
            data[field] = format_phone(value)
        elif field == 'tds_rate':
            data[field] = _parse_number(value)
        elif field == 'payment_terms_days':
            data[field] = _parse_number(value, integer=True)
        else:
            data[field] = cell_text(value)
    return data


def _flatten_error(exc: DrfValidationError) -> str:
    detail = exc.detail
    if isinstance(detail, dict):
        parts = []
        for key, value in detail.items():
            message = value[0] if isinstance(value, list) and value else value
            parts.append(message if key == 'non_field_errors' else f'{key}: {message}')
        return '; '.join(str(part) for part in parts)
    if isinstance(detail, list) and detail:
        return str(detail[0])
    return str(detail)


def _import(model, serializer_class, content: bytes) -> dict:
    workbook = open_upload(content)
    sheet = workbook[SHEET_TITLES[model]] if SHEET_TITLES[model] in workbook.sheetnames else workbook.active
    created = updated = 0
    errors: list[dict] = []
    for excel_row, raw, headers in iter_data_rows(sheet):
        if not any(cell_text(value) for value in raw):
            continue
        try:
            data = _parse_row(model, raw, headers)
        except ValueError as exc:
            errors.append({'row': excel_row, 'message': str(exc)})
            continue
        if not data['name']:
            errors.append({'row': excel_row, 'message': 'Name is required.'})
            continue
        existing = model.objects.filter(name__iexact=' '.join(data['name'].split())).first()
        if existing:
            data['name'] = existing.name
        serializer = serializer_class(existing, data=data) if existing else serializer_class(data=data)
        try:
            serializer.is_valid(raise_exception=True)
        except DrfValidationError as exc:
            errors.append({'row': excel_row, 'message': _flatten_error(exc)})
            continue
        serializer.save()
        if existing:
            updated += 1
        else:
            created += 1
    return {'created': created, 'updated': updated, 'errors': errors}


def import_clients_xlsx(content: bytes) -> dict:
    from apps.finance.serializers import FinanceClientSerializer

    return _import(FinanceClient, FinanceClientSerializer, content)


def import_vendors_xlsx(content: bytes) -> dict:
    from apps.finance.serializers import FinanceVendorSerializer

    return _import(FinanceVendor, FinanceVendorSerializer, content)
