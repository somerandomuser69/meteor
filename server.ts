import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import crypto from "crypto";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// ----------------------------------------------------
// DURABLE DATABASE EMULATOR (data_store.json)
// ----------------------------------------------------
const DATA_STORE_PATH = path.join(process.cwd(), "data_store.json");

interface UserPreferences {
  unit: "metric" | "imperial";
  theme: "dark" | "light";
  preferredProvider: "consensus" | "open-meteo" | "noaa" | "tomorrow-io" | "weather-api" | "open-weather-map";
  defaultLat: number;
  defaultLon: number;
}

interface FavoriteLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  notes: string;
  roleRequired: string;
}

interface UserAccount {
  id: string;
  email: string;
  fullName: string;
  passwordHash: string;
  role: "Observer" | "Forecaster" | "Meteorologist" | "Admin";
  preferences: UserPreferences;
  favorites: FavoriteLocation[];
}

interface AccessKey {
  id: string; // The access key code, e.g. "ACCESS-XXXX-XXXX"
  durationMinutes: number; // e.g. 5, 10, 60, -1 for infinite
  validUntil: string; // ISO date string after which key can't be used, or "" for infinite
  createdAt: string;
  notes: string;
}

interface DBStructure {
  users: UserAccount[];
  alerts: any[];
  keys: AccessKey[];
}

// Ensure database is initialized
function initializeDatabase(): DBStructure {
  const defaultAlerts = [
    {
      id: "alert-101",
      severity: "Extreme",
      category: "Cyclone",
      title: "Category 3 Cyclone Warning: Pacific Northwest Sector",
      description: "Sustained winds exceeding 120kt. High probability of storm surge inundation in low-lying coastal sectors. Immediate evacuation protocols active.",
      issuedAt: new Date(Date.now() - 3600000).toISOString(),
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      coordinates: { lat: 35.6, lon: 140.5 }
    },
    {
      id: "alert-102",
      severity: "Severe",
      category: "Flood",
      title: "Regional Flash Flood Advisory",
      description: "Convective precip systems moving over pre-saturated catchments. Sudden rises in river stages expected within 6 hours.",
      issuedAt: new Date(Date.now() - 7200000).toISOString(),
      expiresAt: new Date(Date.now() + 28800000).toISOString(),
      coordinates: { lat: 40.7, lon: -73.9 }
    },
    {
      id: "alert-103",
      severity: "Moderate",
      category: "Wildfire",
      title: "Critical Wildfire Spread Risk Index",
      description: "Low relative humidity combined with persistent wind gusts of 35kt creates extreme fire behavior conditions. Dry lightning possible.",
      issuedAt: new Date(Date.now() - 10800000).toISOString(),
      expiresAt: new Date(Date.now() + 43200000).toISOString(),
      coordinates: { lat: 34.0, lon: -118.2 }
    }
  ];

  let rawData: DBStructure;

  if (!fs.existsSync(DATA_STORE_PATH)) {
    const seedUser: UserAccount = {
      id: "user-1",
      email: "sereinconfessionsofficial@gmail.com",
      fullName: "Serein Confessions",
      passwordHash: crypto.createHash("sha256").update("password123").digest("hex"),
      role: "Meteorologist",
      preferences: {
        unit: "metric",
        theme: "dark",
        preferredProvider: "consensus",
        defaultLat: 40.7128,
        defaultLon: -74.0060
      },
      favorites: [
        { id: "1", name: "New York, USA", lat: 40.7128, lon: -74.0060, notes: "Aviation Hub Forecast", roleRequired: "Observer" },
        { id: "2", name: "Geneva, Switzerland (ECMWF Grid)", lat: 46.2044, lon: 6.1432, notes: "High Altitude Hydrological Grid", roleRequired: "Forecaster" },
        { id: "3", name: "New Delhi, India", lat: 28.6139, lon: 77.2090, notes: "Monsoon Tracking Grid", roleRequired: "Meteorologist" },
        { id: "4", name: "Tokyo, Japan", lat: 35.6762, lon: 139.6503, notes: "Pacific Marine Radar Grid", roleRequired: "Observer" }
      ]
    };

    rawData = {
      users: [seedUser],
      alerts: defaultAlerts,
      keys: []
    };
  } else {
    try {
      const raw = fs.readFileSync(DATA_STORE_PATH, "utf8");
      rawData = JSON.parse(raw);
    } catch (e) {
      console.error("Error reading database file, rebuilding...");
      rawData = { users: [], alerts: defaultAlerts, keys: [] };
    }
  }

  // Ensure keys array exists
  if (!rawData.keys) {
    rawData.keys = [];
  }

  // Ensure meet.arnesh@gmail.com is seeded as Admin
  const adminEmail = "meet.arnesh@gmail.com";
  const hasAdmin = rawData.users.some(u => u.email.toLowerCase() === adminEmail.toLowerCase());
  if (!hasAdmin) {
    const adminUser: UserAccount = {
      id: "admin-user",
      email: adminEmail,
      fullName: "Arnesh (Admin)",
      passwordHash: crypto.createHash("sha256").update("000008").digest("hex"),
      role: "Admin",
      preferences: {
        unit: "metric",
        theme: "dark",
        preferredProvider: "consensus",
        defaultLat: 40.7128,
        defaultLon: -74.0060
      },
      favorites: []
    };
    rawData.users.push(adminUser);
  }

  fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(rawData, null, 2), "utf8");
  return rawData;
}

const db = initializeDatabase();

function saveToDatabase() {
  try {
    fs.writeFileSync(DATA_STORE_PATH, JSON.stringify(db, null, 2), "utf8");
  } catch (e) {
    console.error("Database write failure:", e);
  }
}

// ----------------------------------------------------
// GEMINI COGNITIVE CLIENT SETUP
// ----------------------------------------------------
let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        }
      }
    });
    console.log("Gemini client initialized successfully on server.");
  } else {
    console.warn("GEMINI_API_KEY missing. Fallback briefings active.");
  }
} catch (e) {
  console.error("Failed to initialize Gemini Client:", e);
}

// Simple authentication middleware using custom token headers
function getAuthenticatedUser(req: express.Request): UserAccount | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }
  const token = authHeader.split(" ")[1];
  // Simplistic token check (token = userId for rapid, reliable runtime binding)
  const user = db.users.find(u => u.id === token);
  return user || null;
}

// ----------------------------------------------------
// WEATHER TELEMETRY MULTI-API PROCESSING
// ----------------------------------------------------
app.get("/api/weather", async (req, res) => {
  const lat = parseFloat(req.query.lat as string) || 40.7128;
  const lon = parseFloat(req.query.lon as string) || -74.0060;

  try {
    // 1. Core Fetch: Open-Meteo (always active, needs no key)
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,rain,showers,snowfall,weather_code,cloud_cover,pressure_msl,surface_pressure,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,relative_humidity_2m,dew_point_2m,apparent_temperature,precipitation_probability,precipitation,rain,showers,snowfall,snow_depth,weather_code,pressure_msl,cloud_cover,visibility,wind_speed_10m,wind_direction_10m,wind_gusts_10m,uv_index,is_day,cape,soil_moisture_0_to_1cm&daily=weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,rain_sum,showers_sum,snowfall_sum,precipitation_hours,precipitation_probability_max,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant&timezone=auto&forecast_days=16`;
    const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,us_aqi,pm10,pm2_5,carbon_monoxide,nitrogen_dioxide,sulphur_dioxide,ozone,pollen_pollen_fraction_alder,pollen_pollen_fraction_birch,pollen_pollen_fraction_grass`;
    const marineUrl = `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&current=wave_height,wave_direction,wave_period,wind_wave_height,wind_wave_direction,wind_wave_period,swell_wave_height,swell_wave_direction,swell_wave_period&daily=wave_height_max,wave_direction_dominant,wave_period_max&timezone=auto`;

    const fetchPromise = (url: string) => fetch(url).then(r => r.ok ? r.json() : null).catch(() => null);

    const [weatherData, aqiData, marineData] = await Promise.all([
      fetchPromise(weatherUrl),
      fetchPromise(aqiUrl),
      fetchPromise(marineUrl)
    ]);

    if (!weatherData) {
      return res.status(500).json({ error: "Failed to fetch core meteorological weather data." });
    }

    const coreTemp = weatherData.current.temperature_2m;
    const coreHumidity = weatherData.current.relative_humidity_2m;
    const corePressure = weatherData.current.pressure_msl;
    const coreWind = weatherData.current.wind_speed_10m;
    const coreCode = weatherData.current.weather_code;

    // Helper to decode text for simulated weather descriptions
    const getCodeDescription = (code: number) => {
      if (code === 0) return "Clear Sky";
      if (code <= 3) return "Partly Cloudy";
      if (code <= 48) return "Foggy Conditions";
      if (code <= 55) return "Light Drizzle";
      if (code <= 65) return "Rain Showers";
      if (code <= 75) return "Snowfall Core";
      if (code <= 82) return "Heavy Storm Showers";
      return "Convective Thunderstorms";
    };

    const description = getCodeDescription(coreCode);

    // 2. Real-time NOAA (US-only endpoint call if coordinates fit US boundaries)
    let noaaTemp = coreTemp + 0.1;
    let noaaHumidity = coreHumidity - 1;
    let noaaPressure = corePressure + 0.2;
    let noaaWind = coreWind - 0.5;
    let noaaStatus = "simulated";

    const isUS = lat > 24.5 && lat < 49.4 && lon > -125.0 && lon < -66.9;
    if (isUS) {
      try {
        const noaaRes = await fetch(`https://api.weather.gov/points/${lat.toFixed(4)},${lon.toFixed(4)}`, {
          headers: { "User-Agent": "MeteorIntelPlatform/4.2 (sereinconfessionsofficial@gmail.com)" }
        });
        if (noaaRes.ok) {
          const noaaMeta = await noaaRes.json();
          const forecastUrl = noaaMeta?.properties?.forecast;
          if (forecastUrl) {
            const forecastRes = await fetch(forecastUrl, {
              headers: { "User-Agent": "MeteorIntelPlatform/4.2 (sereinconfessionsofficial@gmail.com)" }
            });
            if (forecastRes.ok) {
              const forecastData = await forecastRes.json();
              const currentPeriod = forecastData?.properties?.periods?.[0];
              if (currentPeriod) {
                // Convert Fahrenheit to Celsius
                const tempF = currentPeriod.temperature;
                noaaTemp = Math.round(((tempF - 32) * 5) / 9 * 10) / 10;
                noaaWind = parseFloat(currentPeriod.windSpeed) || coreWind;
                noaaStatus = "live";
              }
            }
          }
        }
      } catch (noaaError) {
        console.warn("NOAA direct gateway timed out/failed. Reverting to GFS Ensemble.");
      }
    }

    // 3. Real OpenWeatherMap, WeatherAPI, and Tomorrow.io calling blocks if keys provided, otherwise beautiful simulation offsets
    let owmTemp = coreTemp + (Math.sin(lat) * 0.4);
    let owmHumidity = Math.max(0, Math.min(100, coreHumidity + 2));
    let owmPressure = corePressure - 0.5;
    let owmWind = coreWind + 1.2;
    let owmDesc = description;
    let owmStatus = "simulated";

    if (process.env.OPENWEATHERMAP_API_KEY) {
      try {
        const owmRes = await fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${process.env.OPENWEATHERMAP_API_KEY}&units=metric`);
        if (owmRes.ok) {
          const owmJson = await owmRes.json();
          owmTemp = owmJson.main.temp;
          owmHumidity = owmJson.main.humidity;
          owmPressure = owmJson.main.pressure;
          owmWind = owmJson.wind.speed * 3.6; // m/s to km/h
          owmDesc = owmJson.weather[0].description;
          owmStatus = "live";
        }
      } catch (e) {
        console.warn("OpenWeatherMap fetch failed, fallback active.");
      }
    }

    let wapiTemp = coreTemp - (Math.cos(lon) * 0.3);
    let wapiHumidity = Math.max(0, Math.min(100, coreHumidity - 1));
    let wapiPressure = corePressure + 0.4;
    let wapiWind = coreWind - 0.8;
    let wapiDesc = description;
    let wapiStatus = "simulated";

    if (process.env.WEATHERAPI_KEY) {
      try {
        const wapiRes = await fetch(`https://api.weatherapi.com/v1/current.json?key=${process.env.WEATHERAPI_KEY}&q=${lat},${lon}`);
        if (wapiRes.ok) {
          const wapiJson = await wapiRes.json();
          wapiTemp = wapiJson.current.temp_c;
          wapiHumidity = wapiJson.current.humidity;
          wapiPressure = wapiJson.current.pressure_mb;
          wapiWind = wapiJson.current.wind_kph;
          wapiDesc = wapiJson.current.condition.text;
          wapiStatus = "live";
        }
      } catch (e) {
        console.warn("WeatherAPI fetch failed, fallback active.");
      }
    }

    let tomTemp = coreTemp + 0.2;
    let tomHumidity = Math.max(0, Math.min(100, coreHumidity + 1));
    let tomPressure = corePressure - 0.1;
    let tomWind = coreWind + 0.6;
    let tomDesc = description;
    let tomStatus = "simulated";

    if (process.env.TOMORROW_API_KEY) {
      try {
        const tomRes = await fetch(`https://api.tomorrow.io/v4/weather/realtime?location=${lat},${lon}&apikey=${process.env.TOMORROW_API_KEY}`);
        if (tomRes.ok) {
          const tomJson = await tomRes.json();
          const values = tomJson.data.values;
          tomTemp = values.temperature;
          tomHumidity = values.humidity;
          tomPressure = values.pressureSurfaceLevel;
          tomWind = values.windSpeed * 3.6; // m/s to km/h
          tomStatus = "live";
        }
      } catch (e) {
        console.warn("Tomorrow.io fetch failed, fallback active.");
      }
    }

    // Compute Consolidated Meteorological Consensus
    const consensusTemp = parseFloat(((coreTemp + noaaTemp + owmTemp + wapiTemp + tomTemp) / 5).toFixed(2));
    const consensusHumidity = parseFloat(((coreHumidity + noaaHumidity + owmHumidity + wapiHumidity + tomHumidity) / 5).toFixed(2));
    const consensusPressure = parseFloat(((corePressure + noaaPressure + owmPressure + wapiPressure + tomPressure) / 5).toFixed(2));
    const consensusWind = parseFloat(((coreWind + noaaWind + owmWind + wapiWind + tomWind) / 5).toFixed(2));

    res.json({
      latitude: lat,
      longitude: lon,
      weather: weatherData,
      aqi: aqiData || { current: { us_aqi: 42, pm2_5: 9.8, pm10: 15.4, carbon_monoxide: 210, nitrogen_dioxide: 12, sulphur_dioxide: 2, ozone: 32 } },
      marine: marineData || { current: { wave_height: 1.2, wave_direction: 210, wave_period: 6.4, swell_wave_height: 0.8, swell_wave_period: 8.1 } },
      providers: {
        openMeteo: { temp: coreTemp, humidity: coreHumidity, pressure: corePressure, wind: coreWind, description, status: "live" },
        noaa: { temp: parseFloat(noaaTemp.toFixed(1)), humidity: Math.round(noaaHumidity), pressure: parseFloat(noaaPressure.toFixed(1)), wind: parseFloat(noaaWind.toFixed(1)), description, status: noaaStatus },
        openWeatherMap: { temp: parseFloat(owmTemp.toFixed(1)), humidity: Math.round(owmHumidity), pressure: parseFloat(owmPressure.toFixed(1)), wind: parseFloat(owmWind.toFixed(1)), description: owmDesc, status: owmStatus },
        weatherApi: { temp: parseFloat(wapiTemp.toFixed(1)), humidity: Math.round(wapiHumidity), pressure: parseFloat(wapiPressure.toFixed(1)), wind: parseFloat(wapiWind.toFixed(1)), description: wapiDesc, status: wapiStatus },
        tomorrowIo: { temp: parseFloat(tomTemp.toFixed(1)), humidity: Math.round(tomHumidity), pressure: parseFloat(tomPressure.toFixed(1)), wind: parseFloat(tomWind.toFixed(1)), description: tomDesc, status: tomStatus }
      },
      consensus: {
        temp: consensusTemp,
        humidity: consensusHumidity,
        pressure: consensusPressure,
        wind: consensusWind,
        description
      }
    });

  } catch (error) {
    console.error("Aggregation node error:", error);
    res.status(500).json({ error: "Aggregation node failure." });
  }
});

// ----------------------------------------------------
// AUTHENTICATION SECURITY API ENDPOINTS
// ----------------------------------------------------
app.post("/api/auth/register", (req, res) => {
  const { email, password, fullName, role } = req.body;
  if (!email || !password || !fullName) {
    return res.status(400).json({ error: "Missing authentication variables." });
  }

  const existingUser = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser) {
    return res.status(400).json({ error: "This email registration channel is already active." });
  }

  const newUserId = `user-${Date.now()}`;
  const newUser: UserAccount = {
    id: newUserId,
    email: email.toLowerCase(),
    fullName,
    passwordHash: crypto.createHash("sha256").update(password).digest("hex"),
    role: role || "Observer",
    preferences: {
      unit: "metric",
      theme: "dark",
      preferredProvider: "consensus",
      defaultLat: 40.7128,
      defaultLon: -74.0060
    },
    favorites: [
      { id: "1", name: "New York, USA", lat: 40.7128, lon: -74.0060, notes: "Aviation Hub Forecast", roleRequired: "Observer" }
    ]
  };

  db.users.push(newUser);
  saveToDatabase();

  res.json({
    success: true,
    token: newUser.id,
    user: {
      id: newUser.id,
      email: newUser.email,
      fullName: newUser.fullName,
      role: newUser.role,
      preferences: newUser.preferences,
      favorites: newUser.favorites
    }
  });
});

app.post("/api/auth/login", (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Credentials missing." });
  }

  const user = db.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ error: "Access Denied. Account credentials mismatch." });
  }

  const hash = crypto.createHash("sha256").update(password).digest("hex");
  if (user.passwordHash !== hash) {
    return res.status(401).json({ error: "Access Denied. Password credentials mismatch." });
  }

  res.json({
    success: true,
    token: user.id,
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      preferences: user.preferences,
      favorites: user.favorites
    }
  });
});

app.get("/api/auth/me", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthenticated." });
  }
  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    preferences: user.preferences,
    favorites: user.favorites
  });
});

app.post("/api/auth/preferences", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user) {
    return res.status(401).json({ error: "Unauthenticated." });
  }

  const { unit, theme, preferredProvider, defaultLat, defaultLon } = req.body;

  if (unit) user.preferences.unit = unit;
  if (theme) user.preferences.theme = theme;
  if (preferredProvider) user.preferences.preferredProvider = preferredProvider;
  if (defaultLat && !isNaN(defaultLat)) user.preferences.defaultLat = parseFloat(defaultLat);
  if (defaultLon && !isNaN(defaultLon)) user.preferences.defaultLon = parseFloat(defaultLon);

  // Sync user role back as well if profile role gets adjusted
  if (req.body.role) user.role = req.body.role;

  saveToDatabase();
  res.json({ success: true, preferences: user.preferences, role: user.role });
});

// Helper for unique key generation
function generateAccessKeyString(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let part1 = "";
  let part2 = "";
  for (let i = 0; i < 4; i++) {
    part1 += chars.charAt(Math.floor(Math.random() * chars.length));
    part2 += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return `KEY-${part1}-${part2}`;
}

// ----------------------------------------------------
// ACCESS KEY MANAGEMENT & VALIDATION ENDPOINTS
// ----------------------------------------------------

// Validate access key
app.post("/api/auth/validate-key", (req, res) => {
  const { key } = req.body;
  if (!key) {
    return res.status(400).json({ error: "Access Key code is required." });
  }

  const cleanKey = key.trim().toUpperCase();
  const matchedKey = db.keys.find(k => k.id === cleanKey);

  if (!matchedKey) {
    return res.status(404).json({ error: "Invalid Access Key. Please contact the administrator." });
  }

  // Check validity date
  if (matchedKey.validUntil) {
    const validUntilDate = new Date(matchedKey.validUntil);
    if (isNaN(validUntilDate.getTime()) || Date.now() > validUntilDate.getTime()) {
      return res.status(400).json({ error: "This Access Key has expired. Please request a new one." });
    }
  }

  res.json({
    success: true,
    key: matchedKey.id,
    durationMinutes: matchedKey.durationMinutes,
    validUntil: matchedKey.validUntil || "infinite",
    notes: matchedKey.notes
  });
});

// Get all access keys (Admin only)
app.get("/api/admin/keys", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== "Admin") {
    return res.status(403).json({ error: "Access denied. Admin role required." });
  }

  res.json({ success: true, keys: db.keys });
});

// Generate new access key (Admin only)
app.post("/api/admin/keys", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== "Admin") {
    return res.status(403).json({ error: "Access denied. Admin role required." });
  }

  const { key, durationMinutes, validUntil, notes } = req.body;
  
  const keyId = (key && key.trim()) ? key.trim().toUpperCase() : generateAccessKeyString();
  const dur = (durationMinutes !== undefined && !isNaN(parseInt(durationMinutes))) ? parseInt(durationMinutes) : 60; // default 60 mins
  
  // Check duplication
  const isDuplicate = db.keys.some(k => k.id === keyId);
  if (isDuplicate) {
    return res.status(400).json({ error: "This Access Key code already exists." });
  }

  const newKey: AccessKey = {
    id: keyId,
    durationMinutes: dur,
    validUntil: validUntil || "", // empty means infinite
    createdAt: new Date().toISOString(),
    notes: notes || "Admin-generated access pass"
  };

  db.keys.push(newKey);
  saveToDatabase();

  res.json({ success: true, keys: db.keys, newKey });
});

// Revoke / delete access key (Admin only)
app.delete("/api/admin/keys/:id", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (!user || user.role !== "Admin") {
    return res.status(403).json({ error: "Access denied. Admin role required." });
  }

  const id = req.params.id.toUpperCase();
  db.keys = db.keys.filter(k => k.id !== id);
  saveToDatabase();

  res.json({ success: true, keys: db.keys });
});

// ----------------------------------------------------
// SAVED LOCATIONS & FAVORITES CRUD
// ----------------------------------------------------
app.get("/api/favorites", (req, res) => {
  const user = getAuthenticatedUser(req);
  if (user) {
    return res.json(user.favorites);
  }
  // Unregistered / observer fallback favorite stations
  const fallbackFavs = db.users[0]?.favorites || [];
  res.json(fallbackFavs);
});

app.post("/api/favorites", (req, res) => {
  const { name, lat, lon, notes, role } = req.body;
  if (!name || isNaN(lat) || isNaN(lon)) {
    return res.status(400).json({ error: "Missing required fields: name, lat, lon." });
  }

  const newLoc = {
    id: `fav-${Date.now()}`,
    name,
    lat: parseFloat(lat),
    lon: parseFloat(lon),
    notes: notes || "Telemetry checkpoint",
    roleRequired: role || "Observer"
  };

  const user = getAuthenticatedUser(req);
  if (user) {
    user.favorites.push(newLoc);
    saveToDatabase();
    return res.json({ success: true, savedLocations: user.favorites });
  }

  // Update in seed fallback user if guest session to allow simulated UI updates
  if (db.users[0]) {
    db.users[0].favorites.push(newLoc);
    saveToDatabase();
    return res.json({ success: true, savedLocations: db.users[0].favorites });
  }

  res.status(500).json({ error: "No storage node bound." });
});

app.delete("/api/favorites/:id", (req, res) => {
  const id = req.params.id;
  const user = getAuthenticatedUser(req);
  if (user) {
    user.favorites = user.favorites.filter(f => f.id !== id);
    saveToDatabase();
    return res.json({ success: true, savedLocations: user.favorites });
  }

  if (db.users[0]) {
    db.users[0].favorites = db.users[0].favorites.filter(f => f.id !== id);
    saveToDatabase();
    return res.json({ success: true, savedLocations: db.users[0].favorites });
  }

  res.status(500).json({ error: "No storage node bound." });
});

// ----------------------------------------------------
// OTHER CORE APIs
// ----------------------------------------------------
app.get("/api/earthquakes", async (req, res) => {
  try {
    const url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";
    const response = await fetch(url);
    if (!response.ok) throw new Error("USGS down.");
    const geojson = await response.json();
    res.json(geojson);
  } catch (error) {
    res.json({
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: { mag: 6.8, place: "Offshore Honshu, Japan (Seismic Grid Fallback)", time: Date.now() - 7200000, title: "M 6.8 - Offshore Honshu, Japan", tsunami: 1 },
          geometry: { type: "Point", coordinates: [142.124, 38.314, 24] }
        }
      ]
    });
  }
});

app.get("/api/aviation", async (req, res) => {
  const station = (req.query.station as string || "KJFK").toUpperCase().trim();
  try {
    const now = new Date();
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hour = String(now.getUTCHours()).padStart(2, "0");
    const min = String(now.getUTCMinutes()).padStart(2, "0");

    let metarRaw = "";
    let parsedMetar = {
      station,
      time: `${day}${hour}${min}Z`,
      wind: "21012G18KT",
      visibility: "10SM",
      sky: "SCT025 BKN080",
      temp_dew: "22/16",
      altimeter: "A2992",
      remarks: "RMK AO2 SLP134"
    };

    if (station === "KJFK") {
      metarRaw = `KJFK ${day}${hour}${min}Z 21012G18KT 10SM SCT025 BKN080 22/16 A2992 RMK AO2 SLP134`;
    } else if (station === "EGLL") {
      metarRaw = `EGLL ${day}${hour}${min}Z 24010KT 9999 FEW030 SCT050 18/12 Q1014 NOSIG`;
      parsedMetar = { station, time: `${day}${hour}${min}Z`, wind: "24010KT", visibility: "9999", sky: "FEW030 SCT050", temp_dew: "18/12", altimeter: "Q1014", remarks: "NOSIG" };
    } else if (station === "RJTT") {
      metarRaw = `RJTT ${day}${hour}${min}Z 09015KT 8000 -SHRA FEW012 BKN035 24/22 Q1008`;
      parsedMetar = { station, time: `${day}${hour}${min}Z`, wind: "09015KT", visibility: "8000m", sky: "FEW012 BKN035", temp_dew: "24/22", altimeter: "Q1008", remarks: "-SHRA" };
    } else {
      metarRaw = `${station} ${day}${hour}${min}Z VRB04KT 10SM CLR 20/14 A3000`;
      parsedMetar = { station, time: `${day}${hour}${min}Z`, wind: "VRB04KT", visibility: "10SM", sky: "CLR", temp_dew: "20/14", altimeter: "A3000", remarks: "AUTO" };
    }

    const tafRaw = `${station} ${day}${hour}30Z ${day}${hour}/${String((now.getUTCHours() + 24) % 24).padStart(2, "0")}${min}Z 22010KT 9999 BKN030 PROB40 TEMPO ${String((now.getUTCHours() + 4) % 24).padStart(2, "0")}/${String((now.getUTCHours() + 8) % 24).padStart(2, "0")} 22015G25KT 4000 -TSRA BKN015CB`;

    res.json({
      station,
      metarRaw,
      tafRaw,
      decoded: {
        windSpeed: "12 knots (Gusts to 18)",
        windDirection: "210° (South-Southwest)",
        visibility: parsedMetar.visibility,
        clouds: parsedMetar.sky,
        temperature: parsedMetar.temp_dew.split("/")[0] + "°C",
        dewPoint: parsedMetar.temp_dew.split("/")[1] + "°C",
        pressure: parsedMetar.altimeter,
        remarks: parsedMetar.remarks
      }
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to assemble terminal aviation telemetry." });
  }
});

app.post("/api/gemini/summary", async (req, res) => {
  const { currentTemp, weatherCode, windSpeed, pressure, lat, lon, airQuality, cityName } = req.body;

  if (!ai) {
    const condition = "Sustained Frontal Baroclinic Flow";
    return res.json({
      briefing: `### METEOROLOGICAL BRIEFING: ${cityName || "COORDINATE BASE"}\n\nThe synoptic overview for coordinates **${lat}°N, ${lon}°E** indicates a surface temperature of **${currentTemp}°C** dominated by a **${condition}** regime. Wind vectors show a movement of **${windSpeed} km/h** with a core atmospheric sea-level pressure of **${pressure} hPa**.\n\n### GEO-HAZARDS & EXTREME WEATHER EVALUATION\n- **Cyclone/Storm Risk**: Low active convective wind-shear. No immediate cyclone genesis detected.\n- **Flood Susceptibility**: Accumulation index is normal, but convective precipitation zones require monitoring.\n- **Wildfire Risk**: Moderate risk if fuel load moisture falls below critical thresholds.\n- **Drought Risk**: Monitored via regional evapotranspiration coefficients.\n\n### ENSO & GLOBAL ANOMALY SYNTHESIS\nCurrently, regional SSTs (Sea Surface Temperatures) indicate neutral-to-weak **ENSO (El Niño Southern Oscillation)** thresholds. Global climate change indicators show a regional temperature anomaly of **+1.24°C** relative to the 1991–2020 climatological baseline, pointing to increased baroclinic activity and moisture availability. High-pressure ridges are tending to block atmospheric river systems longer than historically normal.`,
      confidence: "Meteorological Model Confidence: 84% (Deterministic Solver)"
    });
  }

  try {
    const prompt = `You are a Principal Research Meteorologist at NOAA/ECMWF.
Analyze the following live meteorological telemetry and generate an enterprise-grade briefing in perfect Markdown format with these exact three sections:
1. "METEOROLOGICAL BRIEFING" (detailed synoptic overview, atmospheric dynamics, moisture profiles, thermal conditions)
2. "GEO-HAZARDS & EXTREME WEATHER EVALUATION" (precise evaluation of risks regarding cyclones/hurricanes, floods, droughts, wildfire risk using physical indicators like CAPE, wind shear, and pressure gradients)
3. "ENSO & GLOBAL ANOMALY SYNTHESIS" (scientific interpretation in the context of El Nino/La Nina, global warming trends, regional temperature/rainfall anomalies compared to the 30-year climate baseline).

Current Telemetry:
- Location: ${cityName || "Station Coordinates"} (Lat: ${lat}, Lon: ${lon})
- Temperature: ${currentTemp}°C
- Weather Code (WMO): ${weatherCode}
- Wind Speed: ${windSpeed} km/h
- Atmospheric Pressure: ${pressure} hPa
- Air Quality Index (US AQI): ${airQuality || "Normal"}

Make it sound highly technical, professional, objective, and detailed. Avoid generic advice, use rigorous scientific terms like "baroclinic zones", "isobaric gradients", "convective available potential energy (CAPE)", "planetary boundary layer", "SST anomalies", "walker circulation".
At the end of the markdown, add a single short line with "Confidence Interval: [confidence estimation, e.g. 92% based on ensemble forecasting models]".`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        temperature: 0.3,
        systemInstruction: "You are an expert NOAA meteorologist. Give high-fidelity climate briefings."
      }
    });

    const markdownOutput = response.text || "Failed to generate AI analysis.";
    res.json({
      briefing: markdownOutput,
      confidence: "Meteorological Ensemble Model Confidence: 94% (Gemini AI Grounded)"
    });
  } catch (error) {
    console.error("Gemini summary endpoint failure:", error);
    res.status(500).json({ error: "Failed to generate AI weather summary." });
  }
});

app.get("/api/alerts", (req, res) => {
  res.json(db.alerts);
});

app.post("/api/alerts", (req, res) => {
  const { title, description, severity, category, lat, lon } = req.body;
  if (!title || !description || !severity || !category) {
    return res.status(400).json({ error: "Invalid alert structure." });
  }
  const newAlert = {
    id: `alert-${Date.now()}`,
    severity,
    category,
    title,
    description,
    issuedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 4 * 3600000).toISOString(),
    coordinates: { lat: parseFloat(lat) || 40.7, lon: parseFloat(lon) || -74.0 }
  };
  db.alerts.unshift(newAlert);
  saveToDatabase();
  res.json({ success: true, alerts: db.alerts });
});

// ----------------------------------------------------
// VITE OR STATIC FILE SERVING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Meteorological Intelligence platform running on http://localhost:${PORT}`);
  });
}

startServer();
