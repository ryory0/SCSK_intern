# Generated by Django 4.2.13 on 2024-09-30 12:29

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('app', '0002_route_delete_daily_delete_evaluation'),
    ]

    operations = [
        migrations.RenameField(
            model_name='route',
            old_name='route_data',
            new_name='routes_data',
        ),
    ]