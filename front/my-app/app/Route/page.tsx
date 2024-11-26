'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Button, Input, Text, VStack, Select } from '@chakra-ui/react';
import { GoogleMap, Polyline, useLoadScript } from '@react-google-maps/api';

// マップ全体のスタイル
const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

// ルートごとの色設定（5つの異なる色を設定）
const routeColors = ["#4285F4", "#FF0000", "#008000", "#FFA500", "#800080"]; // 5つのルート色

export default function Home() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [routes, setRoutes] = useState<any[]>([]); // 複数経路を管理
  const [polylines, setPolylines] = useState<any[]>([]); // 複数経路のポリライン
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0); // 選択されたルート
  const [originLatLng, setOriginLatLng] = useState<google.maps.LatLng | null>(null); // 出発地の緯度経度
  const [destinationLatLng, setDestinationLatLng] = useState<google.maps.LatLng | null>(null); // 目的地の緯度経度
  const [mapKey, setMapKey] = useState(0); // 地図のリフレッシュ用のキーを管理
  const [sharedLink, setSharedLink] = useState(''); // 共有リンク
  const geocoderRef = useRef<google.maps.Geocoder | null>(null); // Geocoderのリファレンス
  const mapRef = useRef<google.maps.Map | null>(null); // Google Mapのリファレンス

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY!, // Google Maps APIキー
    libraries: ['places', 'geometry'], // geometryライブラリを追加
  });

  // Google Maps APIのGeocoderを初期化
  useEffect(() => {
    if (isLoaded && !geocoderRef.current) {
      geocoderRef.current = new google.maps.Geocoder();
    }
  }, [isLoaded]);

  // ジオコーディングで住所を緯度経度に変換
  const geocodeAddress = (address: string): Promise<google.maps.LatLng | null> => {
    return new Promise((resolve, reject) => {
      if (geocoderRef.current) {
        geocoderRef.current.geocode({ address: address }, (results, status) => {
          if (status === "OK" && results[0]) {
            resolve(results[0].geometry.location);
          } else {
            reject(`ジオコーディングに失敗しました: ${status}`);
          }
        });
      } else {
        reject("Geocoderが初期化されていません");
      }
    });
  };

  // 現在地を取得してoriginを設定
  const handleGetCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const currentLocation = new google.maps.LatLng(latitude, longitude);
          setOriginLatLng(currentLocation); // 現在地を出発地に設定
          setOrigin(`${latitude},${longitude}`); // 住所入力フィールドに現在地を表示
          if (mapRef.current) {
            mapRef.current.panTo(currentLocation); // 現在地をマップの中心に移動
          }
        },
        (error) => {
          console.error('現在地を取得できませんでした: ', error);
        }
      );
    } else {
      console.error('このブラウザはGeolocation APIをサポートしていません。');
    }
  };

  const handleFetchRoute = async () => {
    if (!origin || !destination) {
      console.error('出発地と目的地を入力してください。');
      return;
    }

    try {
      // 再検索時に前のルートをクリア
      setPolylines([]); // 前のルートのポリラインをクリア
      setRoutes([]);    // 前のルート情報をクリア

      const [originCoords, destinationCoords] = await Promise.all([
        geocodeAddress(origin),
        geocodeAddress(destination),
      ]);

      if (!originCoords || !destinationCoords) {
        console.error('住所のジオコーディングに失敗しました。');
        return;
      }

      setOriginLatLng(originCoords);
      setDestinationLatLng(destinationCoords);

      const res = await fetch('/api/routes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: `${originCoords.lat()},${originCoords.lng()}`,
          destination: `${destinationCoords.lat()},${destinationCoords.lng()}`,
          computeAlternativeRoutes: true, // 代替ルートを取得
        }),
      });

      if (!res.ok) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }

      const data = await res.json();
      console.log('Route Data:', data); 

      // 最大5つのルートまで保存
      const limitedRoutes = data.routes.slice(0, 5);
      setRoutes(limitedRoutes);

      // エンコードされたポリラインをデコード
      const newPolylines = limitedRoutes.map((route: any, index: number) => {
        const decodedPath = google.maps.geometry.encoding.decodePath(route.polyline.encodedPolyline);
        return {
          key: index,
          path: decodedPath,
        };
      });

      setPolylines(newPolylines);

      // マップをリフレッシュするために一意のキーを変更
      setMapKey(prevKey => prevKey + 1); // マップを再レンダリングするためのキーをインクリメント

      if (mapRef.current && originCoords) {
        mapRef.current.panTo(originCoords); 
      }

    } catch (error) {
      console.error("Failed to fetch route:", error.message);
    }
  };

  // 共有リンクを発行する関数
  const handleGenerateShareLink = async () => {
    try {
      // 選択されたルート情報を保存するAPIに送信
      const res = await fetch('http://localhost:8000/api/share-route/', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin,
          destination,
          route_data: routes[selectedRouteIndex], // 選択されたルート情報を送信
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to save route. Status: ${res.status}`);
      }

      const data = await res.json();
      const shareLink = `${window.location.origin}/shared/${data.uuid}`; // 共有リンクを生成
      setSharedLink(shareLink);
    } catch (error) {
      console.error('Error generating share link:', error);
    }
  };

  // マップの初期座標を出発地点（originLatLng）にする
  const center = originLatLng || { lat: 35.6580, lng: 139.7016 }; // デフォルトは渋谷

  // 選択したルートの変更ハンドラ
  const handleRouteChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedRouteIndex(Number(e.target.value));
  };

  // マップのレンダリング
  const renderMap = useCallback(() => {
    return (
      <GoogleMap
        key={mapKey} // リフレッシュするために一意のキーを設定
        mapContainerStyle={mapContainerStyle}
        zoom={13}
        center={center} // 中心座標を動的に設定
        onLoad={(map) => (mapRef.current = map)} // マップのリファレンスを保存
      >
        {/* 各経路のポリラインをマップに表示 */}
        {polylines.map((polyline, index) => (
          <Polyline
            key={polyline.key} // ユニークなキーを持たせる
            path={polyline.path}
            options={{
              strokeColor: routeColors[index % routeColors.length], // 各ルートの色を設定
              strokeWeight: selectedRouteIndex === index ? 8 : 4, // 選択されたルートを太く表示
              strokeOpacity: selectedRouteIndex === index ? 1 : 0.5, // 選択されたルートを不透明に
            }}
          />
        ))}
      </GoogleMap>
    );
  }, [center, polylines, selectedRouteIndex, mapKey]); // mapKeyが変わるたびに再レンダリング

  if (!isLoaded) return <Text>Loading Maps...</Text>;

  return (
    <Box p={5}>
      <VStack spacing={4} alignItems="flex-start" textAlign="left" mt={10}>
        {/* 現在地を取得するボタン */}
        <Button colorScheme="blue" onClick={handleGetCurrentLocation}>
          現在地を取得
        </Button>
        {/* 出発地と目的地の住所を入力 */}
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

        {/* ルート選択 */}
        {routes.length > 0 && (
          <Select value={selectedRouteIndex} onChange={handleRouteChange} mb={4}>
            {routes.map((route, index) => (
              <option key={index} value={index}>
                ルート {index + 1}: 距離 - {route.distanceMeters / 1000} km, 時間 - {route.duration / 60} 分
              </option>
            ))}
          </Select>
        )}

        {/* マップの描画 */}
        {renderMap()}

        {/* 選択されたルートの詳細表示 */}
        {routes.length > 0 && (
          <Box mt={4}>
            <Text fontWeight="bold" color="gray.700">
              選択されたルート {selectedRouteIndex + 1}:
            </Text>
            <Text>Distance: {routes[selectedRouteIndex].distanceMeters} meters</Text>
            <Text>Duration: {routes[selectedRouteIndex].duration} seconds</Text>
          </Box>
        )}

        {/* 共有ボタン */}
        <Button colorScheme="green" onClick={handleGenerateShareLink}>
          共有リンクを発行
        </Button>

        {/* 共有リンクの表示 */}
        {sharedLink && (
          <Text mt={4}>
            共有リンク: <a href={sharedLink}>{sharedLink}</a>
          </Text>
        )}
      </VStack>
    </Box>
  );
}
