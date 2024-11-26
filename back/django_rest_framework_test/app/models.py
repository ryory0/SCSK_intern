from django.db import models
import uuid

class Route(models.Model):
    origin = models.CharField(max_length=255)
    destination = models.CharField(max_length=255)
    routes_data = models.JSONField()
    share_uuid = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Route from {self.origin} to {self.destination} ({self.share_uuid})"
