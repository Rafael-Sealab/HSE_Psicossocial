import type { ReactNode } from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Risk } from "@/lib/psychosocial"
import { riskClass } from "@/lib/psychosocial"

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description: string; action?: ReactNode }) {
  return <div className="page-header"><div><p className="eyebrow">{eyebrow}</p><h1>{title}</h1><p>{description}</p></div>{action}</div>
}

export function MetricCard({ label, value, hint, icon }: { label: string; value: string; hint: string; icon?: ReactNode }) {
  return <Card className="metric-card"><CardContent className="p-5"><div className="metric-top"><span>{label}</span>{icon}</div><strong>{value}</strong><small>{hint}</small></CardContent></Card>
}

export function RiskBadge({ risk }: { risk: Risk }) {
  return <Badge variant="outline" className={`risk-badge ${riskClass[risk]}`}><span className="risk-dot" />{risk}</Badge>
}

export function SectionCard({ title, description, children, className = "" }: { title: string; description?: string; children: ReactNode; className?: string }) {
  return <Card className={className}><CardHeader><CardTitle>{title}</CardTitle>{description && <p className="section-description">{description}</p>}</CardHeader><CardContent>{children}</CardContent></Card>
}
