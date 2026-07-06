import React, { useEffect, useRef, useState } from "react";
import { WeatherData } from "../types";

interface WeatherParticlesProps {
  weatherData: WeatherData | null;
}

type WeatherMode = "clear" | "cloudy" | "rain" | "snow" | "thunderstorm" | "fog";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  color: string;
  extra?: any; // To hold specific attributes like angle, wobble, etc.
}

export default function WeatherParticles({ weatherData }: WeatherParticlesProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [weatherMode, setWeatherMode] = useState<WeatherMode>("clear");
  const [windSpeed, setWindSpeed] = useState<number>(5); // default 5 km/h

  // Classify weather code and telemetry indicators into a specific particle system mode
  useEffect(() => {
    if (!weatherData || !weatherData.weather || !weatherData.weather.current) {
      setWeatherMode("clear");
      setWindSpeed(5);
      return;
    }

    const current = weatherData.weather.current;
    const code = current.weather_code;
    setWindSpeed(current.wind_speed_10m || 5);

    if ([95, 96, 99].includes(code)) {
      setWeatherMode("thunderstorm");
    } else if ([71, 73, 75, 77, 85, 86].includes(code) || current.snowfall > 0) {
      setWeatherMode("snow");
    } else if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code) || current.rain > 0 || current.showers > 0) {
      setWeatherMode("rain");
    } else if ([45, 48].includes(code)) {
      setWeatherMode("fog");
    } else if ([1, 2, 3].includes(code)) {
      setWeatherMode("cloudy");
    } else {
      setWeatherMode("clear");
    }
  }, [weatherData]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    let particles: Particle[] = [];
    let width = canvas.width;
    let height = canvas.height;

    // Handle resizing using a ResizeObserver to avoid window-based layout drift
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // Debounce slightly or run synchronously on animation frames
        const { width: entryWidth, height: entryHeight } = entry.contentRect;
        width = entryWidth;
        height = entryHeight;
        canvas.width = entryWidth;
        canvas.height = entryHeight;
        // Re-init particles on size reset to distribute them nicely
        initParticles();
      }
    });

    resizeObserver.observe(container);

    // Initialize particle attributes according to active weather mode
    const initParticles = () => {
      particles = [];
      let count = 60;

      if (weatherMode === "rain") count = 120;
      if (weatherMode === "snow") count = 80;
      if (weatherMode === "thunderstorm") count = 140;
      if (weatherMode === "fog") count = 25;
      if (weatherMode === "cloudy") count = 40;
      if (weatherMode === "clear") count = 30;

      for (let i = 0; i < count; i++) {
        particles.push(createParticle(true));
      }
    };

    const createParticle = (randomY = false): Particle => {
      const pX = Math.random() * width;
      const pY = randomY ? Math.random() * height : -10;

      // Map wind speed (km/h) to base drift speed
      const baseWindDrift = (windSpeed / 10) * 0.5;

      switch (weatherMode) {
        case "rain": {
          const length = 12 + Math.random() * 15;
          const speedY = 8 + Math.random() * 6;
          return {
            x: pX,
            y: pY,
            vx: -1.5 - baseWindDrift + (Math.random() * 0.5),
            vy: speedY,
            size: 1 + Math.random() * 1.5,
            opacity: 0.2 + Math.random() * 0.4,
            color: "rgba(6, 182, 212, 0.45)", // cyan atmospheric glow
            extra: { length }
          };
        }
        case "snow": {
          return {
            x: pX,
            y: pY,
            vx: -0.5 - baseWindDrift + Math.random() * 1.0,
            vy: 1.0 + Math.random() * 1.5,
            size: 1.8 + Math.random() * 3.5,
            opacity: 0.3 + Math.random() * 0.5,
            color: "rgba(224, 242, 254, 0.7)", // sky-100 ice crystals
            extra: {
              wobbleSpeed: 0.01 + Math.random() * 0.03,
              wobbleRange: 1 + Math.random() * 2,
              angle: Math.random() * Math.PI * 2
            }
          };
        }
        case "thunderstorm": {
          const length = 16 + Math.random() * 18;
          const speedY = 12 + Math.random() * 8;
          return {
            x: pX,
            y: pY,
            vx: -2.0 - baseWindDrift + (Math.random() * 0.5),
            vy: speedY,
            size: 1.2 + Math.random() * 1.8,
            opacity: 0.35 + Math.random() * 0.45,
            color: "rgba(168, 85, 247, 0.45)", // purple hazard streaks
            extra: { length }
          };
        }
        case "fog": {
          return {
            x: pX,
            y: Math.random() * height,
            vx: (Math.random() - 0.5) * 0.4 - (windSpeed / 25),
            vy: (Math.random() - 0.5) * 0.1,
            size: 50 + Math.random() * 80,
            opacity: 0.04 + Math.random() * 0.06,
            color: "rgba(148, 163, 184, 0.25)", // slate mist spheres
            extra: {
              pulseSpeed: 0.002 + Math.random() * 0.005,
              maxOpacity: 0.08 + Math.random() * 0.04
            }
          };
        }
        case "cloudy": {
          return {
            x: pX,
            y: Math.random() * (height * 0.6), // stay in upper atmosphere mostly
            vx: -0.25 - (windSpeed / 30) + (Math.random() * 0.1),
            vy: (Math.random() - 0.5) * 0.05,
            size: 30 + Math.random() * 50,
            opacity: 0.03 + Math.random() * 0.05,
            color: "rgba(100, 116, 139, 0.2)",
            extra: {}
          };
        }
        case "clear":
        default: {
          // Soft glowing micro-climatic or thermal elements drifting upwards gently
          return {
            x: pX,
            y: randomY ? Math.random() * height : height + 10,
            vx: (Math.random() - 0.5) * 0.3,
            vy: -0.4 - Math.random() * 0.6,
            size: 1.5 + Math.random() * 2.5,
            opacity: 0.1 + Math.random() * 0.2,
            color: "rgba(251, 191, 36, 0.35)", // golden sunbeams glow
            extra: {
              pulseSpeed: 0.01 + Math.random() * 0.02,
              angle: Math.random() * Math.PI * 2
            }
          };
        }
      }
    };

    let flashCounter = 0;
    let flashOpacity = 0;

    const drawAndUpdate = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Handle dynamic thunderstorm lightning flashes
      if (weatherMode === "thunderstorm") {
        if (flashOpacity > 0) {
          ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
          ctx.fillRect(0, 0, width, height);
          flashOpacity -= 0.05; // fade lightning
        } else {
          // Rare trigger chance
          if (Math.random() < 0.002) {
            flashOpacity = 0.25 + Math.random() * 0.25;
          }
        }
      }

      // 2. Render and tick each particle
      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Draw particle based on classified mode
        ctx.fillStyle = p.color;
        ctx.globalAlpha = p.opacity;

        if (weatherMode === "rain" || weatherMode === "thunderstorm") {
          ctx.beginPath();
          ctx.lineWidth = p.size;
          ctx.strokeStyle = p.color;
          ctx.moveTo(p.x, p.y);
          // Draw streak angled with horizontal velocity
          ctx.lineTo(p.x + p.vx * 1.5, p.y + p.extra.length);
          ctx.stroke();
        } else if (weatherMode === "snow") {
          ctx.beginPath();
          // Circular snowflake shape
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else if (weatherMode === "fog" || weatherMode === "cloudy") {
          // Radial gradient for fluffy mist sphere to prevent sharp edges
          const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
          grad.addColorStop(0, p.color);
          grad.addColorStop(0.5, p.color.replace("0.25", "0.08").replace("0.2", "0.05"));
          grad.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = grad;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Clear mode golden glowing ambient dust
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fill();
        }

        // Reset globalAlpha to clear out particle context settings safely
        ctx.globalAlpha = 1.0;

        // Particle kinematics & boundary checking
        p.x += p.vx;
        p.y += p.vy;

        // Mode-specific micro-animations
        if (weatherMode === "snow" && p.extra) {
          p.extra.angle += p.extra.wobbleSpeed;
          p.x += Math.sin(p.extra.angle) * p.extra.wobbleRange * 0.15;
        }

        if (weatherMode === "fog" && p.extra) {
          p.opacity += (Math.random() - 0.5) * 0.002;
          p.opacity = Math.max(0.01, Math.min(p.opacity, p.extra.maxOpacity));
        }

        if (weatherMode === "clear" && p.extra) {
          p.extra.angle += p.extra.pulseSpeed;
          p.opacity = 0.08 + Math.abs(Math.sin(p.extra.angle)) * 0.18;
        }

        // Bound check: Recycle particle if it drifts off layout bounds
        let isOutOfBounds = false;
        if (weatherMode === "clear") {
          isOutOfBounds = p.y < -20 || p.x < -30 || p.x > width + 30;
        } else {
          isOutOfBounds = p.y > height + 20 || p.x < -100 || p.x > width + 100;
        }

        if (isOutOfBounds) {
          particles[i] = createParticle(false);
        }
      }

      animationFrameId = requestAnimationFrame(drawAndUpdate);
    };

    initParticles();
    drawAndUpdate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      resizeObserver.disconnect();
    };
  }, [weatherMode, windSpeed]);

  return (
    <div
      ref={containerRef}
      className="absolute inset-0 pointer-events-none z-[50] overflow-hidden"
      id="meteor-particle-canvas-container"
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full block opacity-30 mix-blend-screen transition-opacity duration-1000"
      />
    </div>
  );
}
