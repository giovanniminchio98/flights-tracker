import { useEffect, useState } from "react";
import type { FlightRecord } from "@/types";
import { getAirport, distanceKm } from "@/lib/airports";
import { formatDuration, formatTimeShort, isNextDay } from "@/lib/dateUtils";
import { formatRelative, isClose } from "@/lib/countdown";
import { formatDistance } from "@/lib/units";
import { useUnits } from "@/lib/UnitsContext";
import { useNow } from "@/lib/useNow";
import { getArrivalWeather, type ArrivalWeather } from "@/lib/weather";

function durationMinutes(f: FlightRecord): number | null {
  const d = (new Date(f.arrivalTime).getTime() - new Date(f.departureTime).getTime()) / 60000;
  return Number.isFinite(d) && d > 0 ? d : null;
}

// Same economy factor as stats.ts, kept local to avoid a circular import.
const CO2_KG_PER_KM = 0.09;

function Leg({
  arrow,
  code,
  city,
  time,
  nextDay,
  relLabel,
  relValue,
  green,
}: {
  arrow: string;
  code: string;
  city?: string;
  time: string;
  nextDay?: boolean;
  relLabel: string;
  relValue: string;
  green: boolean;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted">
        <span>{arrow}</span>
        <span className="font-medium text-ink">{code}</span>
        {city && <span>· {city}</span>}
      </div>
      <div className={`mt-0.5 text-2xl font-bold leading-none ${green ? "text-emerald-400" : "text-ink"}`}>
        {time}
        {nextDay && <sup className="ml-0.5 text-xs text-muted">+1</sup>}
      </div>
      <div className="mt-1 text-xs text-muted">
        {relLabel} <span className={green ? "text-emerald-400" : "text-ink"}>{relValue}</span>
      </div>
    </div>
  );
}

export function FlightDetail({ flight }: { flight: FlightRecord }) {
  const { units } = useUnits();
  const now = useNow();
  const [weather, setWeather] = useState<ArrivalWeather | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);

  const depInfo = getAirport(flight.departureAirport);
  const arrInfo = getAirport(flight.arrivalAirport);
  const km = distanceKm(flight.departureAirport, flight.arrivalAirport);
  const mins = durationMinutes(flight);

  const depMs = new Date(flight.departureTime).getTime();
  const arrMs = new Date(flight.arrivalTime).getTime();
  const green = isClose(flight.departureTime, now);

  const depRel = formatRelative(flight.departureTime, now);
  const arrRel = formatRelative(flight.arrivalTime, now);

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
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <Leg
        arrow="↗"
        code={flight.departureAirport}
        city={depInfo?.city}
        time={formatTimeShort(flight.departureTime)}
        relLabel={now >= depMs ? "Departed" : "Departs in"}
        relValue={now >= depMs ? depRel.str + " ago" : depRel.str}
        green={green && now < depMs}
      />

      <div className="flex items-center gap-2 text-xs text-muted">
        {mins != null && <span>{formatDuration(mins)}</span>}
        {km != null && (
          <>
            <span>·</span>
            <span>{formatDistance(km, units)}</span>
          </>
        )}
        {km != null && (
          <>
            <span>·</span>
            <span>CO₂ {Math.round(km * CO2_KG_PER_KM).toLocaleString()} kg</span>
          </>
        )}
        <div className="ml-1 h-px flex-1 bg-line" />
      </div>

      <Leg
        arrow="↘"
        code={flight.arrivalAirport}
        city={arrInfo?.city}
        time={formatTimeShort(flight.arrivalTime)}
        nextDay={isNextDay(flight.departureTime, flight.arrivalTime)}
        relLabel={now >= arrMs ? "Arrived" : "Arrives in"}
        relValue={now >= arrMs ? arrRel.str + " ago" : arrRel.str}
        green={green && now < arrMs}
      />

      {arrInfo && (
        <div className="rounded-lg bg-white/5 px-3 py-2 text-xs">
          <div className="text-muted">Weather at arrival ({flight.arrivalAirport})</div>
          {weatherLoading ? (
            <div className="text-muted">Checking…</div>
          ) : weather ? (
            <div className="text-slate-200">
              {weather.emoji} {weather.label}, {weather.tempC}°C{" "}
              <span className="text-muted">{weather.isForecast ? "(forecast)" : "(recorded)"}</span>
            </div>
          ) : (
            <div className="text-muted">Available within ~7 days of the flight.</div>
          )}
        </div>
      )}

      {flight.confirmationCode && (
        <div className="text-xs text-muted">
          Confirmation <span className="font-medium text-ink">{flight.confirmationCode}</span>
        </div>
      )}
    </div>
  );
}
