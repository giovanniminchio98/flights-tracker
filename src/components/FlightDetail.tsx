import { useEffect, useState } from "react";
import type { FlightRecord } from "@/types";
import { getAirport, distanceKm } from "@/lib/airports";
import { formatDateTime, formatDuration } from "@/lib/dateUtils";
import { formatDistance } from "@/lib/units";
import { useUnits } from "@/lib/UnitsContext";
import { getArrivalWeather, type ArrivalWeather } from "@/lib/weather";

function durationMinutes(f: FlightRecord): number | null {
  const d = (new Date(f.arrivalTime).getTime() - new Date(f.departureTime).getTime()) / 60000;
  return Number.isFinite(d) && d > 0 ? d : null;
}

// Same economy factor as stats.ts, kept local to avoid a circular import.
const CO2_KG_PER_KM = 0.09;

export function FlightDetail({ flight }: { flight: FlightRecord }) {
  const { units } = useUnits();
  const [weather, setWeather] = useState<ArrivalWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const depInfo = getAirport(flight.departureAirport);
  const arrInfo = getAirport(flight.arrivalAirport);
  const km = distanceKm(flight.departureAirport, flight.arrivalAirport);
  const mins = durationMinutes(flight);

  useEffect(() => {
    let cancelled = false;
    setWeather(null);
    if (!arrInfo) return;
    setWeatherLoading(true);
    getArrivalWeather(flight.arrivalAirport, flight.arrivalTime)
      .then((w) => {
        if (!cancelled) setWeather(w);
      })
      .finally(() => {
        if (!cancelled) setWeatherLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [flight.arrivalAirport, flight.arrivalTime, arrInfo]);

  return (
    <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="text-xs text-slate-400">From</div>
          <div className="font-medium text-ink">{flight.departureAirport}</div>
          {depInfo && <div className="text-xs text-slate-500">{depInfo.city}</div>}
          <div className="mt-1 text-xs text-slate-500">{formatDateTime(flight.departureTime)}</div>
        </div>
        <div>
          <div className="text-xs text-slate-400">To</div>
          <div className="font-medium text-ink">{flight.arrivalAirport}</div>
          {arrInfo && <div className="text-xs text-slate-500">{arrInfo.city}</div>}
          <div className="mt-1 text-xs text-slate-500">{formatDateTime(flight.arrivalTime)}</div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
        {mins != null && (
          <span>
            Duration <span className="font-medium text-ink">{formatDuration(mins)}</span>
          </span>
        )}
        {km != null && (
          <span>
            Distance <span className="font-medium text-ink">{formatDistance(km, units)}</span>
          </span>
        )}
        {km != null && (
          <span>
            CO₂ ≈ <span className="font-medium text-ink">{Math.round(km * CO2_KG_PER_KM).toLocaleString()} kg</span>
          </span>
        )}
        {flight.confirmationCode && (
          <span>
            Conf. <span className="font-medium text-ink">{flight.confirmationCode}</span>
          </span>
        )}
      </div>

      {arrInfo && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <div className="text-slate-400">Weather at arrival ({flight.arrivalAirport})</div>
          {weatherLoading ? (
            <div className="text-slate-400">Checking…</div>
          ) : weather ? (
            <div className="text-slate-700">
              {weather.emoji} {weather.label}, {weather.tempC}°C{" "}
              <span className="text-slate-400">{weather.isForecast ? "(forecast)" : "(recorded)"}</span>
            </div>
          ) : (
            <div className="text-slate-400">Available within ~7 days of the flight.</div>
          )}
        </div>
      )}
    </div>
  );
}
