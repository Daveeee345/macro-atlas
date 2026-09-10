"use client";
import { InfoIcon } from "./Icons";

export default function LineageDrawer({ data, onClose }: { data:any|null; onClose:()=>void }) {
  if(!data) return null;
  const o=data.observation, i=data.indicator, c=data.country;
  return <div className="lineage-backdrop" onMouseDown={onClose}><aside className="lineage-drawer" onMouseDown={e=>e.stopPropagation()}>
    <header><div><InfoIcon size={17}/><span>DATA LINEAGE</span></div><button onClick={onClose}>×</button></header>
    <div className="lineage-hero"><span>{c?.code} · {i?.category}</span><strong>{i?.name}</strong><b>{Number(o?.value).toFixed(2)} <small>{i?.unit}</small></b></div>
    <div className="lineage-grid">
      <Row label="Country" value={c?.name}/><Row label="Observation period" value={o?.period}/><Row label="Observation date" value={o?.observation_date}/><Row label="Frequency" value={i?.frequency}/><Row label="Transformation" value={i?.transformation || "Level"}/><Row label="Source" value={o?.source}/><Row label="Retrieved" value={o?.retrieved_at}/><Row label="Vintage" value={o?.vintage_date || "latest"}/><Row label="Validation" value={o?.validation_status}/><Row label="Historical percentile" value={`${Math.round(data.derived?.historical_percentile || 0)}th`}/>
    </div>
    <div className="lineage-method"><strong>METHODOLOGY</strong><p>{data.methodology}</p></div>
    <footer>Every production value should be traceable to a source observation and deterministic transformation.</footer>
  </aside></div>;
}
function Row({label,value}:{label:string;value:any}){return <div><span>{label}</span><strong>{String(value ?? "—")}</strong></div>}
