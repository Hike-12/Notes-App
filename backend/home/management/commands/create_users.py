from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

class Command(BaseCommand):
    help = 'Create initial users for the application'

    def handle(self, *args, **options):
        self.stdout.write('🚀 Creating initial users...')
        
        # Create Admin User
        if not User.objects.filter(username='admin').exists():
            admin = User.objects.create_superuser(
                username='admin',
                email='admin@scribe.com',
                password='admin123',
                first_name='Admin',
                last_name='User'
            )
            self.stdout.write(
                self.style.SUCCESS(f'✅ Admin user created: {admin.username}')
            )
        else:
            self.stdout.write(
                self.style.WARNING('⚠️ Admin user already exists')
            )

        # Create Hike Hallow
        if not User.objects.filter(username='Hike').exists():
            hike = User.objects.create_user(
                username='Hike',
                email='hikehallow@gmail.com',
                password='1234',
                first_name='Hike',
                last_name='Hallow'
            )
            self.stdout.write(
                self.style.SUCCESS(f'✅ User created: {hike.username}')
            )
        else:
            self.stdout.write(
                self.style.WARNING('⚠️ User Hike already exists')
            )

        # Create Aliqyaan Mahimwala
        if not User.objects.filter(username='Aliqyaan').exists():
            aliqyaan = User.objects.create_user(
                username='Aliqyaan',
                email='aliqyaan12@gmail.com',
                password='1234',
                first_name='Aliqyaan',
                last_name='Mahimwala'
            )
            self.stdout.write(
                self.style.SUCCESS(f'✅ User created: {aliqyaan.username}')
            )
        else:
            self.stdout.write(
                self.style.WARNING('⚠️ User Aliqyaan already exists')
            )

        self.stdout.write(
            self.style.SUCCESS('\n🎉 All users setup complete!')
        )
        self.stdout.write('📋 Login credentials:')
        self.stdout.write('   👑 Admin: admin / admin123')
        self.stdout.write('   🏔️  Hike: Hike / 1234')
        self.stdout.write('   🌟 Aliqyaan: Aliqyaan / 1234')