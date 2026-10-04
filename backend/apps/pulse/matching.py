"""Loose name matching for Excel imports (companies, contacts, assignees)."""
from __future__ import annotations

import re
import unicodedata

from apps.business.models import Company
from apps.pulse.models import PulseContact
from apps.users.models import User

COMPANY_SUFFIXES = {
    'pvt', 'private', 'ltd', 'limited', 'llp', 'llc', 'inc', 'co', 'corp',
    'corporation', 'company', 'plc',
}
PLACEHOLDER_VALUES = {'', '—', 'unspecified@placeholder.local'}


def norm_text(value) -> str:
    text = unicodedata.normalize('NFKC', str(value or '')).replace('\u00a0', ' ')
    return ' '.join(text.split()).casefold()


def company_key(value) -> str:
    """'CitiusCloud Services Pvt. Ltd.' and 'Citius Cloud Services Private Limited' share a key."""
    words = re.sub(r'[^\w\s]', ' ', norm_text(value)).replace('_', ' ').split()
    core = [word for word in words if word not in COMPANY_SUFFIXES]
    return ''.join(core or words)


def contact_key(company_name, contact_name) -> tuple[str, str]:
    return company_key(company_name), norm_text(contact_name)


class CompanyResolver:
    """Per-import cache of companies keyed by company_key."""

    def __init__(self):
        self._by_key: dict[str, Company] = {}
        self._pending: list[str] = []
        for company in Company.objects.only('id', 'name').order_by('created_at'):
            self._by_key.setdefault(company_key(company.name), company)

    def find(self, name: str) -> Company | None:
        return self._by_key.get(company_key(name))

    def get_or_create(self, name: str) -> Company:
        found = self.find(name)
        if found:
            return found
        company = Company.objects.create(name=name.strip()[:255])
        key = company_key(company.name)
        self._by_key[key] = company
        self._pending.append(key)
        return company

    def commit(self) -> None:
        self._pending.clear()

    def discard(self) -> None:
        for key in self._pending:
            self._by_key.pop(key, None)
        self._pending.clear()


class ContactIndex:
    """Per-import cache of Pulse contacts keyed by (company_key, normalized name)."""

    def __init__(self):
        self._by_key: dict[tuple[str, str], PulseContact] = {}
        self._pending: list[tuple[str, str]] = []
        for contact in PulseContact.objects.select_related('company').order_by('created_at'):
            self._by_key.setdefault(contact_key(contact.company.name, contact.name), contact)

    def find(self, company_name: str, contact_name: str) -> PulseContact | None:
        return self._by_key.get(contact_key(company_name, contact_name))

    def add(self, contact: PulseContact) -> None:
        key = contact_key(contact.company.name, contact.name)
        self._by_key[key] = contact
        self._pending.append(key)

    def commit(self) -> None:
        self._pending.clear()

    def discard(self) -> None:
        for key in self._pending:
            self._by_key.pop(key, None)
        self._pending.clear()


class OwnerMatcher:
    """Match an Excel 'Assigned To' value to an active user: email, full name, unique first name, unique prefix."""

    def __init__(self):
        self._users = list(User.objects.filter(is_active=True).only('id', 'name', 'email').order_by('name'))

    def match(self, raw: str) -> User | None:
        text = norm_text(raw)
        if not text:
            return None
        for user in self._users:
            if user.email and norm_text(user.email) == text:
                return user
        exact = [user for user in self._users if norm_text(user.name) == text]
        if exact:
            return exact[0]
        if ' ' not in text:
            first = [user for user in self._users if norm_text(user.name).split(' ')[0] == text]
            if len(first) == 1:
                return first[0]
        prefix = [user for user in self._users if norm_text(user.name).startswith(text)]
        if len(prefix) == 1:
            return prefix[0]
        return None


def is_blank_value(value) -> bool:
    return str(value or '').strip() in PLACEHOLDER_VALUES
