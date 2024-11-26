from rest_framework import serializers
from .models import Route

class RouteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Route
        fields = ['origin', 'destination', 'routes_data', 'share_uuid']