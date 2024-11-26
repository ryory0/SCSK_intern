'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Button, Input, Text, VStack, Select, Badge, useToast } from '@chakra-ui/react';
import { GoogleMap, Polyline, useLoadScript } from '@react-google-maps/api';
import polyline from 'polyline';

// マップ全体のスタイル
const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

// ルートごとの色設定
const routeColors = ["#34D399", "#60A5FA", "#FBBF24", "#F87171", "#A78BFA"];

// 重みを設定（標高と海距離の重要度）
const elevationWeight = 0.7; // 標高の重み
const seaDistanceWeight = 0.3; // 海からの距離の重み
const riverDistanceWeight = 0.3

// ポリラインから中継地点を計算する関数
const calculateIntermediatePoints = (path: google.maps.LatLng[], numberOfPoints: number): google.maps.LatLng[] => {
  const intermediatePoints = [];
  const totalPoints = path.length;

  for (let i = 1; i <= numberOfPoints; i++) {
    const index = Math.floor((i / (numberOfPoints + 1)) * totalPoints); // 全体の長さに基づいてポイントを計算
    intermediatePoints.push(path[index]);
  }

  return intermediatePoints;
};

// Elevation API を呼び出して標高データを取得する関数 (Django API エンドポイントを呼び出す)
const fetchElevation = async (latLngs: google.maps.LatLng[]): Promise<number[]> => {
  const locations = latLngs.map(latLng => `${latLng.lat()},${latLng.lng()}`).join('|');

  const res = await fetch('http://localhost:8000/api/elevation/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locations }),  // 位置情報を JSON で送信
  });

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const data = await res.json();
  console.log('Elevation API Response:', data);

  if (data.status === "OK") {
    return data.results.map((result: any) => result.elevation);
  } else {
    console.error('Error fetching elevation data:', data);
    return [];
  }
};

// 海岸線の距離を計算する関数 (Django API エンドポイントを呼び出す)
const fetchSeaDistance = async (intermediatePoints: google.maps.LatLng[]): Promise<number> => {
  const locations = intermediatePoints.map(latLng => ({ lat: latLng.lat(), lng: latLng.lng() }));

  const res = await fetch('http://localhost:8000/api/sea_distance/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ locations }),
  });

  if (!res.ok) {
    throw new Error(`HTTP error! status: ${res.status}`);
  }

  const data = await res.json();
  console.log('Sea Distance API Response:', data);

  return data.total_distance;
};

// Duration parsing function to convert "165s" to minutes (2.75)
const parseDuration = (duration: string): number => {
  const seconds = parseInt(duration.replace('s', ''), 10); // Remove 's' and parse to integer
  return seconds / 60; // Convert to minutes
};

//Geocode APIを使って緯度経度を住所に変換
const reverseGeocode = async (lat: number, lng: number) => {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY!;
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === "OK") {
      return data.results[0]?.formatted_address || "";
    } else {
      console.error("Reverse geocoding failed:", data);
      return "";
    }
  } catch (error) {
    console.error("Error fetching geocode data:", error);
    return "";
  }
};

export default function Home() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [routes, setRoutes] = useState<any[]>([]);
  const [polylines, setPolylines] = useState<any[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [originLatLng, setOriginLatLng] = useState<google.maps.LatLng | null>(null);
  const [destinationLatLng, setDestinationLatLng] = useState<google.maps.LatLng | null>(null);
  const [mapKey, setMapKey] = useState(0);
  const [routeScores, setRouteScores] = useState<number[]>([]);
  const [seaDistances, setSeaDistances] = useState<number[]>([]); // ルートごとの海からの距離を保存
  const [recommendedRouteIndex, setRecommendedRouteIndex] = useState(0); // 推奨ルートのインデックス
  const geocoderRef = useRef<google.maps.Geocoder | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const [sharedLink, setSharedLink] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast(); // Chakra UIのトーストを使用

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY!,
    libraries: ['places', 'geometry'],
  });

  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
  }, [isLoaded]);

  const geocodeAddress = (address: string): Promise<google.maps.LatLng | null> => {
    return new Promise((resolve, reject) => {
      if (geocoderRef.current) {
        geocoderRef.current.geocode({ address: address }, (results, status) => {
          if (status === "OK" && results[0]) {
            resolve(results[0].geometry.location);
          } else {
            reject(`Geocoding failed: ${status}`);
          }
        });
      } else {
        reject("Geocoder not initialized");
      }
    });
  };

  const resetStateForNewSearch = () => {
    setOrigin('');
    setDestination('');
    setRoutes([]);
    setPolylines([]);
    setMapKey(prevKey => prevKey + 1);
    setRouteScores([]);
    setSeaDistances([]);
    setRecommendedRouteIndex(0); // 推奨ルートもリセット
    setSharedLink('');
    setError(null);
  };

  const handleGenerateShareLink = async () => {
    try {
      setLoading(true);
      const res = await fetch('http://localhost:8000/api/share-route/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin,
          destination,
          routes_data: routes,
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save route. Status: ${res.status}`);
      }

      const data = await res.json();
      const shareLink = `${window.location.origin}/shared/${data.uuid}`;
      setSharedLink(shareLink);
      setLoading(false);
    } catch (error) {
      console.error('Error generating share link:', error);
      setError('共有リンクの生成に失敗しました。');
      setLoading(false);
    }
  };
  // api/routesを呼び出して経路探索
  const handleFetchRoute = async () => {
    if (!origin || !destination) {
      console.error("Please input both origin and destination.");
      return;
    }
  
    try {
      resetStateForNewSearch();
  
      const [originCoords, destinationCoords] = await Promise.all([
        geocodeAddress(origin),
        geocodeAddress(destination),
      ]);
  
      if (!originCoords || !destinationCoords) {
        console.error("Failed to geocode the addresses.");
        return;
      }
  
      setOriginLatLng(originCoords);
      setDestinationLatLng(destinationCoords);
  
      const res = await fetch("/api/routes", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          origin: `${originCoords.lat()},${originCoords.lng()}`,
          destination: `${destinationCoords.lat()},${destinationCoords.lng()}`,
        }),
      });
  
      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
  
      const data = await res.json();
      if (!data.routes || data.routes.length === 0) {
        console.error("No routes found.");
        return;
      }
  
      const decodePolyline = (encoded: string) =>
        polyline.decode(encoded).map(([lat, lng]) => ({ lat, lng }));
  
      const newPolylines = data.routes.map((route: any, index: number) => {
        const decodedPath = decodePolyline(route.polyline);
        return { key: index, path: decodedPath };
      });
  
      setPolylines(newPolylines);
      setRoutes(data.routes); // 取得したルート全体を保存

      // 各ルートの標高と海からの距離を取得
      const routeElevationPromises = newPolylines.map(async (polyline) => {
        const intermediatePoints = calculateIntermediatePoints(polyline.path, 3);
        const elevations = await fetchElevation(intermediatePoints);
        const seaDistance = await fetchSeaDistance(intermediatePoints);
        return {
          elevationSum: elevations.reduce((sum, elevation) => sum + elevation, 0),
          seaDistanceSum: seaDistance,
        };
      });

      const scores = await Promise.all(routeElevationPromises);
      setRouteScores(scores.map(score => score.elevationSum));
      setSeaDistances(scores.map(score => score.seaDistanceSum));

      // 各ルートのスコアを計算して、推奨ルートを選定
      const weightedScores = scores.map((score, index) =>
        (score.elevationSum * elevationWeight) + (score.seaDistanceSum * seaDistanceWeight)
      );
      const bestRouteIndex = weightedScores.indexOf(Math.max(...weightedScores)); // 最大スコアのルートを推奨ルートに設定
      setRecommendedRouteIndex(bestRouteIndex);

    } catch (error: any) {
      console.error("Failed to fetch route:", error.message);
    }
  };

  // 現在地を取得して出発地に設定する関数
  const handleSetCurrentLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(async (position) => {
        const { latitude, longitude } = position.coords;
        const address = await reverseGeocode(latitude, longitude);
        if (address) {
          setOrigin(address);
          toast({
            title: "現在地を取得しました。",
            description: address,
            status: "success",
            duration: 5000,
            isClosable: true,
          });
        } else {
          toast({
            title: "エラー",
            description: "現在地の住所を取得できませんでした。",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      }, (error) => {
        toast({
          title: "エラー",
          description: "現在地を取得できませんでした。",
          status: "error",
          duration: 5000,
          isClosable: true,
        });
      });
    } else {
      toast({
        title: "エラー",
        description: "ブラウザが位置情報をサポートしていません。",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
    }
  };

  const renderMap = useCallback(() => {
    return (
      <GoogleMap
        key={mapKey}
        mapContainerStyle={mapContainerStyle}
        zoom={13}
        center={originLatLng || { lat: 35.6580, lng: 139.7016 }}
        onLoad={(map) => (mapRef.current = map)}
      >
        {polylines.map((polyline, index) => (
          <Polyline
            key={polyline.key}
            path={polyline.path}
            options={{
              strokeColor: routeColors[index % routeColors.length],
              strokeWeight: selectedRouteIndex === index ? 8 : 4,
              strokeOpacity: selectedRouteIndex === index ? 1 : 0.5,
            }}
          />
        ))}
      </GoogleMap>
    );
  }, [originLatLng, polylines, selectedRouteIndex, mapKey]);

  if (!isLoaded) return <Text>Loading Maps...</Text>;

  return (
    <Box p={5}>
      <VStack spacing={4} alignItems="flex-start" textAlign="left" mt={10}>
      <Button colorScheme="blue" onClick={handleSetCurrentLocation}>
          現在地を使用
      </Button>
        <Input
          placeholder="出発地の住所を入力"
          value={origin}
          onChange={(e) => setOrigin(e.target.value)}
        />

        <Input
          placeholder="目的地の住所を入力"
          value={destination}
          onChange={(e) => setDestination(e.target.value)}
        />
        <Button colorScheme="teal" onClick={handleFetchRoute}>
          経路を検索
        </Button>

        {renderMap()}

        {routes.length > 0 && (
          <>
            <Text fontWeight="bold" color="white.700">最も安全なルート (推奨):</Text>
            <Badge colorScheme="green" p={2} borderRadius="md">
              ★ 推奨ルート {`(ルート ${recommendedRouteIndex + 1})`} : {(routes[recommendedRouteIndex].routes[0].distanceMeters / 1000).toFixed(2)} km, 時間: {parseDuration(routes[recommendedRouteIndex].routes[0].duration).toFixed(2)} 分
            </Badge>

            <Text fontWeight="bold" color="white.700" mt={4}>他のルート:</Text>
            <Select value={selectedRouteIndex} onChange={(e) => setSelectedRouteIndex(Number(e.target.value))} mb={4}>
              {routes.map((route, index) => (
                <option key={index} value={index}>
                  {index === recommendedRouteIndex ? `★ 推奨ルート (ルート ${index + 1})` : `ルート ${index + 1}`} : 距離 - {(route.routes[0].distanceMeters / 1000).toFixed(2)} km, 時間 - {parseDuration(route.routes[0].duration).toFixed(2)} 分
                </option>
              ))}
            </Select>
          </>
        )}

        <Button colorScheme="green" onClick={handleGenerateShareLink} isLoading={loading}>
          共有リンクを発行
        </Button>

        {sharedLink && (
          <Text mt={4}>
            共有リンク: <a href={sharedLink} target="_blank" rel="noopener noreferrer">{sharedLink}</a>
          </Text>
        )}

        {error && <Text color="red.500" mt={4}>{error}</Text>}
      </VStack>
    </Box>
  );
}
