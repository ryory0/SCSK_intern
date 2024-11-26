from rest_framework.response import Response
from .models import Route
import requests
from .serializers import RouteSerializer
from django.http import JsonResponse
from rest_framework.decorators import api_view
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
import uuid
from geopy.distance import geodesic
import json

@api_view(['POST'])
def share_route(request):
    if request.method == "POST":
        print(request)
        routes_data = request.data.get('routes_data', [])  # 複数ルートを取得
        origin = request.data.get('origin')
        destination = request.data.get('destination')

        if not routes_data:
            return Response({'error': 'Routes data is required'}, status=400)

        # 複数ルートを含むデータを保存
        share_uuid = str(uuid.uuid4())
        route = Route.objects.create(
            origin=origin,
            destination=destination,
            routes_data=routes_data,  # 複数のルートを保存
            share_uuid=share_uuid
        )

        return Response({'uuid': share_uuid}, status=200)


@api_view(['GET'])
def call_route(request):
    share_uuid = request.GET.get('uuid')
    if not share_uuid:
        return Response({'error': 'UUID is required'}, status=400)

    try:
        routes = Route.objects.get(share_uuid=share_uuid)
        serializer = RouteSerializer(routes)
        print(serializer.data)
        return Response(serializer.data, status=200)
    except Route.DoesNotExist:
        return Response({'error': 'Route not found'}, status=404)

@csrf_exempt
def elevation_view(request):
    if request.method == 'POST':
        try:
            # リクエストボディのJSONデータをパース
            data = json.loads(request.body)
            locations = data.get('locations')

            # Google Elevation APIのエンドポイントとAPIキー
            api_key = settings.GOOGLE_MAPS_API_KEY
            url = f'https://maps.googleapis.com/maps/api/elevation/json?locations={locations}&key={api_key}'

            # Google APIにリクエストを送信
            response = requests.get(url)
            response_data = response.json()

            if response_data['status'] == 'OK':
                return JsonResponse(response_data)
            else:
                return JsonResponse({'error': 'Failed to fetch elevation data'}, status=400)

        except json.JSONDecodeError:
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except requests.exceptions.RequestException as e:
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=405)


@csrf_exempt
def calculate_route_distances(request):
    if request.method == 'POST':
        try:
            # リクエストボディのJSONデータをパース
            data = json.loads(request.body)
            print(f"Request data: {data}")  # リクエストデータをログに出力
            locations = data.get('locations')  # 各中継地点のリスト

            if not locations:
                return JsonResponse({'error': 'No locations provided'}, status=400)

            # 出発地点の座標を取得して海岸線データを取得
            start_lat = locations[0].get('lat')
            start_lng = locations[0].get('lng')
            if start_lat is None or start_lng is None:
                return JsonResponse({'error': 'Invalid start latitude or longitude'}, status=400)

            # 出発地点から海岸線のデータを取得する
            coastline_data = get_coastline_data(start_lat, start_lng)
            if not coastline_data:
                return JsonResponse({'error': 'Failed to fetch coastline data'}, status=500)

            # 各中継地点ごとの最短距離の合計を計算する
            total_distance = 0
            for point in locations:
                lat = point.get('lat')
                lng = point.get('lng')

                if lat is None or lng is None:
                    return JsonResponse({'error': 'Invalid latitude or longitude'}, status=400)

                # 中継地点と海岸線との最短距離を計算
                nearest_coast_distance = get_nearest_coast_distance(lat, lng, coastline_data)
                total_distance += nearest_coast_distance

            return JsonResponse({'total_distance': total_distance})

        except json.JSONDecodeError:
            print("JSON decode error")  # ログにエラー内容を表示
            return JsonResponse({'error': 'Invalid JSON'}, status=400)
        except Exception as e:
            print(f"Error occurred: {str(e)}")  # エラーメッセージを出力
            return JsonResponse({'error': str(e)}, status=500)

    return JsonResponse({'error': 'Invalid request method'}, status=405)

# Overpass API を使って出発地点周辺の海岸線データを取得する関数
def get_coastline_data(lat, lng, radius=3000):
    overpass_url = "http://overpass-api.de/api/interpreter"
    overpass_query = f"""
    [out:json];
    way["natural"="coastline"](around:{radius},{lat},{lng});
    out geom;
    """

    try:
        response = requests.post(overpass_url, data={'data': overpass_query})
        response_data = response.json()

        # 海岸線データを整形して返す
        coastline_data = []
        for element in response_data.get('elements', []):
            for geometry in element.get('geometry', []):
                coastline_data.append({'lat': geometry['lat'], 'lon': geometry['lon']})

        return coastline_data

    except requests.exceptions.RequestException as e:
        print(f"Error fetching coastline data: {str(e)}")
        return None

# 中継地点と海岸線との最短距離を計算する関数
def get_nearest_coast_distance(lat, lng, coastline_data):
    min_distance = float('inf')

    for coast_point in coastline_data:
        coast_lat = coast_point.get('lat')
        coast_lng = coast_point.get('lon')

        current_distance = geodesic((lat, lng), (coast_lat, coast_lng)).kilometers
        if current_distance < min_distance:
            min_distance = current_distance

    return min_distance
