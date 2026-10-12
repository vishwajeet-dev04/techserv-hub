from apps.finance.workspace import activate_workspace, reset_workspace, workspace_from_request


class FinanceWorkspaceMiddleware:
    """Bind finance querysets to the workspace headers for this request."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if not request.path.startswith('/api/v1/finance'):
            return self.get_response(request)
        company, region = workspace_from_request(request)
        token = activate_workspace(company, region)
        if request.method == 'GET':
            from apps.finance.status import refresh_auto_statuses

            refresh_auto_statuses((company, region))
        try:
            return self.get_response(request)
        finally:
            reset_workspace(token)
