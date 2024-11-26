'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { GoogleMap, Polyline, useLoadScript } from '@react-google-maps/api';
import { Box, Text, Spinner, Button } from '@chakra-ui/react';

interface RouteData {
  origin: string;
  destination: string;
  routes_data: any[];  // 複数のルートを保存
}

const mapContainerStyle = {
  width: '100%',
  height: '600px',
};

const routeColors = ["#4285F4", "#FF0000", "#008000", "#FFA500", "#800080"];

const SharedRoutePage = ({ params }: { params: { uuid: string } }) => {
  const router = useRouter();
  const { uuid } = params;
  const [routeData, setRouteData] = useState<RouteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [polylines, setPolylines] = useState<any[]>([]); // 複数ルートのポリライン

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_API_KEY!,
    libraries: ['places', 'geometry'],
  });

  useEffect(() => {
    if (!uuid) return;

    const fetchRouteData = async () => {
      try {
        const res = await fetch(`http://localhost:8000/api/call-route/?uuid=${uuid}`);
        if (!res.ok) {
          throw new Error(`Failed to fetch route data. Status: ${res.status}`);
        }

        const data = await res.json();
        setRouteData(data);

        // 複数ルートのポリラインを設定
        const newPolylines = data.routes_data.map((route: any, index: number) => {
          const decodedPath = google.maps.geometry.encoding.decodePath(route.routes[0].polyline.encodedPolyline);
          return {
            key: index,
            path: decodedPath,
          };
        });
        setPolylines(newPolylines);

        setLoading(false);
      } catch (error: any) {
        setError(error.message);
        setLoading(false);
      }
    };

    fetchRouteData();
  }, [uuid]);

  if (loading) {
    return (
      <Box>
        <Spinner size="xl" />
        <Text>Loading route data...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box>
        <Text color="red.500">Error: {error}</Text>
        <Button onClick={() => router.push('/')}>Go back</Button>
      </Box>
    );
  }

  return (
    <Box p={5} pt={20}> {/* マージンを20に設定して地図を下にずらす */}
      {isLoaded && (
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          zoom={13}
          center={polylines[0]?.path[0] || { lat: 35.6580, lng: 139.7016 }} // 最初の地点を中央に
        >
          {polylines.map((polyline, index) => (
            <Polyline
              key={polyline.key}
              path={polyline.path}
              options={{
                strokeColor: routeColors[index % routeColors.length],
                strokeOpacity: 1,
                strokeWeight: 4,
              }}
            />
          ))}
        </GoogleMap>
      )}
      <Button mt={4} onClick={() => router.push('/')}>Go back</Button>
    </Box>
  );
};

export default SharedRoutePage;
