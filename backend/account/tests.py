from django.test import TestCase
from django.db import IntegrityError
from .models import Account
from .serializers import AccountSerializer

class AccountModelTests(TestCase):
    def test_create_standard_user(self):
        """Test basic user creation and default field values."""
        user = Account.objects.create_user(
            email='test@slc-sflu.edu.ph',
            password='password123',
            first_name='Test',
            last_name='User',
            contact_number='09123456789'
        )
        
        self.assertEqual(user.email, 'test@slc-sflu.edu.ph')
        self.assertEqual(user.username, 'test@slc-sflu.edu.ph')  # Should fallback to email
        self.assertEqual(user.role, 'moderator')  # Default role
        self.assertFalse(user.is_archived)
        self.assertFalse(user.must_change_password)
        self.assertEqual(user.contact_number, '09123456789')
        self.assertTrue(user.check_password('password123'))

    def test_superuser_forces_admin_role(self):
        """Test that creating a superuser automatically enforces the admin role."""
        admin_user = Account.objects.create_superuser(
            email='admin@slc-sflu.edu.ph',
            password='superpassword'
        )
        self.assertEqual(admin_user.role, 'admin')
        self.assertTrue(admin_user.is_admin)

    def test_role_properties(self):
        """Test the is_admin and is_moderator properties."""
        admin = Account(role='admin')
        mod = Account(role='moderator')
        
        self.assertTrue(admin.is_admin)
        self.assertFalse(admin.is_moderator)
        
        self.assertTrue(mod.is_moderator)
        self.assertFalse(mod.is_admin)

    def test_unique_email_constraint(self):
        """Test that identical emails raise an IntegrityError."""
        Account.objects.create_user(email='duplicate@slc-sflu.edu.ph', password='pwd')
        with self.assertRaises(IntegrityError):
            Account.objects.create_user(email='duplicate@slc-sflu.edu.ph', password='pwd2')

    def test_string_representation(self):
        """Test the __str__ method of the model."""
        user = Account.objects.create_user(email='strtest@slc-sflu.edu.ph', password='pwd')
        self.assertEqual(str(user), 'strtest@slc-sflu.edu.ph - Moderator')


class AccountSerializerTests(TestCase):
    def test_serializer_create_hashes_password(self):
        """Test that the serializer properly hashes the password on creation."""
        data = {
            'email': 'serializertest@slc-sflu.edu.ph',
            'password': 'secretpassword',
            'first_name': 'Jane',
            'last_name': 'Doe'
        }
        serializer = AccountSerializer(data=data)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        
        user = serializer.save()
        
        self.assertNotEqual(user.password, 'secretpassword')
        self.assertTrue(user.check_password('secretpassword'))
        self.assertEqual(user.username, 'serializertest@slc-sflu.edu.ph')

    def test_serializer_update_syncs_username(self):
        """Test that updating the email through the serializer also updates the username."""
        user = Account.objects.create_user(email='old@slc-sflu.edu.ph', password='pwd')
        
        data = {'email': 'new@slc-sflu.edu.ph'}
        serializer = AccountSerializer(user, data=data, partial=True)
        self.assertTrue(serializer.is_valid(), serializer.errors)
        
        updated_user = serializer.save()
        
        self.assertEqual(updated_user.email, 'new@slc-sflu.edu.ph')
        self.assertEqual(updated_user.username, 'new@slc-sflu.edu.ph')