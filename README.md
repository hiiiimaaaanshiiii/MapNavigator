# Map Navigator — Minor Project

A responsive map navigation web app with a FastAPI backend.

## Features
- Search locations using OpenStreetMap Nominatim
- Interactive Leaflet map with OpenStreetMap tiles
- Browser geolocation (permission required)
- Route calculation and route geometry using OSRM
- Route distance, estimated duration and step instructions
- FastAPI REST API with interactive Swagger docs
- Health check endpoint for deployment monitoring

## Architecture
- `frontend/`: React + Vite + Leaflet
- `backend/`: FastAPI + HTTPX
- Map tiles/geocoding: OpenStreetMap
- Routing: OSRM public demo server

## Run locally

### 1. Start the API
```bash
cd backend
python -m venv .venv
# macOS/Linux:
source .venv/bin/activate
# Windows:
# .venv\\Scripts\\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
API docs: http://localhost:8000/docs

### 2. Start the frontend
In a second terminal:
```bash
cd frontend
npm install
npm run dev
```
Open the Vite URL shown in the terminal (usually http://localhost:5173).

For a deployed API, create `frontend/.env`:
```env
VITE_API_URL=https://YOUR-API.onrender.com
```
Then rebuild the frontend.

## API endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/geocode?q=India%20Gate` | Search places |
| POST | `/api/route` | Get route geometry, distance, duration and steps |
| GET | `/api/reverse-geocode?lat=28.6&lon=77.2` | Coordinates to address |
| GET | `/docs` | Swagger API documentation |

Example route request:
```json
{
  "origin": {"lat": 28.6139, "lon": 77.2090},
  "destination": {"lat": 28.6129, "lon": 77.2295},
  "profile": "driving"
}
```

## Deploy API on Render
1. Push this project to GitHub.
2. In Render, choose **New → Blueprint** and connect the repository.
3. Select the repository root containing `backend/render.yaml` (or create a Web Service with root directory `backend`).
4. Render installs `backend/requirements.txt` and starts `uvicorn main:app --host 0.0.0.0 --port $PORT`.
5. After deployment, test `https://YOUR-API.onrender.com/api/health` and open `/docs`.

## Deploy frontend on Vercel
1. Import the same GitHub repository into Vercel.
2. Set **Root Directory** to `frontend`.
3. Set build command to `npm run build` and output directory to `dist`.
4. Add environment variable `VITE_API_URL=https://YOUR-API.onrender.com`.
5. Deploy.

## Important project notes
- The public Nominatim and OSRM services are community services with fair-use policies, not production SLAs. Do not send bulk requests; add caching and rate limiting before public/large-scale use.
- The public OSRM demo endpoint used here is configured for driving. Cycling/walking UI choices are present, but the backend returns a clear `501` until a suitable routing provider is configured for those profiles.
- Browser geolocation requires user permission and a secure context (HTTPS, or localhost).
- Configure `CORS_ORIGINS` to your exact deployed frontend origin before public release.
