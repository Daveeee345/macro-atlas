"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { CountrySnapshot } from "@/lib/types";
import { SearchIcon } from "./Icons";

export default function CommandPalette({ open, onClose, countries }: { open:boolean; onClose:()=>void; countries:CountrySnapshot[] }) {
  const [q,setQ]=useState(""); const router=useRouter();
  useEffect(()=>{if(open)setQ("")},[open]);
  const filtered=useMemo(()=>countries.filter(c=>(c.name+" "+c.code).toLowerCase().includes(q.toLowerCase())).slice(0,5),[countries,q]);
  if(!open)return null;
  const go=(href:string)=>{onClose();router.push(href)};
  return <div className="command-backdrop" onMouseDown={onClose}><div className="command-palette" onMouseDown={e=>e.stopPropagation()}><div className="command-search"><SearchIcon size={18}/><input autoFocus value={q} onChange={e=>setQ(e.target.value)} placeholder="Search countries, indicators, tools, or commands..."/><kbd>ESC</kbd></div><div className="command-group"><span>COUNTRIES</span>{filtered.map(c=><button key={c.code} onClick={()=>go(`/country/${c.code}`)}><b>{c.code}</b><strong>{c.name}</strong><small>{c.regime}</small></button>)}</div><div className="command-group"><span>TOOLS</span><button onClick={()=>go("/regimes")}><b>RG</b><strong>Open Global Regime Map</strong><small>Growth × inflation</small></button><button onClick={()=>go("/policy")}><b>PL</b><strong>Open Policy Divergence</strong><small>Real rates</small></button><button onClick={()=>go("/compare")}><b>CP</b><strong>Compare Indonesia vs United States</strong><small>Arithmetic divergence</small></button><button onClick={()=>go("/data")}><b>DT</b><strong>Open Data System</strong><small>Lineage & methodology</small></button></div></div></div>;
}
