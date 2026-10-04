from rest_framework import serializers
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import User, UserRole


def _check_password(password: str, user: User | None = None) -> str:
    try:
        validate_password(password, user=user)
    except DjangoValidationError as exc:
        raise serializers.ValidationError(list(exc.messages))
    return password


def other_active_admins(user: User):
    return User.objects.filter(role=UserRole.ADMIN, is_active=True).exclude(pk=user.pk)


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'role', 'is_active', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']

    def validate(self, data):
        instance = self.instance
        if instance is None or instance.role != UserRole.ADMIN or not instance.is_active:
            return data
        losing_admin = data.get('role', instance.role) != UserRole.ADMIN
        deactivating = data.get('is_active', instance.is_active) is False
        if not (losing_admin or deactivating):
            return data
        request = self.context.get('request')
        if request is not None and request.user.pk == instance.pk:
            if losing_admin:
                raise serializers.ValidationError({'role': 'You cannot remove your own Admin role.'})
            raise serializers.ValidationError({'is_active': 'You cannot deactivate your own account.'})
        if not other_active_admins(instance).exists():
            field = 'role' if losing_admin else 'is_active'
            raise serializers.ValidationError({field: 'This is the last active Admin. Make another user Admin first.'})
        return data


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        email = data.get('email')
        password = data.get('password')

        user = authenticate(username=email, password=password)

        if not user:
            raise serializers.ValidationError('Invalid email or password.')

        if not user.is_active:
            raise serializers.ValidationError('This account has been deactivated.')

        data['user'] = user
        return data


class CreateUserSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)

    class Meta:
        model = User
        fields = ['id', 'name', 'email', 'password', 'role']
        read_only_fields = ['id']

    def validate(self, data):
        candidate = User(email=data.get('email', ''), name=data.get('name', ''))
        try:
            _check_password(data['password'], candidate)
        except serializers.ValidationError as exc:
            raise serializers.ValidationError({'password': exc.detail})
        return data

    def create(self, validated_data):
        password = validated_data.pop('password')
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        return user


class SetPasswordSerializer(serializers.Serializer):
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_new_password(self, value):
        return _check_password(value, self.context.get('user'))


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, min_length=8)

    def validate_current_password(self, value):
        user = self.context['request'].user
        if not user.check_password(value):
            raise serializers.ValidationError('Current password is incorrect.')
        return value
