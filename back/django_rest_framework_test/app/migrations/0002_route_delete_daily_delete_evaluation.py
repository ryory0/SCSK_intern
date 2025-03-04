# Generated by Django 4.2.13 on 2024-09-30 08:00

from django.db import migrations, models
import uuid


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Route',
            fields=[
                ('origin', models.CharField(max_length=255)),
                ('destination', models.CharField(max_length=255)),
                ('route_data', models.JSONField()),
                ('share_uuid', models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False, unique=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
        ),
        migrations.DeleteModel(
            name='Daily',
        ),
        migrations.DeleteModel(
            name='Evaluation',
        ),
    ]
