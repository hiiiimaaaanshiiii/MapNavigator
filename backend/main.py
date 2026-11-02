from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional
import httpx
import os

app = FastAPI(
    title="Map Navigator API",
    description="Geocoding and route-planning API for the Map Navigator minor project.",
    version="1.0.0",
)

origins = os.getenv("CORS_ORIGINS", "*").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

NOMINATIM = "https://nominatim.openstreetmap.org"
OSRM = "https://router.project-osrm.org"
HEADERS = {"User-Agent": "MapNavigatorMinorProject/1.0 (student project)"}


class Coordinate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)


class RouteRequest(BaseModel):
    origin: Coordinate
    destination: Coordinate
    profile: str = Field(default="driving", pattern="^(driving|cycling|walking)$")


@app.get("/")
async def root():
    return {"name": "Map Navigator API", "docs": "/docs", "health": "/api/health"}


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "map-navigator-api", "version": "1.0.0"}


@app.get("/api/geocode")
async def geocode(q: str = Query(min_length=2, max_length=180), limit: int = Query(5, ge=1, le=10)):
    params = {"q": q, "format": "jsonv2", "limit": limit, "addressdetails": 1}
    async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
        try:
            response = await client.get(f"{NOMINATIM}/search", params=params)
            response.raise_for_status()
            results = response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Geocoding provider error: {exc}") from exc
    return [
        {
            "name": item.get("name") or item.get("display_name", "").split(",")[0],
            "display_name": item.get("display_name"),
            "lat": float(item["lat"]),
            "lon": float(item["lon"]),
            "type": item.get("type"),
            "address": item.get("address", {}),
        }
        for item in results
    ]


@app.post("/api/route")
async def route(request: RouteRequest):
    # OSRM's public demo server supports driving. For other profiles, return a clear provider limitation.
    if request.profile != "driving":
        raise HTTPException(
            status_code=501,
            detail="The public OSRM demo endpoint currently provides driving routes. Configure a cycling/walking routing provider to enable this profile."
        )
    coords = f"{request.origin.lon},{request.origin.lat};{request.destination.lon},{request.destination.lat}"
    params = {"overview": "full", "geometries": "geojson", "steps": "true", "alternatives": "true"}
    async with httpx.AsyncClient(timeout=25, headers=HEADERS) as client:
        try:
            response = await client.get(f"{OSRM}/route/v1/driving/{coords}", params=params)
            response.raise_for_status()
            payload = response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Routing provider error: {exc}") from exc
    if payload.get("code") != "Ok" or not payload.get("routes"):
        raise HTTPException(status_code=404, detail="No route found between these locations.")
    selected = payload["routes"][0]
    steps = []
    for leg in selected.get("legs", []):
        for step in leg.get("steps", []):
            maneuver = step.get("maneuver", {})
            steps.append({
                "instruction": maneuver.get("instruction") or f"{maneuver.get('type', 'Continue').replace('_', ' ').title()}",
                "distance_m": round(step.get("distance", 0)),
                "duration_s": round(step.get("duration", 0)),
                "road": step.get("name", ""),
                "modifier": maneuver.get("modifier"),
            })
    return {
        "distance_m": round(selected["distance"]),
        "duration_s": round(selected["duration"]),
        "geometry": selected["geometry"],
        "steps": steps,
        "provider": "OSRM",
    }


@app.get("/api/reverse-geocode")
async def reverse_geocode(lat: float = Query(ge=-90, le=90), lon: float = Query(ge=-180, le=180)):
    params = {"lat": lat, "lon": lon, "format": "jsonv2"}
    async with httpx.AsyncClient(timeout=15, headers=HEADERS) as client:
        try:
            response = await client.get(f"{NOMINATIM}/reverse", params=params)
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPError as exc:
            raise HTTPException(status_code=502, detail=f"Reverse geocoding provider error: {exc}") from exc
    return {"display_name": data.get("display_name"), "address": data.get("address", {})}
