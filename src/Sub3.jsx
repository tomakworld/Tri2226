import React, { useState, useEffect, useMemo } from "react";
import { Footprints, Dumbbell, Moon, Settings2, ChevronLeft, ChevronRight, Flag, ChevronDown, Zap, HeartPulse } from "lucide-react";

/* ============ C版:Sub-3 全馬課表(Daniels VDOT體系) ============ */

/* ---- warm sunrise light theme ---- */
const C = {
  bg:"#F7F1E8", surface:"#FFFFFF", surface2:"#F0E7D8", line:"#E2D6C2",
  main:"#B4462E", e:"#2E8B62", m:"#B4462E", t:"#C07A14", i:"#8A2BE2".replace("#8A2BE2","#7A4FA8"), r:"#0B7C8C",
  iron:"#6B5AA8", gold:"#A87F00", text:"#2A241C", muted:"#8D8272", red:"#C6452F", green:"#2E8B62",
};
const DAY_OFFSET = { mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6 };
const DAY_LABEL = { mon:"一",tue:"二",wed:"三",thu:"四",fri:"五",sat:"六",sun:"日" };
function mondayOfThisWeek(){ const d=new Date(); d.setHours(0,0,0,0); d.setDate(d.getDate()-((d.getDay()+6)%7)); return d; }
function fmtD(d){ return `${d.getMonth()+1}/${d.getDate()}`; }
function parseT(str){ // 支援 mm:ss 或 h:mm:ss
  const m3=/^(\d+):(\d{1,2}):(\d{1,2})$/.exec((str||"").trim());
  if (m3) return (+m3[1])*3600+(+m3[2])*60+(+m3[3]);
  const m2=/^(\d+):(\d{1,2})$/.exec((str||"").trim());
  if (m2) return (+m2[1])*60+(+m2[2]);
  return null;
}
function paceStr(secPerKm){ const m=Math.floor(secPerKm/60), r=Math.round(secPerKm%60); return `${m}:${String(r).padStart(2,"0")}`; }
function fmtHMS(sec){ const h=Math.floor(sec/3600),m=Math.floor((sec%3600)/60),s2=Math.round(sec%60); return h>0?`${h}:${String(m).padStart(2,"0")}:${String(s2).padStart(2,"0")}`:`${m}:${String(s2).padStart(2,"0")}`; }

/* ---- Daniels-Gilbert VDOT ---- */
function vo2At(v){ return -4.6 + 0.182258*v + 0.000104*v*v; }             // v: m/min
function pctMax(tMin){ return 0.8 + 0.1894393*Math.exp(-0.012778*tMin) + 0.2989558*Math.exp(-0.1932605*tMin); }
function vdotOf(distM, sec){
  if (!sec) return null;
  const tMin = sec/60, v = distM/tMin;
  return vo2At(v)/pctMax(tMin);
}
function velAtPct(vdot, f){ // 解 0.000104v²+0.182258v-(4.6+f*vdot)=0
  const c = 4.6 + f*vdot;
  return (-0.182258 + Math.sqrt(0.182258**2 + 4*0.000104*c)) / (2*0.000104); // m/min
}
function kmPace(vdot, f){ return 1000/velAtPct(vdot, f)*60; }  // sec/km
function danielsPaces(vdot){
  return {
    eLo:kmPace(vdot,0.70), eHi:kmPace(vdot,0.62),
    m:kmPace(vdot,0.82), t:kmPace(vdot,0.88), i:kmPace(vdot,0.98), r:kmPace(vdot,1.05),
  };
}
const SUB3_VDOT = 53.5;

/* ---- 重訓週期(單腿+神經) ---- */
const STRENGTH = {
  p1:{ h:"解剖適應期", tue:"保加利亞蹲 3x10-12/腿、單腳RDL 3x10、臀橋 3x12;核心抗旋轉;重點動作品質", fri:"輕負荷循環+跳繩 3x60下,喚醒彈性" },
  p2:{ h:"最大肌力期", tue:"保加利亞蹲 4x5-6/腿(重)、六角槓硬舉 4x5、單腳提踵 4x8;組間休2-3分", fri:"低量神經課:跳箱 3x5、彈跳弓步 3x6/腿" },
  p3:{ h:"爆發力轉換期", tue:"保加利亞蹲 3x3-5/腿(次大重量,追求速度)、負重跳蹲 3x5", fri:"增強式:立定跳遠 4x4、單腳跳 3x8/腿、短坡衝刺 6x10秒" },
  p4:{ h:"神經維持期", tue:"保加利亞蹲 2x3/腿(重量維持)、跳蹲 2x5;總量減半", fri:"跳箱 2x4+4x100m加速,保持神經敏銳" },
  taper:{ h:"活化期", tue:"彈力帶啟動+2x3輕快跳蹲,10分鐘內", fri:"動態伸展+4x60m加速,或跳過" },
  race:{ h:"比賽週", tue:"僅動態熱身", fri:"跳過" },
};

/* ---- Q課庫(依 Daniels Phase I-IV) ---- */
function qOf(phase, wi, rec, P){
  const E=`${paceStr(P.eLo)}-${paceStr(P.eHi)}`, M=paceStr(P.m), T=paceStr(P.t), I=paceStr(P.i), R=paceStr(P.r);
  const rf = rec ? "(減量:7成)" : "";
  if (phase==="p1") return {
    q1:{ t:"Q1·坡度+R刺激", x:`E跑40-50分 @${E},其中插入8x20秒短坡衝或平地加速(回走恢復);建立神經基礎${rf}`, v:"50分" },
    q2:{ t:"Q2·T入門", x:`熱身3km;${rec?15:20}分連續 T @${T};緩和2km${rf}`, v:`${rec?15:20}分T` },
    lg:{ km: rec?20 : 22+wi*2, note:`全程 E @${E},最後15分可至 M @${M}` },
  };
  if (phase==="p2") return {
    q1:{ t:"Q1·I 間歇", x:`熱身3km;${rec?4:5+Math.min(wi,2)}x1000m @${I} 慢跑2-3分恢復;緩和2km${rf}`, v:`${rec?4:5+Math.min(wi,2)}x1000` },
    q2:{ t:"Q2·R 速度", x:`熱身3km;${rec?6:8}x400m @${R} 完全恢復(慢跑400m);緩和2km${rf}`, v:`${rec?6:8}x400` },
    lg:{ km: rec?24 : 26+wi*2, note:`E @${E},中段插入2x3km @${M}` },
  };
  if (phase==="p3") return {
    q1:{ t:"Q1·T巡航+I", x:`熱身3km;2x3km @${T} 休2分 + 3x1000m @${I} 休2分;緩和2km${rf}`, v:"T+I混合" },
    q2:{ t:"Q2·M配速", x:`熱身2km;${rec?8:10+wi*2}km 連續 @${M};緩和1km${rf}`, v:`${rec?8:10+wi*2}km@M` },
    lg:{ km: Math.min(rec?26 : 30+wi*2, 35), note:`前段 E @${E},末${rec?6:10}km @${M} — Sub-3專項課` },
  };
  if (phase==="p4") return {
    q1:{ t:"Q1·T鞏固", x:`熱身3km;2x20分 T @${T} 休4分;緩和2km${rf}`, v:"2x20分T" },
    q2:{ t:"Q2·M專項", x:`熱身2km;${rec?10:14}km @${M},鎖定4:15節奏感;緩和1km${rf}`, v:`${rec?10:14}km@M` },
    lg:{ km: rec?24 : 28, note:`E @${E} 含 3x3km @${M},演練比賽補給` },
  };
  if (phase==="taper") return {
    q1:{ t:"Q1·敏銳", x:`熱身2km;${wi>=2?3:4}x1000m @${T} 休2分;緩和2km`, v:`${wi>=2?3:4}x1000T` },
    q2:{ t:"Q2·開合", x:`熱身2km;${wi>=2?4:6}km @${M};4x100m加速;緩和1km`, v:`${wi>=2?4:6}km@M` },
    lg:{ km: wi>=2?12:16, note:`E @${E},保持腿部記憶` },
  };
  return null;
}
function mileage(phase, wi, rec){
  const base = { p1:[60,75], p2:[75,85], p3:[85,95], p4:[75,82], taper:[45,55] }[phase] || [50,60];
  const k = rec ? 0.72 : 1;
  return Math.round((base[0] + (base[1]-base[0])*Math.min(wi/3,1)) * k / 5)*5;
}

/* ---- plan builder ---- */
function buildPlan(raceDateStr){
  const race = new Date(raceDateStr+"T00:00:00");
  if (isNaN(race)) return null;
  const start = mondayOfThisWeek();
  const days = Math.round((race-start)/864e5);
  if (days < 42) return { error:"距比賽不足6週,Sub-3週期化至少建議12週以上。" };
  const n = Math.min(26, Math.floor(days/7)+1);
  const taper = 2;
  const train = n-1-taper;
  const p1 = Math.max(2, Math.round(train*0.30));
  const p2 = Math.max(2, Math.round(train*0.25));
  const p3 = Math.max(2, Math.round(train*0.30));
  const p4 = Math.max(1, train-p1-p2-p3);
  const weeks = []; let idx=1;
  const push=(ph,c)=>{ for(let wi=1;wi<=c;wi++){ const rec = wi===c && c>=3; weeks.push({n:idx++, phase:ph, wi, rest:rec}); } };
  push("p1",p1); push("p2",p2); push("p3",p3); push("p4",p4); push("taper",taper);
  weeks.push({ n:idx, phase:"race", race:true });
  return { weeks, n, start };
}
const PHASE_META = {
  p1:{ label:"Phase I·基礎", color:C.e, note:"E量能+坡度/加速刺激,搭配解剖適應重訓" },
  p2:{ label:"Phase II·R/I", color:C.r, note:"速度與VO2max,最大肌力期" },
  p3:{ label:"Phase III·I/T/M", color:C.t, note:"閾值+馬拉松專項,爆發力轉換,量能峰值" },
  p4:{ label:"Phase IV·T/M", color:C.m, note:"比賽專項鞏固,神經維持" },
  taper:{ label:"減量期", color:C.green, note:"量減40-60%,保留強度" },
  race:{ label:"比賽週", color:C.gold, note:"Sub-3,執行它!" },
};

/* ================= UI ================= */
export default function Sub3Plan(){
  const [profile, setProfile] = useState({
    raceDate:"2026-12-20", k3:"", k5:"19:30", k10:"40:30", hm:"1:29:00", fm:"3:08:00",
    height:172, weight:62, sex:"M", rhr:48,
  });
  const [editing, setEditing] = useState(true);
  const [sel, setSel] = useState(1);
  const [expanded, setExpanded] = useState(null);
  useEffect(()=>{ (async()=>{
    try {
      if (window.storage){ const p = await window.storage.get("sub3:profile", false); if (p&&p.value){ setProfile(d=>({...d,...JSON.parse(p.value)})); setEditing(false);} }
      else { const v = localStorage.getItem("sub3:profile"); if (v){ setProfile(d=>({...d,...JSON.parse(v)})); setEditing(false);} }
    } catch(e){}
  })(); }, []);
  useEffect(()=>{ setExpanded(null); }, [sel]);
  async function save(next){
    setProfile(next);
    try {
      if (window.storage) await window.storage.set("sub3:profile", JSON.stringify(next), false);
      else localStorage.setItem("sub3:profile", JSON.stringify(next));
    } catch(e){}
  }

  /* VDOT:各距離分別計算,取最高為訓練VDOT */
  const V = useMemo(()=>{
    const arr = [
      ["3K", 3000, parseT(profile.k3)], ["5K", 5000, parseT(profile.k5)],
      ["10K", 10000, parseT(profile.k10)], ["半馬", 21097.5, parseT(profile.hm)], ["全馬", 42195, parseT(profile.fm)],
    ].map(([n,d,t])=>({ n, d, t, v: vdotOf(d,t) })).filter(x=>x.v);
    if (!arr.length) return null;
    const best = arr.reduce((a,b)=>a.v>b.v?a:b);
    const short = arr.filter(x=>x.d<=10000), long = arr.filter(x=>x.d>10000);
    let bias = null;
    if (short.length && long.length){
      const gap = Math.max(...short.map(x=>x.v)) - Math.max(...long.map(x=>x.v));
      bias = gap > 1.5 ? "speed" : gap < -1.5 ? "endurance" : "balanced";
    }
    return { arr, vdot: best.v, from: best.n, bias };
  }, [profile.k3, profile.k5, profile.k10, profile.hm, profile.fm]);

  const P = V ? danielsPaces(V.vdot) : null;
  const plan = useMemo(()=>buildPlan(profile.raceDate), [profile.raceDate]);
  const now = new Date();

  const gapV = V ? (SUB3_VDOT - V.vdot) : null;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500;600&display=swap');
        .osw{font-family:'Oswald',sans-serif}.mono{font-family:'Roboto Mono',monospace}
        input,select{background:#fff;border:1px solid ${C.line};color:${C.text};border-radius:8px;padding:8px 10px;font-family:'Roboto Mono',monospace;font-size:14px;width:100%}
        button:focus-visible,input:focus-visible{outline:2px solid ${C.main};outline-offset:2px}
        .strip::-webkit-scrollbar{height:4px}.strip::-webkit-scrollbar-thumb{background:${C.line};border-radius:4px}
        .rowbtn{transition:background .12s ease}.rowbtn:hover{background:${C.surface2}}
      `}</style>
      <div style={{ maxWidth:760, margin:"0 auto", padding:"20px 16px 50px" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
          <div>
            <h1 className="osw" style={{ fontSize:21, fontWeight:700, margin:0, color:C.main }}>Sub-3 全馬計畫 · Daniels VDOT</h1>
            <div style={{ fontSize:11, color:C.muted, marginTop:2 }}>目標 2:59:59 · M配速 4:15/km · 需VDOT≈{SUB3_VDOT}</div>
          </div>
          <button onClick={()=>setEditing(v=>!v)} style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:10, padding:"7px 10px", color:C.text, display:"flex", gap:5, alignItems:"center", cursor:"pointer", fontSize:12, flexShrink:0 }}>
            <Settings2 size={14}/> 我的數據
          </button>
        </div>

        {editing && (
          <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:10.5, color:C.main, fontWeight:700, marginBottom:6 }}>① 比賽成績(至少填一項,mm:ss 或 h:mm:ss;越多項,VDOT診斷越準)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
              <Field label="3K"><input value={profile.k3} placeholder="11:15" onChange={e=>save({...profile,k3:e.target.value})}/></Field>
              <Field label="5K"><input value={profile.k5} placeholder="19:30" onChange={e=>save({...profile,k5:e.target.value})}/></Field>
              <Field label="10K"><input value={profile.k10} placeholder="40:30" onChange={e=>save({...profile,k10:e.target.value})}/></Field>
              <Field label="半馬"><input value={profile.hm} placeholder="1:29:00" onChange={e=>save({...profile,hm:e.target.value})}/></Field>
              <Field label="全馬"><input value={profile.fm} placeholder="3:08:00" onChange={e=>save({...profile,fm:e.target.value})}/></Field>
              <Field label="比賽日期"><input type="date" value={profile.raceDate} onChange={e=>save({...profile,raceDate:e.target.value})}/></Field>
            </div>
            <div style={{ fontSize:10.5, color:C.gold, fontWeight:700, margin:"12px 0 6px" }}>② 身體數據(監控用,不影響配速)</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10 }}>
              <Field label="身高cm"><input type="number" value={profile.height} onChange={e=>save({...profile,height:+e.target.value})}/></Field>
              <Field label="體重kg"><input type="number" value={profile.weight} onChange={e=>save({...profile,weight:+e.target.value})}/></Field>
              <Field label="性別"><select value={profile.sex} onChange={e=>save({...profile,sex:e.target.value})}><option value="M">男</option><option value="F">女</option></select></Field>
              <Field label="靜止心率"><input type="number" value={profile.rhr} onChange={e=>save({...profile,rhr:+e.target.value})}/></Field>
            </div>
          </div>
        )}

        {/* VDOT 診斷卡 */}
        {V && (
          <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:12, padding:"10px 12px", marginBottom:10 }}>
            <div style={{ display:"flex", alignItems:"baseline", gap:10, flexWrap:"wrap", marginBottom:6 }}>
              <span className="osw" style={{ fontSize:12, color:C.main, fontWeight:700 }}>VDOT {V.vdot.toFixed(1)}</span>
              <span style={{ fontSize:10.5, color:C.muted }}>取自{V.from}成績</span>
              <span className="mono" style={{ fontSize:11, marginLeft:"auto", color: gapV<=0?C.green:(gapV<=2?C.gold:C.red) }}>
                {gapV<=0 ? "✓ 已達Sub-3水準,重點轉專項耐力" : `距Sub-3還差 ${gapV.toFixed(1)} VDOT(約${Math.round(gapV*2)}-${Math.round(gapV*3)}分)`}
              </span>
            </div>
            <div className="mono" style={{ display:"flex", gap:6, flexWrap:"wrap", fontSize:10.5, marginBottom:6 }}>
              {V.arr.map(x=>(<span key={x.n} style={{ background:C.surface2, borderRadius:5, padding:"2px 6px" }}>{x.n} V{x.v.toFixed(1)}</span>))}
            </div>
            {V.bias && (
              <div style={{ fontSize:11, color:C.text, opacity:0.85 }}>
                {V.bias==="speed" && "📊 速度型:短距離VDOT明顯高於長距離 → 課表已足量,重點吃滿Phase III/IV的M配速與長跑,別再加I課。"}
                {V.bias==="endurance" && "📊 耐力型:長距離VDOT較高 → Phase II的R/I課是你的關鍵短板,務必保質完成。"}
                {V.bias==="balanced" && "📊 均衡型:各距離VDOT一致,照表操課即可。"}
              </div>
            )}
          </div>
        )}

        {/* 配速列 */}
        {P && (
          <div className="mono" style={{ display:"flex", gap:6, flexWrap:"wrap", fontSize:11, marginBottom:10 }}>
            <Pc c={C.e} l="E" v={`${paceStr(P.eLo)}-${paceStr(P.eHi)}`}/>
            <Pc c={C.m} l="M" v={paceStr(P.m)}/>
            <Pc c={C.t} l="T" v={paceStr(P.t)}/>
            <Pc c={C.i} l="I" v={`${paceStr(P.i)}(${Math.round(P.i)}s/km,千米${fmtHMS(P.i)})`}/>
            <Pc c={C.r} l="R" v={`${paceStr(P.r)}(400m ${Math.round(P.r*0.4)}s)`}/>
          </div>
        )}

        {!plan || plan.error ? (
          <div style={{ padding:16, color:C.red, fontSize:13 }}>{plan?.error || "請輸入比賽日期"}</div>
        ) : !P ? (
          <div style={{ padding:16, color:C.muted, fontSize:13 }}>請至少輸入一項比賽成績以計算 VDOT。</div>
        ) : (
          <PlanView plan={plan} P={P} profile={profile} sel={sel} setSel={setSel} expanded={expanded} setExpanded={setExpanded} now={now}/>
        )}
      </div>
    </div>
  );
}

function PlanView({ plan, P, profile, sel, setSel, expanded, setExpanded, now }){
  const { weeks, n:N, start } = plan;
  const s2 = Math.min(sel, N);
  const week = weeks.find(w=>w.n===s2);
  const meta = PHASE_META[week.phase];
  const dateFor=(w,d)=>{ const x=new Date(start); x.setDate(x.getDate()+(w-1)*7+DAY_OFFSET[d]); return x; };
  const q = week.race ? null : qOf(week.phase, week.wi, week.rest, P);
  const km = week.race ? 0 : mileage(week.phase, week.wi, week.rest);
  const st = STRENGTH[week.phase];
  const E=`${paceStr(P.eLo)}-${paceStr(P.eHi)}`;

  const items = week.race ? [] : [
    { day:"mon", rows:[{rest:true}] },
    { day:"tue", rows:[
      { id:"q1", color:C.i, icon:<Footprints size={13}/>, title:q.q1.t, vol:q.q1.v, detail:q.q1.x },
      { id:"st1", color:C.iron, icon:<Dumbbell size={13}/>, title:`重訓·${st.h}`, vol:"PM", detail:`${st.tue}(排在Q1之後至少6小時,同日集中壓力,讓E日真正輕鬆)` },
    ]},
    { day:"wed", rows:[{ id:"e1", color:C.e, icon:<Footprints size={13}/>, title:"E 恢復跑", vol:`${Math.round(km*0.13)}km`, detail:`@${E},完全對話配速;晨間RHR比基準(${profile.rhr})高7bpm以上→縮短或休息` }] },
    { day:"thu", rows:[{ id:"e2", color:C.e, icon:<Footprints size={13}/>, title:"E+步幅", vol:`${Math.round(km*0.15)}km`, detail:`@${E},末段6x20秒加速步幅(回走恢復)` }] },
    { day:"fri", rows:[
      { id:"q2", color:C.t, icon:<Footprints size={13}/>, title:q.q2.t, vol:q.q2.v, detail:q.q2.x },
      { id:"st2", color:C.iron, icon:<Zap size={13}/>, title:"神經刺激", vol:"PM/短", detail:st.fri },
    ]},
    { day:"sat", rows:[{ id:"e3", color:C.e, icon:<Footprints size={13}/>, title:"E 輕鬆跑", vol:`${Math.round(km*0.12)}km`, detail:`@${E},為明日長跑保留` }] },
    { day:"sun", rows:[{ id:"lg", color:C.gold, icon:<Footprints size={13}/>, title:"長跑", vol:`${q.lg.km}km`, detail:`${q.lg.note};每40分補給一次` }] },
  ];

  return (
    <>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
        <Nav dir="p" disabled={s2===1} onClick={()=>setSel(v=>Math.max(1,v-1))}/>
        <div className="strip" style={{ display:"flex", gap:5, overflowX:"auto", padding:"3px 2px", flex:1 }}>
          {weeks.map(w=>{
            const active=w.n===s2, past=dateFor(w.n,"sun")<now;
            return (
              <button key={w.n} onClick={()=>setSel(w.n)} className="osw"
                style={{ flexShrink:0, minWidth:42, borderRadius:8, padding:"4px 3px", cursor:"pointer",
                  background:active?PHASE_META[w.phase].color:C.surface, color:active?"#fff":(past?C.muted:C.text),
                  border:`1px solid ${active?PHASE_META[w.phase].color:C.line}`, opacity:past&&!active?0.55:1, textAlign:"center" }}>
                <div style={{ fontSize:11, fontWeight:700 }}>{w.race?"🏁":`W${w.n}`}</div>
                <div className="mono" style={{ fontSize:8.5 }}>{fmtD(dateFor(w.n,"mon"))}</div>
              </button>
            );
          })}
        </div>
        <Nav dir="n" disabled={s2===N} onClick={()=>setSel(v=>Math.min(N,v+1))}/>
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap", fontSize:11.5 }}>
        <span className="osw" style={{ fontSize:12, color:meta.color, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>{meta.label}{week.rest?"·減量":""}</span>
        <span style={{ color:C.muted }}>{meta.note}</span>
        {!week.race && <span className="mono" style={{ fontSize:10.5, color:C.main, marginLeft:"auto" }}>週量≈{km}km</span>}
      </div>

      {week.race ? <RaceWeek P={P} dateFor={dateFor} weekN={week.n} raceDate={new Date(profile.raceDate+"T00:00:00")}/> : (
        <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", background:C.surface }}>
          {items.map((row,ri)=>{
            const d=dateFor(week.n,row.day);
            const past=d<now && d.toDateString()!==now.toDateString();
            const today=d.toDateString()===now.toDateString();
            return (
              <div key={row.day} style={{ display:"flex", borderTop:ri===0?"none":`1px solid ${C.line}`, opacity:past?0.5:1, background:today?"rgba(180,70,46,0.06)":"transparent" }}>
                <div style={{ width:44, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 0", borderRight:`1px solid ${C.line}` }}>
                  <span className="osw" style={{ fontSize:14, fontWeight:700, color:today?C.main:C.text }}>{DAY_LABEL[row.day]}</span>
                  <span className="mono" style={{ fontSize:9, color:C.muted }}>{fmtD(d)}</span>
                </div>
                <div style={{ flex:1, padding:"6px 8px", display:"flex", flexDirection:"column", gap:4, minWidth:0 }}>
                  {row.rows.map((it,ii)=>{
                    if (it.rest) return <div key={ii} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.muted, padding:"4px 2px" }}><Moon size={12}/> 全休(重訓後恢復日)</div>;
                    const open=expanded===it.id+week.n;
                    return (
                      <div key={ii}>
                        <button className="rowbtn" onClick={()=>setExpanded(open?null:it.id+week.n)}
                          style={{ display:"flex", alignItems:"center", gap:6, width:"100%", background:"transparent", border:"none", color:C.text, cursor:"pointer", padding:"3px 2px", textAlign:"left", borderRadius:6 }}>
                          <span style={{ color:it.color, display:"flex", flexShrink:0 }}>{it.icon}</span>
                          <span style={{ fontSize:12.5, fontWeight:600, flexShrink:0 }}>{it.title}</span>
                          {it.vol && <span className="mono" style={{ fontSize:10.5, color:it.color, marginLeft:"auto", flexShrink:0 }}>{it.vol}</span>}
                          <ChevronDown size={13} color={C.muted} style={{ flexShrink:0, transform:open?"rotate(180deg)":"none", transition:"transform .15s", marginLeft:it.vol?0:"auto" }}/>
                        </button>
                        {open && <div style={{ fontSize:12, opacity:0.85, lineHeight:1.6, padding:"2px 4px 6px 21px", borderLeft:`2px solid ${it.color}`, marginLeft:5, marginTop:2 }}>{it.detail}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize:10.5, color:C.muted, marginTop:10, display:"flex", gap:5, alignItems:"flex-start" }}>
        <HeartPulse size={12} style={{ flexShrink:0, marginTop:1 }}/>
        <span>準備度監控:晨間靜止心率基準 {profile.rhr} bpm;高出7bpm以上或連兩天睡眠不足 → 當日Q課降為E跑。重訓與Q課同日(高低日原則):Q課在早上,重訓下午,保證E日完全輕鬆。</span>
      </div>
    </>
  );
}

function RaceWeek({ P, dateFor, weekN, raceDate }){
  const raceDayIdx=(raceDate.getDay()+6)%7;
  const keys=["mon","tue","wed","thu","fri","sat","sun"];
  const tasks=[
    "全休",
    `3x1000m @T ${paceStr(P.t)} 休2分,最後敏銳課`,
    `E 30分+4x100m加速`,
    `E 20分,開始增加碳水`,
    "全休或E 15分;領物;早睡",
    `E 15分+3x60m加速;裝備確認;早睡`,
  ];
  const preDays=keys.slice(0,raceDayIdx);
  const chosen=tasks.slice(Math.max(0,tasks.length-preDays.length));
  return (
    <div>
      {preDays.length>0 && (
        <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", marginBottom:10, background:C.surface }}>
          {preDays.map((kk,i)=>(
            <div key={kk} style={{ display:"flex", borderTop:i===0?"none":`1px solid ${C.line}` }}>
              <div style={{ width:44, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"7px 0", borderRight:`1px solid ${C.line}` }}>
                <span className="osw" style={{ fontSize:14, fontWeight:700 }}>{DAY_LABEL[kk]}</span>
                <span className="mono" style={{ fontSize:9, color:C.muted }}>{fmtD(dateFor(weekN,kk))}</span>
              </div>
              <div style={{ flex:1, padding:"7px 10px", fontSize:12, lineHeight:1.5 }}>{chosen[i]}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ border:`1.5px solid ${C.gold}`, borderRadius:12, padding:"12px 14px", background:"rgba(168,127,0,0.08)" }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:6, display:"flex", gap:6, alignItems:"center" }}><Flag size={15} color={C.gold}/>{DAY_LABEL[keys[raceDayIdx]]} {fmtD(raceDate)} — Sub-3 比賽日</div>
        <div style={{ fontSize:12.5, lineHeight:1.7 }}>
          <div><b>配速計畫</b>:全程 4:14-4:16/km;半程通過 1:29:15-1:29:45</div>
          <div><b>前10km</b>:嚴守 4:16-4:18,寧慢勿快 — Sub-3 死在前半太快的人最多</div>
          <div><b>30km 後</b>:靠 Phase III/IV 的 M 配速長跑兌現,專注節奏與補給</div>
          <div><b>補給</b>:每 30-40 分一支膠,配水;賽前演練過的品牌</div>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }){ return (<label style={{ display:"block" }}><div style={{ fontSize:10.5, color:C.muted, marginBottom:3 }}>{label}</div>{children}</label>); }
function Pc({ c, l, v }){ return (<span style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:6, padding:"2px 7px", display:"inline-flex", gap:5 }}><span style={{ color:c, fontWeight:700 }}>{l}</span><span>{v}/km</span></span>); }
function Nav({ dir, onClick, disabled }){
  return (
    <button onClick={onClick} disabled={disabled} aria-label={dir==="p"?"上一週":"下一週"}
      style={{ width:28, height:28, borderRadius:"50%", background:C.surface, border:`1px solid ${C.line}`, color:disabled?C.muted:C.text, display:"flex", alignItems:"center", justifyContent:"center", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, flexShrink:0 }}>
      {dir==="p"?<ChevronLeft size={15}/>:<ChevronRight size={15}/>}
    </button>
  );
}
