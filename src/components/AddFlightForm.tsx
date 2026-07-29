import { useMemo, useState } from "react";
import { addFlight, getFlights } from "@/lib/localFlightStore";
import { isKnownAirlineCode, lookupAirline } from "@/lib/airlines";
import { getFlightNumberSuggestions, type FlightSuggestion } from "@/lib/flightSuggestions";
import { projectFlightTimes, toDateInputValue, toDateTimeLocalValue } from "@/lib/dateUtils";

type Step = "number" | "date" | "details";

interface HistoricalTimes {
  departureTime: string;
  arrivalTime: string;
}

function detectAirline(flightNumber: string): string | null {
  const code = flightNumber.match(/^[A-Z0-9]{2}/)?.[0];
  if (!code || !isKnownAirlineCode(code)) return null;
  return lookupAirline(code);
}

export function AddFlightForm({ onAdded, onClose }: { onAdded: () => void; onClose: () => void }) {
  const [step, setStep] = useState<Step>("number");
  const [flightNumber, setFlightNumber] = useState("");
  const [airline, setAirline] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [arrivalAirport, setArrivalAirport] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [historicalTimes, setHistoricalTimes] = useState<HistoricalTimes | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggestions = useMemo(
    () => getFlightNumberSuggestions(flightNumber, getFlights()),
    [flightNumber]
  );
  const liveAirline = useMemo(() => detectAirline(flightNumber), [flightNumber]);

  function applySuggestion(s: FlightSuggestion) {
    setFlightNumber(s.flightNumber);
    setAirline(s.airline);
    setDepartureAirport(s.departureAirport);
    setArrivalAirport(s.arrivalAirport);
    setHistoricalTimes({ departureTime: s.departureTime, arrivalTime: s.arrivalTime });
    setStep("date");
  }

  function proceedFromNumberStep() {
    if (!flightNumber.trim()) return;
    const exactMatch = suggestions.find((s) => s.flightNumber === flightNumber);
    if (exactMatch) {
      applySuggestion(exactMatch);
      return;
    }
    setAirline(liveAirline ?? "");
    setStep("details");
  }

  function switchToManualDetails() {
    if (historicalTimes) {
      setDepartureTime(toDateTimeLocalValue(historicalTimes.departureTime));
      setArrivalTime(toDateTimeLocalValue(historicalTimes.arrivalTime));
    }
    setStep("details");
  }

  async function saveFlight(times: { departureTime: string; arrivalTime: string }) {
    setSubmitting(true);
    setError(null);
    try {
      addFlight({
        flightNumber,
        airline: airline || undefined,
        confirmationCode: confirmationCode || undefined,
        departureAirport,
        arrivalAirport,
        departureTime: times.departureTime,
        arrivalTime: times.arrivalTime,
      });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add flight");
    } finally {
      setSubmitting(false);
    }
  }

  function handleQuickDate(dateStr: string) {
    if (!historicalTimes) return;
    saveFlight(projectFlightTimes(dateStr, historicalTimes.departureTime, historicalTimes.arrivalTime));
  }

  function handleManualSubmit() {
    saveFlight({
      departureTime: new Date(departureTime).toISOString(),
      arrivalTime: new Date(arrivalTime).toISOString(),
    });
  }

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        {step === "number" && (
          <>
            <h2 className="mb-1 text-lg font-semibold text-ink">Add flight</h2>
            <p className="mb-4 text-sm text-slate-500">What's the flight number?</p>

            <input
              autoFocus
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && proceedFromNumberStep()}
              placeholder="AY1234"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-lg font-medium tracking-wide"
            />

            {liveAirline && suggestions.length === 0 && (
              <div className="mt-2 text-sm text-slate-500">{liveAirline}</div>
            )}

            {suggestions.length > 0 && (
              <div className="mt-2 overflow-hidden rounded-lg border border-slate-200">
                {suggestions.map((s) => (
                  <button
                    key={s.flightNumber}
                    onClick={() => applySuggestion(s)}
                    className="flex w-full items-center justify-between border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="font-medium text-ink">{s.flightNumber}</span>
                    <span className="text-slate-500">
                      {s.airline}
                      {s.departureAirport && s.arrivalAirport && (
                        <span className="ml-2 text-slate-400">
                          {s.departureAirport} → {s.arrivalAirport}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
              <button
                onClick={proceedFromNumberStep}
                disabled={!flightNumber.trim()}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Continue
              </button>
            </div>
          </>
        )}

        {step === "date" && (
          <>
            <button onClick={() => setStep("number")} className="mb-2 text-xs text-slate-400 hover:text-slate-600">
              ← Change flight number
            </button>
            <h2 className="mb-1 text-lg font-semibold text-ink">
              {airline || "Unknown airline"} <span className="font-mono text-base text-slate-500">{flightNumber}</span>
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              {departureAirport} → {arrivalAirport} · same times as last time. When are you flying?
            </p>

            <div className="grid grid-cols-2 gap-2">
              <button
                disabled={submitting}
                onClick={() => handleQuickDate(toDateInputValue(today))}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Today
              </button>
              <button
                disabled={submitting}
                onClick={() => handleQuickDate(toDateInputValue(tomorrow))}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Tomorrow
              </button>
            </div>

            <label className="mt-2 block text-sm">
              Or pick a date
              <input
                type="date"
                disabled={submitting}
                onChange={(e) => e.target.value && handleQuickDate(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm disabled:opacity-50"
              />
            </label>

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

            <div className="mt-5 flex items-center justify-between">
              <button onClick={switchToManualDetails} className="text-xs text-slate-400 hover:text-slate-600">
                Not right, or need exact times? Enter manually
              </button>
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
            </div>
          </>
        )}

        {step === "details" && (
          <>
            <button
              onClick={() => setStep(historicalTimes ? "date" : "number")}
              className="mb-2 text-xs text-slate-400 hover:text-slate-600"
            >
              ← Back
            </button>
            <h2 className="mb-4 text-lg font-semibold text-ink">
              {airline || "Unknown airline"} <span className="font-mono text-base text-slate-500">{flightNumber}</span>
            </h2>

            <div className="grid grid-cols-2 gap-3">
              <label className="col-span-1 text-sm">
                From (airport code)
                <input
                  required
                  value={departureAirport}
                  onChange={(e) => setDepartureAirport(e.target.value.toUpperCase())}
                  placeholder="JFK"
                  maxLength={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
                />
              </label>
              <label className="col-span-1 text-sm">
                To (airport code)
                <input
                  required
                  value={arrivalAirport}
                  onChange={(e) => setArrivalAirport(e.target.value.toUpperCase())}
                  placeholder="HEL"
                  maxLength={3}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase"
                />
              </label>
              <label className="col-span-2 text-sm">
                Departure time
                <input
                  required
                  type="datetime-local"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="col-span-2 text-sm">
                Arrival time
                <input
                  required
                  type="datetime-local"
                  value={arrivalTime}
                  onChange={(e) => setArrivalTime(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
              <label className="col-span-2 text-sm">
                Confirmation code (optional)
                <input
                  value={confirmationCode}
                  onChange={(e) => setConfirmationCode(e.target.value.toUpperCase())}
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </label>
            </div>

            {error && <div className="mt-3 text-sm text-red-600">{error}</div>}

            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100">
                Cancel
              </button>
              <button
                onClick={handleManualSubmit}
                disabled={submitting || !departureAirport || !arrivalAirport || !departureTime || !arrivalTime}
                className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {submitting ? "Adding…" : "Add flight"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
