import logging
from decimal import Decimal, InvalidOperation

from apps.finance.models import FinancialMetric, METRIC_CODES

logger = logging.getLogger(__name__)


def validate_metric_value(value) -> Decimal:
    try:
        amount = Decimal(str(value))
    except (InvalidOperation, TypeError, ValueError) as exc:
        raise ValueError('Value must be a number.') from exc
    return amount


def update_manual_metric(metric: FinancialMetric, value, user=None) -> FinancialMetric:
    metric.value = validate_metric_value(value)
    metric.is_manual = True
    metric.save()
    actor = getattr(user, 'email', 'system')
    logger.info(f'Manual metric updated: {metric.metric_code}={metric.value} by {actor}')
    return metric


def allowed_metric_codes() -> list[str]:
    return list(METRIC_CODES)
