import logging
from rest_framework import status, generics
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.exceptions import ValidationError
from rest_framework_simplejwt.tokens import RefreshToken
from rest_framework_simplejwt.exceptions import TokenError
from rest_framework_simplejwt.token_blacklist.models import BlacklistedToken, OutstandingToken

from .models import User, UserRole
from .serializers import (
    UserSerializer, LoginSerializer, CreateUserSerializer, SetPasswordSerializer, other_active_admins,
)
from common.permissions.roles import IsAdmin

logger = logging.getLogger(__name__)


def revoke_refresh_tokens(user: User) -> int:
    revoked = 0
    for token in OutstandingToken.objects.filter(user=user):
        _, created = BlacklistedToken.objects.get_or_create(token=token)
        revoked += created
    return revoked


def _link_opportunities(user: User) -> None:
    from apps.pulse.services import pulse_service

    linked = pulse_service.link_unassigned_opportunities(user)
    if linked:
        logger.info('Linked %s unassigned opportunities to user %s', linked, user.email)


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = LoginSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)

        logger.info(f'User logged in: {user.email}')

        return Response({
            'access': str(refresh.access_token),
            'refresh': str(refresh),
            'user': UserSerializer(user).data,
        }, status=status.HTTP_200_OK)


class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        refresh_token = request.data.get('refresh')
        if not refresh_token:
            return Response(
                {'detail': 'Refresh token is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            token = RefreshToken(refresh_token)
            token.blacklist()
            logger.info(f'User logged out: {request.user.email}')
            return Response({'detail': 'Successfully logged out.'}, status=status.HTTP_200_OK)
        except TokenError:
            return Response(
                {'detail': 'Invalid or expired token.'},
                status=status.HTTP_400_BAD_REQUEST
            )


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user).data)


class UserListCreateView(generics.ListCreateAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_queryset(self):
        queryset = User.objects.order_by('name')
        user_status = (self.request.query_params.get('status') or 'all').lower()
        if user_status == 'active':
            return queryset.filter(is_active=True)
        if user_status == 'inactive':
            return queryset.filter(is_active=False)
        return queryset

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return CreateUserSerializer
        return UserSerializer

    def perform_create(self, serializer):
        user = serializer.save()
        logger.info(f'User created: {user.email} by {self.request.user.email}')
        _link_opportunities(user)


class UserDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated, IsAdmin]

    def perform_update(self, serializer):
        before = serializer.instance
        previous_name, previous_active = before.name, before.is_active
        user = serializer.save()
        logger.info(f'User updated: {user.email} by {self.request.user.email}')
        if previous_active and not user.is_active:
            revoke_refresh_tokens(user)
        if user.is_active and (user.name != previous_name or not previous_active):
            _link_opportunities(user)

    def destroy(self, request, *args, **kwargs):
        user = self.get_object()
        if user.pk == request.user.pk:
            raise ValidationError({'detail': 'You cannot deactivate your own account.'})
        if user.role == UserRole.ADMIN and user.is_active and not other_active_admins(user).exists():
            raise ValidationError({'detail': 'This is the last active Admin. Make another user Admin first.'})
        user.is_active = False
        user.save()
        revoke_refresh_tokens(user)
        logger.info(f'User deactivated: {user.email} by {request.user.email}')
        return Response({'detail': 'User deactivated.'}, status=status.HTTP_200_OK)


class UserSetPasswordView(APIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def post(self, request, pk):
        user = generics.get_object_or_404(User, pk=pk)
        serializer = SetPasswordSerializer(data=request.data, context={'user': user})
        serializer.is_valid(raise_exception=True)
        user.set_password(serializer.validated_data['new_password'])
        user.save(update_fields=['password', 'updated_at'])
        revoked = revoke_refresh_tokens(user)
        logger.info(f'Password reset for {user.email} by {request.user.email} (revoked {revoked} sessions)')
        return Response({'detail': 'Password updated. The user must sign in again.'})
