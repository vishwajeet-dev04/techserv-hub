from rest_framework.permissions import BasePermission
from apps.users.models import UserRole


class IsAdmin(BasePermission):
    message = 'Admin role required.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role == UserRole.ADMIN
        )


class IsManagementOrAbove(BasePermission):
    message = 'Management role or above required.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in [UserRole.ADMIN, UserRole.MANAGEMENT]
        )


class IsFinanceOrAbove(BasePermission):
    message = 'Finance role or above required.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in [UserRole.ADMIN, UserRole.FINANCE]
        )


class IsSalesOrAbove(BasePermission):
    message = 'Sales role or above required.'

    def has_permission(self, request, view):
        return bool(
            request.user
            and request.user.is_authenticated
            and request.user.role in [UserRole.ADMIN, UserRole.MANAGEMENT, UserRole.SALES]
        )


class IsOwnerOrAdmin(BasePermission):
    message = 'You do not have permission to access this resource.'

    def has_object_permission(self, request, view, obj):
        if request.user.role == UserRole.ADMIN:
            return True
        owner_id = getattr(obj, 'owner_id', None)
        return owner_id == request.user.id