import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ensureSpreadsheet, readFlightRows, deleteFlightRow } from "@/lib/googleSheets";

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.accessToken) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { spreadsheetId } = await ensureSpreadsheet(session.accessToken);
  const rows = await readFlightRows(session.accessToken, spreadsheetId);
  const row = rows.find((r) => r.record.id === params.id);

  if (!row) {
    return NextResponse.json({ error: "Flight not found" }, { status: 404 });
  }

  await deleteFlightRow(session.accessToken, spreadsheetId, row.rowNumber);
  return NextResponse.json({ deleted: true });
}
