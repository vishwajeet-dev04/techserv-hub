"""Current finance workspace, taken from request headers.

A missing or unknown header is TechServ India, so older clients keep the
existing ledger.
"""

from __future__ import annotations

import contextvars

DEFAULT_COMPANY = 'techserv'
DEFAULT_REGION = 'india'
COMPANIES = {'techserv', 'techpay'}
REGIONS = {'india', 'malaysia', 'singapore'}

_current: contextvars.ContextVar[tuple[str, str]] = contextvars.ContextVar(
    'finance_workspace',
    default=(DEFAULT_COMPANY, DEFAULT_REGION),
)


def workspace_from_request(request) -> tuple[str, str]:
    company = (request.headers.get('X-Workspace-Company') or DEFAULT_COMPANY).strip().lower()
    region = (request.headers.get('X-Workspace-Region') or DEFAULT_REGION).strip().lower()
    if company not in COMPANIES:
        company = DEFAULT_COMPANY
    if region not in REGIONS:
        region = DEFAULT_REGION
    return company, region


def current_workspace() -> tuple[str, str]:
    return _current.get()


def activate_workspace(company: str, region: str):
    return _current.set((company, region))


def reset_workspace(token) -> None:
    _current.reset(token)


def workspace_stamp(company: str | None = None, region: str | None = None) -> dict:
    if company is None or region is None:
        company, region = current_workspace()
    return {'workspace_company': company, 'workspace_region': region}


def scoped(qs):
    company, region = current_workspace()
    return qs.filter(workspace_company=company, workspace_region=region)
