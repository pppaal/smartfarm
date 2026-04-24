import { Router } from 'express';
import { db } from '../db/index.js';
import { requireAuth } from '../services/auth.js';
import { getForecast, getVillageForecast } from '../services/weather.js';

// 충청권 주요 지역 좌표 (동네예보 기준)
const CITY_COORDS = {
  '논산': { lat: 36.1872, lon: 127.0988 },
  '부여': { lat: 36.2757, lon: 126.9098 },
  '공주': { lat: 36.4467, lon: 127.1190 },
  '청주': { lat: 36.6424, lon: 127.4890 },
  '보은': { lat: 36.4894, lon: 127.7294 },
  '대전': { lat: 36.3504, lon: 127.3845 },
  '천안': { lat: 36.8151, lon: 127.1139 },
};

function guessCoords(location) {
  if (!location) return { lat: 36.1872, lon: 127.0988 }; // 기본: 논산
  for (const [key, coord] of Object.entries(CITY_COORDS)) {
    if (location.includes(key)) return coord;
  }
  return { lat: 36.1872, lon: 127.0988 };
}

const router = Router();
router.use(requireAuth);

router.get('/greenhouse/:id', async (req, res) => {
  const gh = db.prepare('SELECT * FROM greenhouses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!gh) return res.status(404).json({ error: 'not found' });
  const { lat, lon } = guessCoords(gh.location);
  const forecast = await getForecast({ lat, lon });
  res.json({ location: gh.location, lat, lon, ...forecast });
});

router.get('/greenhouse/:id/3day', async (req, res) => {
  const gh = db.prepare('SELECT * FROM greenhouses WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!gh) return res.status(404).json({ error: 'not found' });
  const { lat, lon } = guessCoords(gh.location);
  const forecast = await getVillageForecast({ lat, lon });
  res.json({ location: gh.location, ...forecast });
});

export default router;
