import logging
from rest_framework.views import exception_handler
from rest_framework.response import Response
from rest_framework import status

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    response = exception_handler(exc, context)

    if response is not None:
        error_data = {
            'error': True,
            'message': _get_message(response.data),
            'details': response.data if isinstance(response.data, dict) else None,
        }
        response.data = error_data
    else:
        logger.exception(f'Unhandled exception in {context.get("view")}', exc_info=exc)
        return Response(
            {
                'error': True,
                'message': 'An unexpected error occurred. Please try again.',
                'details': None,
            },
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )

    return response


def _get_message(data):
    if isinstance(data, dict):
        if 'detail' in data:
            return str(data['detail'])
        for key, value in data.items():
            if isinstance(value, list) and value:
                return f'{key}: {value[0]}'
            return str(value)
    if isinstance(data, list) and data:
        return str(data[0])
    return 'An error occurred.'