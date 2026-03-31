import { useState } from "react";
import { UploadArea } from "@/components/UploadArea";
import { TabelaAnual } from "@/components/TabelaAnual";
import { SeletorAno } from "@/components/SeletorAno";
import { Activity } from "lucide-react";

const Index = () => {
  const [ano, setAno] = useState(2025);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className="h-6 w-6 text-primary" />
            <h1 className="text-xl font-bold text-foreground">Controle Plano de Saúde</h1>
          </div>
          <SeletorAno ano={ano} onAnoChange={setAno} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-6">
        <UploadArea onUploadComplete={() => setRefreshKey((k) => k + 1)} />
        <TabelaAnual ano={ano} refreshKey={refreshKey} />
      </main>
    </div>
  );
};

export default Index;
