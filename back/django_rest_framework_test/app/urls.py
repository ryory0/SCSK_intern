from django.urls import path
from .views import share_route, call_route, elevation_view, calculate_route_distances

urlpatterns = [
    # 経路を保存・共有するAPI
    path('api/share-route/', share_route, name='share-route'),

    # 経路を取得するAPI
    path('api/call-route/', call_route, name='call-route'),

    # Google Elevation APIを使用して標高データを取得するAPI
    path('api/elevation/', elevation_view, name='elevation-view'),

    # 海岸線の距離を計算するAPI
    path('api/sea_distance/', calculate_route_distances, name='calculate-route-distances'),
]
