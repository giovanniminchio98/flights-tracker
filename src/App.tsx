import { UnitsProvider } from "@/lib/UnitsContext";
import { AppShell } from "@/components/AppShell";

export default function App() {
  return (
    <UnitsProvider>
      <AppShell />
    </UnitsProvider>
  );
}
