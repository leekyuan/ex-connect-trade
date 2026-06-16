import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Card } from "@/components/ui/card";

export interface LegalSection { title: string; body: string }

export function LegalPage({ title, intro, sections }: { title: string; intro: string; sections: LegalSection[] }) {
  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto space-y-4">
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
        <p className="text-xs text-muted-foreground">{intro}</p>
        <Card className="p-6 space-y-6">
          {sections.map((s, i) => (
            <section key={i} className="space-y-2">
              <h2 className="text-sm font-semibold">{s.title}</h2>
              <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{s.body}</p>
            </section>
          ))}
        </Card>
        <p className="text-[10px] text-muted-foreground text-center">최종 업데이트: 2026-06-16</p>
      </div>
    </DashboardLayout>
  );
}
