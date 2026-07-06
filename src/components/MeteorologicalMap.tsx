import React, { useEffect, useRef, useState } from "react";
import { Play, Pause, Layers, Navigation, Info, Eye, Sliders, MapPin, Wind, Cloud, Compass, Sparkles } from "lucide-react";
import { WeatherData } from "../types";

interface MapProps {
  lat: number;
  lon: number;
  weatherData: WeatherData | null;
  onCoordinateChange: (lat: number, lon: number) => void;
}

type MapProvider = "carto-dark" | "osm" | "esri-satellite" | "opentopo" | "mapbox-dark";

export default function MeteorologicalMap({ lat, lon, weatherData, onCoordinateChange }: MapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);
  const canvasLayerRef = useRef<HTMLCanvasElement | null>(null);

  // Map settings
  const [provider, setProvider] = useState<MapProvider>("carto-dark");
  const [activeLayer, setActiveLayer] = useState<"wind" | "clouds" | "radar" | "storm" | "pressure">("wind");
  const [isPlayingAnimation, setIsPlayingAnimation] = useState(true);
  const [animationSpeed, setAnimationSpeed] = useState<number>(1.0); // 0.5, 1.0, 2.0
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.75); // 0.0 to 1.0
  const [mapLoaded, setMapLoaded] = useState(false);

  // Animation particles & coordinates state refs
  const particlesRef = useRef<any[]>([]);
  const cloudsRef = useRef<any[]>([]);
  const radarSweepAngle = useRef<number>(0);
  const animationFrameId = useRef<number | null>(null);

  // Provider config maps
  const providers: Record<MapProvider, { name: string; url: string; attribution: string }> = {
    "carto-dark": {
      name: "Sleek Dark (CartoDB)",
      url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      attribution: "© CartoDB"
    },
    "osm": {
      name: "OpenStreetMap Standard",
      url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "© OpenStreetMap"
    },
    "esri-satellite": {
      name: "Esri Satellite Imagery",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "© Esri • Satellite"
    },
    "opentopo": {
      name: "OpenTopo Topography",
      url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
      attribution: "© OpenTopoMap"
    },
    "mapbox-dark": {
      name: "Mapbox-Style Dark Carbon",
      url: "https://{s}.basemaps.cartocdn.com/rastertiles/dark_nolabels/{z}/{x}/{y}.png",
      attribution: "© CartoDB • Mapbox Style"
    }
  };

  // Load Leaflet dynamically
  useEffect(() => {
    let isMounted = true;
    
    // Add Leaflet CSS
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Add Leaflet JS
    const loadScript = () => {
      if ((window as any).L) {
        setMapLoaded(true);
        return;
      }
      
      const script = document.createElement("script");
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        if (isMounted) setMapLoaded(true);
      };
      document.body.appendChild(script);
    };

    loadScript();

    return () => {
      isMounted = false;
    };
  }, []);

  // Initialize and update Map
  useEffect(() => {
    if (!mapLoaded || !mapContainerRef.current) return;

    const L = (window as any).L;
    if (!L) return;

    // Destroy existing map if any
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Create Map (Modern dark themed cartodb basemap)
    const map = L.map(mapContainerRef.current, {
      center: [lat, lon],
      zoom: 6,
      zoomControl: false,
      attributionControl: false
    });

    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Set Tile Layer
    const tileLayer = L.tileLayer(providers[provider].url, {
      maxZoom: 19,
      attribution: providers[provider].attribution
    }).addTo(map);

    tileLayerRef.current = tileLayer;
    mapRef.current = map;

    // Add custom styled pulse marker at current lat/lon
    const pulseIcon = L.divIcon({
      className: "relative flex items-center justify-center",
      html: `
        <span class="absolute inline-flex h-12 w-12 animate-ping rounded-full bg-cyan-400 opacity-20"></span>
        <span class="relative inline-flex rounded-full h-4.5 w-4.5 bg-cyan-500 border-2 border-slate-900 shadow-[0_0_10px_rgba(6,182,212,0.6)]"></span>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    markerRef.current = L.marker([lat, lon], { icon: pulseIcon }).addTo(map);

    // Event listener for map clicks to select new coordinates
    map.on("click", (e: any) => {
      const { lat: clickLat, lng: clickLon } = e.latlng;
      // Truncate to 4 decimals for high-fidelity coordinate specs
      onCoordinateChange(parseFloat(clickLat.toFixed(4)), parseFloat(clickLon.toFixed(4)));
    });

    // Handle Resize
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    if (mapContainerRef.current) {
      resizeObserver.observe(mapContainerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapLoaded]);

  // Handle tile provider updates without destroying whole map
  useEffect(() => {
    if (mapRef.current && (window as any).L) {
      const L = (window as any).L;
      if (tileLayerRef.current) {
        mapRef.current.removeLayer(tileLayerRef.current);
      }
      const newTileLayer = L.tileLayer(providers[provider].url, {
        maxZoom: 19,
        attribution: providers[provider].attribution
      }).addTo(mapRef.current);
      tileLayerRef.current = newTileLayer;
    }
  }, [provider]);

  // Handle center updates when parent coordinate changes
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setView([lat, lon], mapRef.current.getZoom());
      if (markerRef.current) {
        markerRef.current.setLatLng([lat, lon]);
      }
    }
  }, [lat, lon]);

  // Meteorological Overlays (Wind, Clouds, Convective Radar, Storm Tracking, Pressure Isobars)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current || !weatherData) return;

    const map = mapRef.current;
    const L = (window as any).L;

    // Create custom canvas overlay
    const canvas = document.createElement("canvas");
    canvas.style.position = "absolute";
    canvas.style.top = "0";
    canvas.style.left = "0";
    canvas.style.width = "100%";
    canvas.style.height = "100%";
    canvas.style.pointerEvents = "none";
    canvas.style.zIndex = "400"; // below map controls (usually 1000)

    const pane = map.getPane("overlayPane");
    pane.appendChild(canvas);
    canvasLayerRef.current = canvas;

    const resizeCanvas = () => {
      const size = map.getSize();
      canvas.width = size.x;
      canvas.height = size.y;
    };
    resizeCanvas();
    map.on("resize move", resizeCanvas);

    // Initialize Particles for Wind Flow
    const generateParticles = (count: number) => {
      const parts = [];
      const size = map.getSize();
      const angle = ((weatherData.weather.current.wind_direction_10m || 210) * Math.PI) / 180;
      for (let i = 0; i < count; i++) {
        parts.push({
          x: Math.random() * size.x,
          y: Math.random() * size.y,
          life: Math.random() * 80 + 20,
          speed: Math.random() * 1.5 + 0.5,
          angle: angle + (Math.random() * 0.2 - 0.1)
        });
      }
      particlesRef.current = parts;
    };
    generateParticles(120);

    // Initialize Drifting Cloud Particles
    const generateClouds = (count: number) => {
      const clouds = [];
      const size = map.getSize();
      const angle = ((weatherData.weather.current.wind_direction_10m || 210) * Math.PI) / 180;
      for (let i = 0; i < count; i++) {
        clouds.push({
          x: Math.random() * size.x,
          y: Math.random() * size.y,
          radius: Math.random() * 45 + 25,
          opacity: Math.random() * 0.25 + 0.1,
          speed: (Math.random() * 0.4 + 0.2) * (weatherData.weather.current.wind_speed_10m / 15 || 1),
          angle: angle
        });
      }
      cloudsRef.current = clouds;
    };
    generateClouds(25);

    const ctx = canvas.getContext("2d");

    const animate = () => {
      if (!ctx) return;

      const size = map.getSize();
      ctx.globalAlpha = overlayOpacity;

      if (!isPlayingAnimation) {
        // Redraw passive frames if paused
        animationFrameId.current = requestAnimationFrame(animate);
        return;
      }

      // Step multiplier
      const dt = animationSpeed;

      // --------------------------------------------------
      // LAYER 1: WIND FLOW STREAMLINES
      // --------------------------------------------------
      if (activeLayer === "wind") {
        ctx.fillStyle = `rgba(15, 23, 42, ${0.08 / dt})`; // trail fade effect
        ctx.fillRect(0, 0, size.x, size.y);

        ctx.strokeStyle = provider === "osm" ? "rgba(16, 185, 129, 0.65)" : "rgba(34, 211, 238, 0.6)"; // Green OSM / Cyan Dark streamlines
        ctx.lineWidth = 1.8;

        particlesRef.current.forEach((p) => {
          const windKmh = weatherData.weather.current.wind_speed_10m || 15;
          const pixelSpeed = p.speed * (windKmh / 12) * dt;
          
          const nextX = p.x + Math.sin(p.angle) * pixelSpeed;
          const nextY = p.y - Math.cos(p.angle) * pixelSpeed; // invert screen Y

          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(nextX, nextY);
          ctx.stroke();

          p.x = nextX;
          p.y = nextY;
          p.life -= dt;

          if (p.life <= 0 || p.x < 0 || p.x > size.x || p.y < 0 || p.y > size.y) {
            p.x = Math.random() * size.x;
            p.y = Math.random() * size.y;
            p.life = Math.random() * 80 + 20;
            p.angle = ((weatherData.weather.current.wind_direction_10m || 210) * Math.PI) / 180 + (Math.random() * 0.2 - 0.1);
          }
        });
      } 
      // --------------------------------------------------
      // LAYER 2: CLOUD MOVEMENT ANIMATIONS
      // --------------------------------------------------
      else if (activeLayer === "clouds") {
        ctx.clearRect(0, 0, size.x, size.y);

        ctx.fillStyle = "rgba(241, 245, 249, 0.45)"; // Soft cloud white
        cloudsRef.current.forEach((c) => {
          const velocity = c.speed * dt;
          c.x += Math.sin(c.angle) * velocity;
          c.y -= Math.cos(c.angle) * velocity;

          // Draw fluffy compound cloud shapes
          ctx.beginPath();
          ctx.arc(c.x, c.y, c.radius, 0, Math.PI * 2);
          ctx.arc(c.x + c.radius * 0.5, c.y - c.radius * 0.2, c.radius * 0.8, 0, Math.PI * 2);
          ctx.arc(c.x - c.radius * 0.5, c.y - c.radius * 0.1, c.radius * 0.7, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(226, 232, 240, ${c.opacity})`;
          ctx.fill();

          // Warp clouds back
          if (c.x > size.x + c.radius * 2) c.x = -c.radius * 2;
          if (c.x < -c.radius * 2) c.x = size.x + c.radius * 2;
          if (c.y > size.y + c.radius * 2) c.y = -c.radius * 2;
          if (c.y < -c.radius * 2) c.y = size.y + c.radius * 2;
        });
      } 
      // --------------------------------------------------
      // LAYER 3: CONVECTIVE RAIN/SNOW RADAR OVERLAY
      // --------------------------------------------------
      else if (activeLayer === "radar") {
        ctx.clearRect(0, 0, size.x, size.y);

        // Radar Sweeper Simulator
        radarSweepAngle.current = (radarSweepAngle.current + 0.02 * dt) % (Math.PI * 2);
        
        // Draw circular radar sweep
        const radarCenter = { x: size.x / 2, y: size.y / 2 };
        const radarMaxRadius = Math.max(size.x, size.y) * 0.45;

        // Draw sweeping radar gradient cone
        const radarGrad = ctx.createRadialGradient(radarCenter.x, radarCenter.y, 5, radarCenter.x, radarCenter.y, radarMaxRadius);
        radarGrad.addColorStop(0, "rgba(6, 182, 212, 0.15)");
        radarGrad.addColorStop(0.8, "rgba(6, 182, 212, 0.02)");
        radarGrad.addColorStop(1, "rgba(6, 182, 212, 0)");

        ctx.fillStyle = radarGrad;
        ctx.beginPath();
        ctx.arc(radarCenter.x, radarCenter.y, radarMaxRadius, 0, Math.PI * 2);
        ctx.fill();

        // Draw radar sweep line
        ctx.strokeStyle = "rgba(6, 182, 212, 0.4)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(radarCenter.x, radarCenter.y);
        ctx.lineTo(
          radarCenter.x + Math.cos(radarSweepAngle.current) * radarMaxRadius,
          radarCenter.y + Math.sin(radarSweepAngle.current) * radarMaxRadius
        );
        ctx.stroke();

        // Overlay Doppler convective cells (simulating heavy storms/rain cells)
        const cellCenters = [
          { x: radarCenter.x - 120, y: radarCenter.y + 40, r: 50, intensity: 0.8 },
          { x: radarCenter.x + 80, y: radarCenter.y - 120, r: 85, intensity: 0.65 },
          { x: radarCenter.x + 150, y: radarCenter.y + 110, r: 35, intensity: 0.9 }
        ];

        cellCenters.forEach((cell, idx) => {
          // Dynamic breath / swell factor of radar reflection
          const scale = 1 + Math.sin(radarSweepAngle.current * 2 + idx) * 0.08;
          const currRad = cell.r * scale;

          const cellGrad = ctx.createRadialGradient(cell.x, cell.y, 2, cell.x, cell.y, currRad);
          // Standard radar reflectivities DBZ levels: Red (Extreme) -> Orange -> Yellow -> Green (Light)
          cellGrad.addColorStop(0, "rgba(225, 29, 72, 0.75)"); // Magenta/Red heavy storm core
          cellGrad.addColorStop(0.3, "rgba(249, 115, 22, 0.6)"); // Orange moderate rain
          cellGrad.addColorStop(0.6, "rgba(234, 179, 8, 0.45)"); // Yellow light rain
          cellGrad.addColorStop(1, "rgba(34, 197, 94, 0.0)"); // Green edge

          ctx.fillStyle = cellGrad;
          ctx.beginPath();
          ctx.arc(cell.x, cell.y, currRad, 0, Math.PI * 2);
          ctx.fill();

          // Add small blinking lightning strike in convective cores
          if (Math.random() > 0.982 && cell.intensity > 0.75) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2.5;
            ctx.shadowColor = "#38bdf8";
            ctx.shadowBlur = 15;
            ctx.beginPath();
            ctx.moveTo(cell.x, cell.y - 15);
            ctx.lineTo(cell.x - 8, cell.y + 2);
            ctx.lineTo(cell.x + 5, cell.y);
            ctx.lineTo(cell.x - 2, cell.y + 18);
            ctx.stroke();
            ctx.shadowBlur = 0; // reset
          }
        });
      } 
      // --------------------------------------------------
      // LAYER 4: TROPICAL CYCLONE/HURRICANE STORM TRACKS
      // --------------------------------------------------
      else if (activeLayer === "storm") {
        ctx.clearRect(0, 0, size.x, size.y);

        const center = { x: size.x / 2 + 100, y: size.y / 2 - 20 };
        
        // Hurricane Swirl Animation
        radarSweepAngle.current = (radarSweepAngle.current + 0.06 * dt) % (Math.PI * 2);

        // Cone of Uncertainty (glowing orange/red polygon)
        ctx.fillStyle = "rgba(239, 68, 68, 0.06)";
        ctx.strokeStyle = "rgba(239, 68, 68, 0.25)";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        
        ctx.beginPath();
        ctx.moveTo(center.x - 180, center.y + 160);
        ctx.lineTo(center.x, center.y); // hurricane center
        ctx.lineTo(center.x + 120, center.y - 130);
        ctx.arc(center.x - 30, center.y + 15, 230, -Math.PI/6, Math.PI/1.8);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.setLineDash([]); // reset

        // Draw Historical Track points
        const trackPoints = [
          { x: center.x - 140, y: center.y + 120, name: "T-24h (Cat 2)" },
          { x: center.x - 70, y: center.y + 60, name: "T-12h (Cat 3)" },
          { x: center.x, y: center.y, name: "EYE (Cat 4)" }
        ];

        ctx.strokeStyle = "rgba(239, 68, 68, 0.6)";
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        trackPoints.forEach((pt, idx) => {
          if (idx === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        });
        ctx.stroke();

        trackPoints.forEach((pt) => {
          ctx.fillStyle = "#ef4444";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 5, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = "#ffffff";
          ctx.font = "9px JetBrains Mono";
          ctx.fillText(pt.name, pt.x + 8, pt.y + 3);
        });

        // Swirling Cyclone vectors (glowing white spirals)
        ctx.strokeStyle = "rgba(244, 63, 94, 0.8)";
        ctx.lineWidth = 2;
        ctx.shadowColor = "#f43f5e";
        ctx.shadowBlur = 10;
        
        for (let i = 0; i < 4; i++) {
          const startAngle = radarSweepAngle.current + (i * Math.PI) / 2;
          ctx.beginPath();
          for (let r = 8; r < 55; r += 1) {
            const currentAngle = startAngle + r * 0.08;
            const x = center.x + Math.cos(currentAngle) * r;
            const y = center.y + Math.sin(currentAngle) * r;
            if (r === 8) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.shadowBlur = 0; // Reset

        // Cyclone Eye details
        ctx.fillStyle = "#ffffff";
        ctx.font = "bold 10px Inter";
        ctx.fillText("TYPHOON NYE", center.x - 35, center.y - 12);
      } 
      // --------------------------------------------------
      // LAYER 5: BAROMETRIC PRESSURE ISOBARS
      // --------------------------------------------------
      else if (activeLayer === "pressure") {
        ctx.clearRect(0, 0, size.x, size.y);
        
        const pressure = weatherData.weather.current.pressure_msl || 1012;
        ctx.strokeStyle = "rgba(168, 85, 247, 0.4)"; // Purple isobars
        ctx.lineWidth = 1.5;
        ctx.fillStyle = "rgba(168, 85, 247, 0.65)";
        ctx.font = "10px JetBrains Mono";

        for (let d = 80; d < Math.max(size.x, size.y); d += 110) {
          const isobarVal = Math.round(pressure - (d / 110) * 4);
          ctx.beginPath();
          ctx.arc(size.x / 2, size.y / 2, d, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillText(`${isobarVal} hPa`, size.x / 2 + d * 0.707, size.y / 2 + d * 0.707);
        }

        ctx.fillStyle = "rgba(168, 85, 247, 0.08)";
        ctx.beginPath();
        ctx.arc(size.x / 2, size.y / 2, 40, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#a855f7";
        ctx.font = "bold 14px Inter";
        ctx.fillText(pressure > 1013 ? "H" : "L", size.x / 2 - 5, size.y / 2 + 5);
      }

      animationFrameId.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      map.off("resize move", resizeCanvas);
      if (canvasLayerRef.current && pane.contains(canvasLayerRef.current)) {
        pane.removeChild(canvasLayerRef.current);
      }
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [mapLoaded, activeLayer, isPlayingAnimation, weatherData, provider, animationSpeed, overlayOpacity]);

  return (
    <div className="relative w-full h-full rounded-2xl overflow-hidden border border-slate-900 shadow-2xl bg-slate-950 flex flex-col" id="met-gis-visualizer">
      
      {/* 1. GIS Layer Control Panel */}
      <div className="absolute top-4 left-4 z-[1000] flex flex-col gap-2 max-w-[90%] md:max-w-md">
        
        {/* Layer select tabs */}
        <div className="bg-slate-950/90 backdrop-blur-md px-1.5 py-1.5 rounded-xl border border-slate-900 flex flex-wrap gap-1 shadow-2xl">
          <button
            onClick={() => setActiveLayer("wind")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              activeLayer === "wind" ? "bg-cyan-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Navigation className="h-3 w-3 rotate-45" />
            Wind Flow
          </button>
          
          <button
            onClick={() => setActiveLayer("clouds")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              activeLayer === "clouds" ? "bg-slate-200 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Cloud className="h-3 w-3" />
            Cloud Drifts
          </button>

          <button
            onClick={() => setActiveLayer("radar")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              activeLayer === "radar" ? "bg-rose-500 text-white shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Layers className="h-3 w-3" />
            Convective Radar
          </button>

          <button
            onClick={() => setActiveLayer("storm")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              activeLayer === "storm" ? "bg-amber-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Compass className="h-3 w-3 animate-spin-slow" />
            Storm Tracking
          </button>

          <button
            onClick={() => setActiveLayer("pressure")}
            className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all duration-200 flex items-center gap-1.5 ${
              activeLayer === "pressure" ? "bg-purple-500 text-slate-950 shadow" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Sliders className="h-3 w-3" />
            MSL Isobars
          </button>
        </div>

        {/* Dynamic configuration options bar */}
        <div className="bg-slate-950/90 backdrop-blur-md p-3 rounded-xl border border-slate-900 flex flex-col gap-2.5 shadow-2xl">
          {/* Tile Provider Select */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-[10px] text-slate-400 font-mono font-medium">Map Engine Basemap:</span>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value as MapProvider)}
              className="bg-slate-900 border border-slate-800 text-[10px] font-mono text-cyan-400 rounded-lg px-2 py-1 outline-none focus:border-cyan-500"
            >
              <option value="carto-dark">Sleek Carto Dark</option>
              <option value="osm">Standard OpenStreetMap</option>
              <option value="esri-satellite">Esri World Satellite</option>
              <option value="opentopo">OpenTopo Relief Map</option>
              <option value="mapbox-dark">Mapbox Carbon Dark</option>
            </select>
          </div>

          {/* Opacity & Speed adjustments */}
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-900 text-[9px] font-mono">
            <div className="flex flex-col gap-1">
              <span className="text-slate-500 flex justify-between">
                <span>Opacity:</span>
                <span className="text-slate-300">{(overlayOpacity * 100).toFixed(0)}%</span>
              </span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={overlayOpacity}
                onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-400"
              />
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-slate-500 flex justify-between">
                <span>Speed Step:</span>
                <span className="text-slate-300">{animationSpeed}x</span>
              </span>
              <div className="flex gap-1">
                {[0.5, 1.0, 2.0].map((v) => (
                  <button
                    key={v}
                    onClick={() => setAnimationSpeed(v)}
                    className={`flex-1 py-0.5 rounded border border-slate-800 text-[8px] transition-all font-bold ${
                      animationSpeed === v ? "bg-cyan-500/10 text-cyan-400 border-cyan-500/30" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {v}x
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Controls Panel on the Top Right */}
      <div className="absolute top-4 right-4 z-[1000]">
        <button
          onClick={() => setIsPlayingAnimation(!isPlayingAnimation)}
          className="bg-slate-950/95 backdrop-blur-md p-3 rounded-xl border border-slate-900 text-slate-300 hover:text-white transition-all shadow-2xl flex items-center justify-center gap-1.5 font-semibold text-[10px]"
          title={isPlayingAnimation ? "Pause Simulation Engine" : "Start Simulation Engine"}
        >
          {isPlayingAnimation ? <Pause className="h-4.5 w-4.5 text-rose-500 animate-pulse" /> : <Play className="h-4.5 w-4.5 text-emerald-400" />}
          <span>{isPlayingAnimation ? "LIVE STREAM" : "STOPPED"}</span>
        </button>
      </div>

      {/* 3. Dynamic Layer Info card */}
      <div className="absolute bottom-4 left-4 z-[1000] bg-slate-950/95 backdrop-blur-md px-4 py-3.5 rounded-xl border border-slate-900 shadow-2xl max-w-[270px] pointer-events-auto flex flex-col gap-2">
        <h4 className="text-[10px] font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5 text-cyan-400 animate-pulse" />
          {activeLayer === "wind" && "High-Velocity Streamlines"}
          {activeLayer === "clouds" && "Drifting Cumulus Overlay"}
          {activeLayer === "radar" && "Rain/Snow Convective Radar"}
          {activeLayer === "storm" && "Hurricane Vortex Analyzer"}
          {activeLayer === "pressure" && "MSL Barometric Isobars"}
        </h4>
        <p className="text-[9px] text-slate-400 leading-relaxed font-mono">
          {activeLayer === "wind" && "Renders live direction particles across grids. Responsive wind friction vector parameters apply based on current node velocity."}
          {activeLayer === "clouds" && "Generates realistic thermodynamic white clouds moving based on real-time synoptic wind speeds and vectors."}
          {activeLayer === "radar" && "Live Doppler sweep simulation showcasing deep storm core reflectivity DBZ levels. Lightning strike simulation included."}
          {activeLayer === "storm" && "Visualizes storm paths, wind swirls, and cone of uncertainty projections for active low-pressure cyclones."}
          {activeLayer === "pressure" && "Translates localized pressure anomalies into purple concentric isobar bars to isolate weather front bounds."}
        </p>
        <div className="pt-2 border-t border-slate-900 flex items-center justify-between text-[9px] text-slate-500 font-mono">
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 text-cyan-500" />
            Lat: {lat}
          </span>
          <span>Lon: {lon}</span>
        </div>
      </div>

      {/* Leaflet map container */}
      <div ref={mapContainerRef} className="w-full flex-grow z-0 min-h-[460px]" />

      {/* Map Hint / Status bar */}
      <div className="bg-slate-950 border-t border-slate-900 px-4 py-2.5 flex items-center justify-between text-[9px] text-slate-500 font-mono">
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse" />
          Click anywhere on the GIS grid to dispatch new coordinate coordinates.
        </span>
        <span className="hidden sm:inline">Proj: EPSG:3857 (Mercator Spherical)</span>
      </div>
    </div>
  );
}
