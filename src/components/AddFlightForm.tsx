import { useState, type FormEvent } from "react";
import { addManualFlight } from "@/lib/sync";

export function AddFlightForm({
  accessToken,
  onAdded,
  onClose,
}: {
  accessToken: string;
  onAdded: () => void;
  onClose: () => void;
}) {
  const [flightNumber, setFlightNumber] = useState("");
  const [airline, setAirline] = useState("");
  const [confirmationCode, setConfirmationCode] = useState("");
  const [departureAirport, setDepartureAirport] = useState("");
  const [arrivalAirport, setArrivalAirport] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await addManualFlight(accessToken, {
        flightNumber,
        airline: airline || undefined,
        confirmationCode: confirmationCode || undefined,
        departureAirport,
        arrivalAirport,
        departureTime: new Date(departureTime).toISOString(),
        arrivalTime: new Date(arrivalTime).toISOString(),
      });
      onAdded();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add flight");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-black/30 px-4">
      <form onSubmit={handleSubmit} className="w-full max-w-md rounded-2xl bg-white p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold text-ink">Add flight manually</h2>

        <div className="grid grid-cols-2 gap-3">
          <label className="col-span-1 text-sm">
            Flight number
            <input
              required
              value={flightNumber}
              onChange={(e) => setFlightNumber(e.target.value.toUpperCase())}
              placeholder="AY1234"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
          <label className="col-span-1 text-sm">
            Airline (optional)
            <input
              value={airline}
              onChange={(e) => setAirline(e.target.value)}
              placeholder="Finnair"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>
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
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-ink px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? "Adding…" : "Add flight"}
          </button>
        </div>
      </form>
    </div>
  );
}
