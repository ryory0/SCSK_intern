from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework import status, viewsets, filters
import requests
from django.conf import settings
from .models import Daily

class GetRouter(APIView):
    def get(self, request):
        origin = request.GET.get('origin')
        destination = request.GET.get('destination')

        if not origin or not destination:
            return Response({'error': 'Both origin and destination are required.'}, status=status.HTTP_400_BAD_REQUEST)

        # Google Maps API リクエストパラメータ
        api_key = settings.GOOGLE_MAPS_API_KEY
        url = 'https://maps.googleapis.com/maps/api/directions/json'

        params = {
            'origin': origin,
            'destination': destination,
            'key': api_key
        }

        response = requests.get(url, params=params)

        # レスポンスが成功したかを確認
        if response.status_code == 200:
            data = response.json()
            return Response(data, status=status.HTTP_200_OK)
        else:
            return Response({'error': 'Failed to fetch route information.'}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)




class ListDaily(APIView):
    def get(self, request):
        try:
            daily = Daily.objects.filter(isOpen=True).order_by('-date')
            res_list = [
                {
                    'id': d.id,
                    'date': d.date,
                    'evaluation': d.evaluation.evaluation,
                }
                for d in daily
            ]
            return Response(res_list)
        except:
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class DetailDaily(APIView):
    def get(self, request, pk):
        try:
            try:
                daily = Daily.objects.get(id=pk)
            except:
                error_msg = "そんなidの日報はないよ！"
                return Response(error_msg, status=status.HTTP_404_NOT_FOUND)
            res = {
                'id': daily.id,
                'date': daily.date,
                'study': daily.study,
                'other': daily.other,
                'first_meet': daily.first_meet,
                'wanna_do': daily.wanna_do,
                'summary': daily.summary,
            }
            return Response(res)
        except:
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)


class CategoryDairy(APIView):
    def get(self, request, cat):
        try:
            daily = Daily.objects.filter(isOpen=True).values_list(
                'date', cat).order_by('-date')

            res_list = [
                {
                    'date': d[0],
                    'content': d[1],
                }
                for d in daily
            ]

            return Response(res_list) 
        except:
            return Response(status=status.HTTP_500_INTERNAL_SERVER_ERROR)