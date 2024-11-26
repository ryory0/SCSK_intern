import { NextResponse } from 'next/server';
import axios from 'axios';

const GRAPHHOPPER_API_KEY = process.env.NEXT_PUBLIC_GRAPHHOPPER_API_KEY;

export async function POST(req: Request) {
  try {
    const { origin, destination } = await req.json();

    // OriginとDestinationをパース
    const originLat = parseFloat(origin.split(",")[0]);
    const originLng = parseFloat(origin.split(",")[1]);
    const destinationLat = parseFloat(destination.split(",")[0]);
    const destinationLng = parseFloat(destination.split(",")[1]);

    // GraphHopper APIのエンドポイント
    const url = `https://graphhopper.com/api/1/route`;

    // GraphHopper APIリクエスト用のパラメータ
    const params = {
      point: [
        `${originLat},${originLng}`, // 出発地
        `${destinationLat},${destinationLng}`, // 目的地
      ],
      vehicle: "foot", // 移動手段 (例: "foot", "bike", "car")
      locale: "en", // 言語設定
      points_encoded: true, // エンコードされたポリラインを取得
      key: GRAPHHOPPER_API_KEY, // APIキー
    };

    // GraphHopper APIへのリクエスト
    const response = await axios.get(url, {
      params: {
        ...params,
      },
      paramsSerializer: (params) => {
        // `point`パラメータを正しくクエリ文字列化
        return Object.entries(params)
          .map(([key, value]) =>
            Array.isArray(value)
              ? value.map((v) => `${key}=${encodeURIComponent(v)}`).join("&")
              : `${key}=${encodeURIComponent(value)}`
          )
          .join("&");
      },
    });

    if (!response.data || !response.data.paths) {
      throw new Error('No route data received from GraphHopper.');
    }

    // APIから返された経路データを整形
    const routes = response.data.paths.map((path: any) => ({
      distance: path.distance, // 距離（メートル単位）
      duration: path.time, // 時間（ミリ秒単位）
      polyline: path.points, // エンコードされたポリライン
    }));

    return NextResponse.json({ routes });
  } catch (error: any) {
    console.error("Error fetching routes from GraphHopper:", error.response?.data || error.message);
    return NextResponse.json({ error: "Failed to fetch routes from GraphHopper." }, { status: 500 });
  }
}
