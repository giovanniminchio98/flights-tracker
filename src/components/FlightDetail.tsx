import { useEffect, useState } from "react";
import type { FlightRecord } from "@/types";
import { getAirport, distanceKm } from "@/lib/airports";
import { formatDuration, formatTimeShort, isNextDay, tzAbbrev, localTimeZone } from "@/lib/dateUtils";
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
  tzLabel,
  yourTime,
  nextDay,
  relLabel,
  relValue,
  green,
}: {
  arrow: string;
  code: string;
  city?: string;
  time: string;
  /** Short zone label for the big (airport-local) time, e.g. "GMT+2". */
  tzLabel?: string;
  /** The same moment in the viewer's own timezone, shown small underneath.
   * Omitted when the airport is already in the viewer's timezone. */
  yourTime?: string;
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
      <div className={`mt-0.5 flex items-baseline gap-1.5 ${green ? "text-neon-green" : "text-ink"}`}>
        <span className="text-2xl font-bold leading-none">
          {time}
          {nextDay && <sup className="ml-0.5 text-xs text-muted">+1</sup>}
        </span>
        {tzLabel && <span className="text-[11px] font-medium text-muted">{tzLabel}</span>}
      </div>
      {yourTime && <div className="mt-0.5 text-[11px] text-muted">{yourTime} your time</div>}
      <div className="mt-1 text-xs text-muted">
        {relLabel} <span className={green ? "text-neon-green" : "text-ink"}>{relValue}</span>
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

  // Show each time in its own airport's local zone; only add the small "your
  // time" line when that airport is in a different zone than the viewer.
  const viewerTz = localTimeZone();
  const depTz = depInfo?.tz;
  const arrTz = arrInfo?.tz;
  const depYourTime = depTz && depTz !== viewerTz ? formatTimeShort(flight.departureTime) : undefined;
  const arrYourTime = arrTz && arrTz !== viewerTz ? formatTimeShort(flight.arrivalTime) : undefined;

  const depRel = formatRelative(flight.departureTime, now);
  const arrRel = formatRelative(flight.arrivalTime, now);

  // Depend only on the two primitive inputs. `arrInfo` used to be in here, but
  // getAirport() builds a fresh object every call, so its identity changed on
  // every countdown tick — the effect re-ran every 20s, blanked the weather and
  // refetched, which is why it never settled.
  const hasArrivalAirport = arrInfo != null;
  useEffect(() => {
    if (!hasArrivalAirport) return;
    let cancelled = false;
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
  }, [flight.arrivalAirport, flight.arrivalTime, hasArrivalAirport]);

  return (
    <div className="mt-3 space-y-3 border-t border-line pt-3">
      <Leg
        arrow="↗"
        code={flight.departureAirport}
        city={depInfo?.city}
        time={formatTimeShort(flight.departureTime, depTz)}
        tzLabel={tzAbbrev(flight.departureTime, depTz)}
        yourTime={depYourTime}
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
            <span title="Estimated economy-class emissions for one traveller (you), not the whole aircraft">
              CO₂ {Math.round(km * CO2_KG_PER_KM).toLocaleString()} kg
              <span className="text-muted/70"> /you</span>
            </span>
          </>
        )}
        <div className="ml-1 h-px flex-1 bg-line" />
      </div>

      <Leg
        arrow="↘"
        code={flight.arrivalAirport}
        city={arrInfo?.city}
        time={formatTimeShort(flight.arrivalTime, arrTz)}
        tzLabel={tzAbbrev(flight.arrivalTime, arrTz)}
        yourTime={arrYourTime}
        nextDay={isNextDay(flight.departureTime, flight.arrivalTime, depTz, arrTz)}
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
            <div className="text-ink">
              {weather.emoji} {weather.label}, {weather.tempC}°C{" "}
              <span className="text-muted">{weather.isForecast ? "(forecast)" : "(recorded)"}</span>
            </div>
          ) : (
            <div className="text-muted">Available up to ~16 days before the flight.</div>
          )}
        </div>
      )}

      {/* The three things you need to look this flight up again — airline,
       * flight number and booking reference. Only the fields we actually have
       * are shown. */}
      {(flight.airline || flight.flightNumber || flight.confirmationCode) && (
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <div className="mb-1.5 text-[11px] uppercase tracking-wide text-muted">To find this flight again</div>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-xs">
            {flight.airline && (
              <div>
                <div className="text-muted">Airline</div>
                <div className="font-medium text-ink">{flight.airline}</div>
              </div>
            )}
            {flight.flightNumber && (
              <div>
                <div className="text-muted">Flight no.</div>
                <div className="font-medium text-ink">{flight.flightNumber}</div>
              </div>
            )}
            {flight.confirmationCode && (
              <div>
                <div className="text-muted">Confirmation</div>
                <div className="font-mono font-medium text-ink">{flight.confirmationCode}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
