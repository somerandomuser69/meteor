export interface CurrentWeather {
  temperature_2m: number;
  relative_humidity_2m: number;
  apparent_temperature: number;
  is_day: number;
  precipitation: number;
  rain: number;
  showers: number;
  snowfall: number;
  weather_code: number;
  cloud_cover: number;
  pressure_msl: number;
  surface_pressure: number;
  wind_speed_10m: number;
  wind_direction_10m: number;
  wind_gusts_10m: number;
}

export interface HourlyForecast {
  time: string[];
  temperature_2m: number[];
  relative_humidity_2m: number[];
  dew_point_2m: number[];
  apparent_temperature: number[];
  precipitation_probability: number[];
  precipitation: number[];
  rain: number[];
  showers: number[];
  snowfall: number[];
  snow_depth: number[];
  weather_code: number[];
  pressure_msl: number[];
  cloud_cover: number[];
  visibility: number[];
  wind_speed_10m: number[];
  wind_direction_10m: number[];
  wind_gusts_10m: number[];
  uv_index: number[];
  is_day: number[];
  cape: number[];
  soil_moisture_0_to_1cm: number[];
}

export interface DailyForecast {
  time: string[];
  weather_code: number[];
  temperature_2m_max: number[];
  temperature_2m_min: number[];
  apparent_temperature_max: number[];
  apparent_temperature_min: number[];
  sunrise: string[];
  sunset: string[];
  uv_index_max: number[];
  precipitation_sum: number[];
  rain_sum: number[];
  showers_sum: number[];
  snowfall_sum: number[];
  precipitation_hours: number[];
  precipitation_probability_max: number[];
  wind_speed_10m_max: number[];
  wind_gusts_10m_max: number[];
  wind_direction_10m_dominant: number[];
}

export interface WeatherData {
  latitude: number;
  longitude: number;
  weather: {
    current: CurrentWeather;
    hourly: HourlyForecast;
    daily: DailyForecast;
  };
  aqi: {
    current: {
      us_aqi: number;
      pm2_5: number;
      pm10: number;
      carbon_monoxide: number;
      nitrogen_dioxide: number;
      sulphur_dioxide: number;
      ozone: number;
      pollen_pollen_fraction_alder?: number;
      pollen_pollen_fraction_birch?: number;
      pollen_pollen_fraction_grass?: number;
    };
  };
  marine: {
    current: {
      wave_height: number;
      wave_direction: number;
      wave_period: number;
      wind_wave_height: number;
      wind_wave_direction: number;
      wind_wave_period: number;
      swell_wave_height: number;
      swell_wave_period: number;
    };
  };
}

export interface EarthquakeFeature {
  type: string;
  properties: {
    mag: number;
    place: string;
    time: number;
    title: string;
    tsunami: number;
  };
  geometry: {
    type: "Point";
    coordinates: number[]; // [lon, lat, depth]
  };
}

export interface EarthquakeResponse {
  features: EarthquakeFeature[];
}

export interface MetarTafResponse {
  station: string;
  metarRaw: string;
  tafRaw: string;
  decoded: {
    windSpeed: string;
    windDirection: string;
    visibility: string;
    clouds: string;
    temperature: string;
    dewPoint: string;
    pressure: string;
    remarks: string;
  };
}

export interface SavedLocation {
  id: string;
  name: string;
  lat: number;
  lon: number;
  notes: string;
  roleRequired: string;
}

export interface Alert {
  id: string;
  severity: "Minor" | "Moderate" | "Severe" | "Extreme";
  category: string;
  title: string;
  description: string;
  issuedAt: string;
  expiresAt: string;
  coordinates: { lat: number; lon: number };
}

export type UnitType = "metric" | "imperial";
export type LanguageType = "en" | "es" | "fr" | "de";
export type UserRole = "Observer" | "Forecaster" | "Meteorologist" | "Admin";
