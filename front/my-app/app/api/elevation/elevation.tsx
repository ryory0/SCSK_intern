import { NextApiRequest, NextApiResponse } from 'next';
import fetch from 'node-fetch';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { locations } = req.body;

  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
  const url = `https://maps.googleapis.com/maps/api/elevation/json?locations=${locations}&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === "OK") {
      res.status(200).json(data);
    } else {
      res.status(400).json({ error: 'Failed to fetch elevation data' });
    }
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
}
