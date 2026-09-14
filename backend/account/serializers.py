from rest_framework import serializers
from .models import Account

class AccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = Account
        fields = [
            'id',
            'username',
            'first_name',
            'last_name',
            'email',
            'contact_number',  # Added to match frontend and model
            'role',
            'password',
            'is_active',
            'is_current_admin',  # NEW — single-current-admin flag, separate from is_active
            'is_archived',
            'must_change_password',
            'created_at',      # Added to fields list so they are returned in JSON
            'updated_at',      
        ]
        extra_kwargs = {
            'password': {
                'write_only': True,
                'required': False,
                'allow_blank': True
            },
            'username': {
                'required': False,
                'allow_blank': True
            }
        }
        read_only_fields = ['id', 'created_at', 'updated_at']

    def create(self, validated_data):
        password = validated_data.pop('password', None)

        # Fallback username to email if not provided
        if not validated_data.get('username'):
            validated_data['username'] = validated_data.get('email')

        user = Account(**validated_data)

        if password:
            user.set_password(password)
        else:
            user.set_unusable_password()

        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        
        # Sync username if the email is updated by an admin
        email = validated_data.get('email', instance.email)
        if 'username' not in validated_data and email != instance.email:
            validated_data['username'] = email

        instance = super().update(instance, validated_data)

        if password:
            instance.set_password(password)
            instance.save()

        return instance


class AccountLoginSerializer(serializers.Serializer):
    # Note: Even though the frontend form says "Email Address", 
    # the React API sends it as 'username', which Django matches here.
    username = serializers.CharField(max_length=150)
    password = serializers.CharField(write_only=True)


class AccountLogoutSerializer(serializers.Serializer):
    refresh = serializers.CharField()