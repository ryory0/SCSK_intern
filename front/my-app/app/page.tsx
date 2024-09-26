"use client";
import { Box, Button, Text, Input } from "@chakra-ui/react";
import { useState, useRef } from "react";

export default function Home() {
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [error, setError] = useState("");
  const mapRef = useRef(null); // 地図を表示するためのDOM要素を参照
  const [map, setMap] = useState(null);
  const [directionsRenderer, setDirectionsRenderer] = useState(null);
  const [directionsService, setDirectionsService] = useState(null);

  // Google Maps APIの読み込み確認関数
  const loadGoogleMapsScript = (callback: () => void) => {
    if (typeof window.google === "object" && typeof window.google.maps === "object") {
      callback();
    } else {
      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=YOUR_GOOGLE_MAPS_API_KEY&libraries=places`;
      script.async = true;
      script.onload = callback;
      document.head.appendChild(script);
    }
  };

  const handleSubmit = async () => {
    if (!origin || !destination) {
      setError("出発地と目的地を入力してください");
      return;
    }

    // Google Maps APIを読み込み、地図を初期化
    loadGoogleMapsScript(() => {
		if (mapRef.current && !map) {
		  const googleMap = new window.google.maps.Map(mapRef.current, {
			center: { lat: 35.6895, lng: 139.6917 }, // 東京の中心
			zoom: 10,
		  });
		  const newDirectionsRenderer = new window.google.maps.DirectionsRenderer();
		  const newDirectionsService = new window.google.maps.DirectionsService();
	  
		  setMap(googleMap);
		  setDirectionsRenderer(newDirectionsRenderer);
		  setDirectionsService(newDirectionsService);
	  
		  // すぐにルートを描画するのではなく、サービスとレンダラーのセットが完了してから描画
		  calculateRoute(googleMap, newDirectionsRenderer, newDirectionsService);
		}
	  });
  };

  const calculateRoute = async (googleMap, directionsRenderer, directionsService) => {
	try {
	  const res = await fetch(
		`http://localhost:8000/api/get-route/?origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
	  );
	  if (!res.ok) throw new Error("経路情報の取得に失敗しました");
	  const data = await res.json();
  
	  if (directionsService && directionsRenderer && googleMap) {
		directionsRenderer.setMap(googleMap);
		const request = {
		  origin: origin,
		  destination: destination,
		  travelMode: window.google.maps.TravelMode.DRIVING,
		};
		directionsService.route(request, (result, status) => {
		  if (status === "OK") {
			directionsRenderer.setDirections(result); // ルートを地図に描画
		  } else {
			setError("経路の描画に失敗しました");
		  }
		});
	  }
	  setError("");
	} catch (err) {
	  setError(err.message);
	}
  };

  return (
    <Box p={6}>
      <Text fontSize="xl" mb={4}>
        Google Maps API 経路検索
      </Text>
      <Input
        placeholder="出発地 (例: 35.6895,139.6917)"
        value={origin}
        onChange={(e) => setOrigin(e.target.value)}
        mb={4}
      />
      <Input
        placeholder="目的地 (例: 35.6586,139.7454)"
        value={destination}
        onChange={(e) => setDestination(e.target.value)}
        mb={4}
      />
      <Button onClick={handleSubmit} colorScheme="teal" mb={4}>
        経路検索
      </Button>
      {error && <Text color="red.500">{error}</Text>}
      <Box ref={mapRef} width="100%" height="500px" mt={4}></Box> {/* 地図を表示するための要素 */}
    </Box>
  );
}
