from django.urls import path
from .views import GetRouter

urlpatterns = [
    path('api/get-route/', GetRouter.as_view(), name='get_router'),
]