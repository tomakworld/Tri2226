import React, { useState, useEffect, useRef } from "react";
import { Waves, Bike as BikeIcon, Footprints, Dumbbell, Moon, ChevronLeft, ChevronRight, Flag, Sun, ChevronDown } from "lucide-react";

/* ================= Season 專屬 226 課表 (B版) =================
   身高160 / 體重50 / FTP 192W (3.84 W/kg) / 全馬 3:20
   比賽 2026-11-08 · 18週 · 單車加強版 · 跑步採自主課表        */
const FTP = 192, WEIGHT = 50;
/* 游泳:海泳實測2:05/100m(防寒衣) → 推算泳池T-pace≈1:55;EN1=2:20 EN2=2:07 THR=1:55 比賽=2:05 */

/* 儲存層:Claude 環境用 window.storage,自架網站自動改用 localStorage */
const store = {
  async get(k){
    if (window.storage) { const r = await window.storage.get(k, false); return r ? r.value : null; }
    return localStorage.getItem("season:" + k);
  },
  async set(k, v){
    if (window.storage) return window.storage.set(k, v, false);
    localStorage.setItem("season:" + k, v);
  },
};
const PROGRAM_START = new Date(2026, 6, 6);
const RACE_DATE = new Date(2026, 10, 8);
const N = 18;

/* ---- aqua light theme ---- */
const C = {
  bg: "#E4F2F5", surface: "#FFFFFF", surface2: "#D3E9EE", line: "#BFDDE4",
  water: "#0B7C8C", power: "#C07A14", red: "#C6452F", green: "#2E8B62",
  gold: "#A87F00", iron: "#6B5AA8", text: "#173038", muted: "#6E8A92",
};
const PHASES = {
  base:   { label:"基礎期",   color:C.water, note:"熱適應+有氧鞏固,單車量能直接拉高" },
  build1: { label:"強化期一", color:C.power, note:"FTP專項強化,Sweet Spot加量" },
  build2: { label:"強化期二", color:C.power, note:"長騎逼近比賽時長,Brick啟動" },
  peak:   { label:"巔峰期",   color:C.red,   note:"180km模擬,最重訓練區塊" },
  taper:  { label:"減量期",   color:C.green, note:"降量保強度,超補償" },
  race:   { label:"比賽週",   color:C.gold,  note:"Season,去完成它吧!" },
};
function climate(m){ return m>=6&&m<=9 ? "高溫期:清晨/室內訓練,勤補電解質" : (m===5||m===10 ? "過渡季:長課清晨出發" : "涼爽季:配速貼近目標,品質黃金期"); }

const DAY_OFFSET = { mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6 };
const DAY_LABEL = { mon:"一",tue:"二",wed:"三",thu:"四",fri:"五",sat:"六",sun:"日" };
function dateFor(w, d){ const x=new Date(PROGRAM_START); x.setDate(x.getDate()+(w-1)*7+DAY_OFFSET[d]); return x; }
function fmt(d){ return `${d.getMonth()+1}/${d.getDate()}`; }
function W(pct){ return Math.round(FTP*pct); }
function tss(segs){ return Math.round(segs.reduce((a,[m,i])=>a+m*i*i,0)/60*100); }
function r5(v){ return Math.round(v/5)*5; }
function r50(v){ return Math.round(v/50)*50; }

/* 功率速查(FTP 192W) */
const Z = {
  Z1:`Z1 0-${W(0.55)}W`, Z2:`Z2 ${W(0.56)}-${W(0.75)}W`, Z3:`Z3 ${W(0.76)}-${W(0.90)}W`,
  Z4:`Z4 ${W(0.91)}-${W(1.05)}W`, SS:`SS ${W(0.88)}-${W(0.93)}W`,
};

/* ---- 跑步:自主課表(全馬3:20 → 226配速 5:19-5:39/km) ---- */
function runOf(phase, sunKm, rec){
  const fri = phase==="base"||phase==="build1"
    ? "1000m ×5-6 @3:45 休5分"
    : phase==="peak"||phase==="taper"
      ? "8-10km @226配速 5:19-5:39"
      : "閾值巡航 3x2km @4:26 休90秒";
  return {
    wed:{ t:"間歇(自主)", x:`300m@74秒+100m@40秒 ×5,共4組,組休400m${rec?"(減量:組數減半)":""}`, v:"4組" },
    thu:{ t:"慢跑", x:"30-45分 輕鬆對話配速,純恢復,把腿留給單車", v:"30-45分" },
    fri:{ t: phase==="base"||phase==="build1" ? "間歇(自主)" : "配速課", x:`${fri}${rec?"(減量:7成)":""}`, v:"品質課" },
    sat:{ t:"慢跑", x:"30-45分 輕鬆,長騎前保留體力", v:"30-45分" },
    sun:{ t:"長跑", x:`${sunKm}km @4:45漸速,末1/3轉226配速5:19-5:39練節奏`, v:`${sunKm}km` },
  };
}

/* ---- 游泳/單車:單車加強版(SS與長騎量高於A版約10-15%) ---- */
function gen(phase, wi, rec){
  const f = rec ? 0.72 : 1;
  if (phase==="base"){
    const r1=Math.max(6,Math.round((8+wi)*f)), r2=Math.max(6,Math.round((10+wi*2)*f));
    const d3=Math.max(1400,r50((2000+(wi-1)*250)*f));
    const bw=Math.max(60,r5((85+(wi-1)*5)*f)), bte=Math.max(8,Math.round((12+(wi-1)*2)*f));
    const bs=Math.max(130,r5((185+(wi-1)*25)*f));
    return { run:runOf(phase, Math.round((16+wi*2)*(rec?0.8:1)), rec), swim:{
      tue:{t:"技術✕有氧", x:`熱身400m;技術8x50m;主課 ${r1}x150m EN2(2:07/100m) 息15秒;緩和200m`, v:`${800+r1*150+200}m`},
      fri:{t:"閾值間歇", x:`熱身400m;主課 ${r2}x100m 門檻(1:55/100m) 息15秒;緩和200m`, v:`${400+r2*100+200}m`},
      sun:{t:"有氧耐力", x:`連續 ${d3}m 輕鬆(2:20/100m);緩和200m`, v:`${d3+200}m`},
    }, bike:{
      wed:{t:"Z2+Tempo收尾", x:`${bw}分 ${Z.Z2},最後15分 ${Z.Z3};跑步間歇在前,間隔4小時+`, v:`${bw}分`, tss:tss([[bw-15,0.65],[15,0.83]])},
      thu:{t:"閾值間歇", x:`熱身15分;主課 4x${bte}分 ${Z.Z3}上緣~${Z.Z4}下緣(室內取下緣,開風扇);息4分;緩和10分`, v:`${15+4*bte+16+10}分`, tss:tss([[15,0.6],[4*bte,0.88],[16,0.5],[10,0.55]])},
      sat:{t:"長騎有氧", x:`${Z.Z2},室內${r5(bs*0.85)}分/戶外${bs}分;每20分補水+電解質`, v:`${bs}分`, tss:tss([[bs,0.65]])},
    }};
  }
  if (phase==="build1"){
    const r1=Math.max(4,Math.round((6+wi)*f)), r2=Math.max(3,Math.round((4+wi)*f));
    const d3=Math.max(1800,r50((2600+(wi-1)*200)*f));
    const bw=Math.max(65,r5((90+(wi-1)*5)*f)), bte=Math.max(12,Math.round((15+(wi-1)*2)*f));
    const bs=Math.max(160,r5((240+(wi-1)*20)*f));
    return { run:runOf(phase, Math.round((21+wi*2)*(rec?0.75:1)), rec), swim:{
      tue:{t:"有氧量能", x:`熱身400m;技術8x50m;主課 ${r1}x200m EN2(2:07/100m) 息20秒;緩和200m`, v:`${800+r1*200+200}m`},
      fri:{t:"長閾值", x:`熱身400m;主課 ${r2}x300m 門檻(1:55/100m) 息30秒;緩和200m`, v:`${400+r2*300+200}m`},
      sun:{t:"開放水域✕配速", x:`連續${d3}m,抬頭定位,後段比賽配速(2:05/100m);緩和200m`, v:`${d3+200}m`},
    }, bike:{
      wed:{t:"Z2+Sweet Spot", x:`${bw}分 ${Z.Z2},中段2x15分 ${Z.SS};跑步間歇後4小時+`, v:`${bw}分`, tss:tss([[bw-30,0.65],[30,0.90]])},
      thu:{t:"FTP強化", x:`熱身15分;主課 3x${bte}分 ${Z.Z4}(室內${W(0.91)}W起);息5分;緩和10分`, v:`${15+3*bte+15+10}分`, tss:tss([[15,0.6],[3*bte,0.92],[15,0.5],[10,0.55]])},
      sat:{t:"長距耐力", x:`${Z.Z2},室內${r5(bs*0.85)}分/戶外${bs}分;鎖空力姿勢`, v:`${bs}分`, tss:tss([[bs,0.67]])},
    }};
  }
  if (phase==="build2"){
    const r1=Math.max(4,Math.round((6+wi)*f)), r2=Math.max(3,Math.round((5+wi)*f));
    const d3=Math.max(2200,r50((3000+(wi-1)*200)*f));
    const bw=Math.max(70,r5((95+(wi-1)*5)*f)), bte=Math.max(14,Math.round((18+(wi-1)*3)*f));
    const bs=Math.max(195,r5((290+(wi-1)*25)*f));
    const brick = wi>=2 && !rec;
    return { run:runOf(phase, Math.min(Math.round((24+wi*2)*(rec?0.75:1)),30), rec), swim:{
      tue:{t:"有氧維持", x:`熱身400m;技術6x50m;主課 ${r1}x200m EN2(2:07/100m) 息20秒;緩和200m`, v:`${700+r1*200+200}m`},
      fri:{t:"高強度閾值", x:`熱身400m;主課 ${r2}x300m 門檻(1:55/100m) 息30秒;緩和200m`, v:`${400+r2*300+200}m`},
      sun:{t:"長泳耐力", x:`連續${d3}m,模擬比賽節奏(2:05/100m)與補給;緩和200m`, v:`${d3+200}m`},
    }, bike:{
      wed:{t:"Z2+Sweet Spot", x:`${bw}分 ${Z.Z2},中段2x18分 ${Z.SS};跑步間歇後4小時+`, v:`${bw}分`, tss:tss([[bw-36,0.65],[36,0.90]])},
      thu:{t:"FTP高峰", x:`熱身15分;主課 3x${bte}分 ${Z.Z4} 下緣;息5分;緩和10分`, v:`${15+3*bte+15+10}分`, tss:tss([[15,0.6],[3*bte,0.93],[15,0.5],[10,0.55]])},
      sat:{t: brick?"長距+Brick":"長距耐力", x:`${Z.Z2}~${Z.Z3},室內${r5(bs*0.85)}分/戶外${bs}分${brick?";下車接20分226配速跑(5:19-5:39)":""}`, v:`${bs}分`, tss:tss([[bs,0.70]])},
    }};
  }
  if (phase==="peak"){
    const T=[
      { run:runOf(phase,28,false), swim:{
          tue:{t:"有氧維持", x:"熱身400m;技術6x50m;主課 6x200m EN2(2:07/100m) 息20秒;緩和200m", v:"2200m"},
          fri:{t:"高強度閾值", x:"熱身400m;主課 6x300m 門檻(1:55/100m) 息30秒;緩和200m", v:"2600m"},
          sun:{t:"長泳✕配速", x:"連續3200m 輕鬆(2:20),後1000m比賽配速(2:05);緩和200m", v:"3400m"} },
        bike:{
          wed:{t:"Z2+Sweet Spot", x:`100分 ${Z.Z2},中段2x15分 ${Z.SS}`, v:"100分", tss:92},
          thu:{t:"FTP高峰", x:`熱身15分;主課 3x20分 ${Z.Z4} 下緣;息5分;緩和10分`, v:"110分", tss:105},
          sat:{t:"前哨長騎+Brick", x:`比賽配速 ${Z.Z3};戶外280分/室內240分;下車接30分226配速跑`, v:"4.7hr+30分", tss:300} } },
      { key:true, run:runOf(phase,14,false), swim:{
          tue:{t:"量能維持", x:"熱身400m;主課 5x200m EN2(2:07/100m) 息20秒;緩和200m", v:"2000m"},
          fri:{t:"高強度閾值", x:"熱身400m;主課 5x300m 門檻(1:55/100m) 息30秒;緩和200m", v:"2500m"},
          sun:{t:"🔑長泳關鍵", x:"連續3600m,全程比賽配速(2:05/100m),完整演練補給;緩和200m", v:"3800m"} },
        bike:{
          wed:{t:"恢復迴轉", x:`50分 ${Z.Z1}~${Z.Z2}`, v:"50分", tss:28},
          thu:{t:"FTP高峰", x:`熱身15分;主課 2x28分 ${Z.Z4} 下緣;息8分;緩和10分`, v:"105分", tss:99},
          sat:{t:"🔑180km關鍵+Brick", x:`全程比賽配速 ${Z.Z3},務必戶外,310-340分;下車接40分226配速跑 — 最重單日`, v:"5.5hr+40分", tss:345} } },
      { run:runOf(phase,20,false), swim:{
          tue:{t:"量能收斂", x:"熱身400m;主課 4x200m EN2(2:07/100m) 息20秒;緩和200m", v:"1800m"},
          fri:{t:"閾值維持", x:"熱身400m;主課 4x250m 門檻(1:55/100m) 息25秒;緩和200m", v:"1800m"},
          sun:{t:"中距收量", x:"連續2400m 輕鬆(2:20/100m);緩和200m", v:"2600m"} },
        bike:{
          wed:{t:"恢復迴轉", x:`45分 ${Z.Z1}~${Z.Z2}`, v:"45分", tss:24},
          thu:{t:"FTP維持", x:`熱身15分;主課 3x12分 ${Z.Z4};息4分;緩和10分`, v:"75分", tss:71},
          sat:{t:"長騎收斂", x:`${Z.Z2} 含30分比賽配速;室內160分/戶外185分`, v:"3hr", tss:146} } },
    ];
    return T[Math.min(wi-1,2)];
  }
  const T=[
    { run:{wed:{t:"神經喚醒",x:"6x200m 輕快",v:"6x200m"},thu:{t:"慢跑",x:"30分輕鬆",v:"30分"},fri:{t:"開合跑",x:"4km @226配速",v:"4km"},sat:{t:"慢跑",x:"20-30分+4x60m加速",v:"20-30分"},sun:{t:"中短長跑",x:"12km 輕鬆",v:"12km"}},
      swim:{ tue:{t:"減量有氧", x:"熱身300m;主課 4x100m EN2(2:07/100m) 息20秒;緩和200m", v:"1000m"},
             fri:{t:"減量閾值", x:"熱身300m;主課 4x100m 門檻(1:55/100m) 息25秒;緩和200m", v:"1000m"},
             sun:{t:"輕鬆游", x:"連續1500m 輕鬆(2:20/100m);緩和200m", v:"1700m"} },
      bike:{ wed:{t:"完全恢復", x:`30分 ${Z.Z1}`, v:"30分", tss:15},
             thu:{t:"神經敏銳", x:`熱身15分;主課 3x5分 ${Z.Z4};息3分;緩和10分`, v:"40分", tss:40},
             sat:{t:"減量長騎", x:`${Z.Z2};室內75分/戶外90分`, v:"1.5hr", tss:63} } },
    { run:{wed:{t:"神經喚醒",x:"4x200m 輕快",v:"4x200m"},thu:{t:"慢跑",x:"20分輕鬆",v:"20分"},fri:{t:"開合跑",x:"3km @226配速",v:"3km"},sat:{t:"慢跑",x:"20分+短加速",v:"20分"},sun:{t:"中短長跑",x:"8km 輕鬆",v:"8km"}},
      swim:{ tue:{t:"賽前喚醒", x:"熱身300m;主課 4x50m 加速 息30秒;緩和200m", v:"700m"},
             fri:{t:"賽前開合", x:"熱身300m;主課 6x50m 比賽配速(2:05) 息20秒;緩和200m", v:"700m"},
             sun:{t:"熟悉裝備", x:"連續1000m 輕鬆,比賽泳裝/防寒衣;緩和200m", v:"1200m"} },
      bike:{ wed:{t:"極輕量", x:`20分 ${Z.Z1}`, v:"20分", tss:10},
             thu:{t:"賽前開合", x:`20分 ${Z.Z1}~${Z.Z2},最後5分 ${Z.Z3}`, v:"20分", tss:14},
             sat:{t:"裝備確認", x:`${Z.Z2} 45分,戶外比賽車+輪組,測補給品`, v:"45分", tss:32} } },
  ];
  return T[Math.min(wi-1,1)];
}

/* ---- 18週組裝 ---- */
const WEEKS = [];
let idx = 1;
const push = (phase, count) => {
  for (let wi=1; wi<=count; wi++){
    const rec = ["base","build1","build2"].includes(phase) && wi===count && count>=3;
    const g = gen(phase, wi, rec);
    WEEKS.push({ n: idx++, phase, rest: rec, key: !!g.key, ...g });
  }
};
push("base",4); push("build1",4); push("build2",4); push("peak",3); push("taper",2);
WEEKS.push({ n: idx, phase:"race", race:true });

const STRENGTH = {
  base:"肌力基礎:3-4組x8-10下,單邊+核心,每週+3-5%",
  build1:"最大肌力:主項4-6RM,3-4組,組間休2-3分",
  build2:"最大肌力+爆發啟蒙:4-6RM+登箱跳2-3組x5",
  peak:"爆發力轉換:登階跳/藥球,3組x5-6,量低質精",
  taper:"神經活化:極輕高速2組x5,賽前一週跳過",
  race:"賽前活化:動態熱身10分內或跳過",
};

/* ================= UI ================= */
export default function SeasonPlan(){
  const [sel, setSel] = useState(1);
  const [expanded, setExpanded] = useState(null);
  const [runNotes, setRunNotes] = useState({});
  const [savedKey, setSavedKey] = useState(null);
  const timers = useRef({});
  useEffect(()=>{ setExpanded(null); }, [sel]);
  useEffect(()=>{ (async()=>{
    const notes = {};
    for (const w of WEEKS) { if (w.race) continue;
      for (const d of ["wed","thu","fri","sat","sun"]) {
        try { const v = await store.get(`run:${w.n}:${d}`); if (v) notes[`${w.n}:${d}`] = v; } catch(e){}
      }
    }
    setRunNotes(notes);
  })(); }, []);
  function onRun(w, d, val){
    const key = `${w}:${d}`;
    setRunNotes(prev => ({ ...prev, [key]: val }));
    clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(async ()=>{
      try { await store.set(`run:${w}:${d}`, val); setSavedKey(key); setTimeout(()=>setSavedKey(null), 1500); } catch(e){}
    }, 600);
  }
  const now = new Date();
  const week = WEEKS.find(w=>w.n===sel);
  const phase = PHASES[week.phase];
  const bikeTss = week.race ? 0 : (week.bike.wed.tss+week.bike.thu.tss+week.bike.sat.tss);
  const month = dateFor(week.n,"mon").getMonth()+1;
  const RC = { wed:C.red, thu:C.green, fri:C.red, sat:C.green, sun:C.gold };

  const mk = (icon,color,o,idp) => ({ id:idp, color, icon, title:o.t, vol:o.v, detail:o.x });
  const runLabel = { wed:"間歇", thu:"慢跑", fri:"品質課", sat:"慢跑", sun:"長跑" };
  const rows = week.race ? [] : [
    { day:"mon", items:[{rest:true}] },
    { day:"tue", items:[ mk(<Dumbbell size={13}/>,C.iron,{t:"重量訓練",v:"",x:STRENGTH[week.phase]},"tue-s"), mk(<Waves size={13}/>,C.water,week.swim.tue,"tue-sw") ] },
    { day:"wed", items:[ {run:"wed"}, mk(<BikeIcon size={13}/>,C.power,{...week.bike.wed,v:`${week.bike.wed.v}·TSS${week.bike.wed.tss}`},"wed-b") ] },
    { day:"thu", items:[ {run:"thu"}, mk(<BikeIcon size={13}/>,C.power,{...week.bike.thu,v:`${week.bike.thu.v}·TSS${week.bike.thu.tss}`},"thu-b") ] },
    { day:"fri", items:[ {run:"fri"}, mk(<Waves size={13}/>,C.water,week.swim.fri,"fri-sw") ] },
    { day:"sat", items:[ {run:"sat"}, mk(<BikeIcon size={13}/>,C.power,{...week.bike.sat,v:`${week.bike.sat.v}·TSS${week.bike.sat.tss}`},"sat-b") ] },
    { day:"sun", items:[ {run:"sun"}, mk(<Waves size={13}/>,C.water,week.swim.sun,"sun-sw") ] },
  ];

  return (
    <div style={{ minHeight:"100vh", background:C.bg, color:C.text, fontFamily:"'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500;600&display=swap');
        .osw{font-family:'Oswald',sans-serif}.mono{font-family:'Roboto Mono',monospace}
        button:focus-visible{outline:2px solid ${C.water};outline-offset:2px}
        .strip::-webkit-scrollbar{height:4px}.strip::-webkit-scrollbar-thumb{background:${C.line};border-radius:4px}
        .rowbtn{transition:background .12s ease}.rowbtn:hover{background:${C.surface2}}
      `}</style>
      <div style={{ maxWidth:760, margin:"0 auto", padding:"20px 16px 50px" }}>
        {/* header */}
        <div style={{ marginBottom:12 }}>
          <h1 className="osw" style={{ fontSize:22, fontWeight:700, margin:0, color:C.water }}>Season · 226 訓練計畫</h1>
          <div style={{ fontSize:11.5, color:C.muted, marginTop:3 }}>
            2026/11/8 比賽 · FTP {FTP}W（{(FTP/WEIGHT).toFixed(2)} W/kg）· 全馬3:20 · 海泳2:05/100m(防寒衣,拆分約1:20) · 226跑段 5:19-5:39/km · 單車加強版 · 倒數 {N-sel>0?`${N-sel}週`:"本週"}
          </div>
        </div>

        {/* 功率速查 */}
        <div className="mono" style={{ display:"flex", gap:6, flexWrap:"wrap", fontSize:11, marginBottom:10 }}>
          {Object.values(Z).map((t,i)=>(<span key={i} style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:6, padding:"2px 7px" }}>{t}</span>))}
          <span style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:6, padding:"2px 7px", color:C.gold }}>比賽 {W(0.70)}-{W(0.75)}W</span>
          <span style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:6, padding:"2px 7px", color:C.water }}>游EN2 2:07</span>
          <span style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:6, padding:"2px 7px", color:C.water }}>游THR 1:55</span>
          <span style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:6, padding:"2px 7px", color:C.gold }}>游比賽 2:05</span>
        </div>

        {/* week strip */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
          <Nav dir="p" disabled={sel===1} onClick={()=>setSel(s=>Math.max(1,s-1))}/>
          <div className="strip" style={{ display:"flex", gap:5, overflowX:"auto", padding:"3px 2px", flex:1 }}>
            {WEEKS.map(w=>{
              const active = w.n===sel;
              const past = dateFor(w.n,"sun") < now;
              return (
                <button key={w.n} onClick={()=>setSel(w.n)} className="osw"
                  style={{ flexShrink:0, minWidth:42, borderRadius:8, padding:"4px 3px", cursor:"pointer",
                    background: active?PHASES[w.phase].color:C.surface, color: active?"#fff":(past?C.muted:C.text),
                    border:`1px solid ${active?PHASES[w.phase].color:C.line}`, opacity: past&&!active?0.55:1, textAlign:"center" }}>
                  <div style={{ fontSize:11, fontWeight:700 }}>{w.race?"🏁":`W${w.n}`}</div>
                  <div className="mono" style={{ fontSize:8.5 }}>{fmt(dateFor(w.n,"mon"))}</div>
                </button>
              );
            })}
          </div>
          <Nav dir="n" disabled={sel===N} onClick={()=>setSel(s=>Math.min(N,s+1))}/>
        </div>

        {/* phase line */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap", fontSize:11.5 }}>
          <span className="osw" style={{ fontSize:12, color:phase.color, fontWeight:700, textTransform:"uppercase", letterSpacing:1 }}>
            {phase.label}{week.rest?"·減量":""}{week.key?"·🔑":""}
          </span>
          <span style={{ color:C.muted }}>{phase.note}</span>
          <span style={{ color:C.muted }}>|</span>
          <span style={{ color:C.muted, display:"flex", gap:4, alignItems:"center" }}><Sun size={11}/>{climate(month)}</span>
          {!week.race && <span className="mono" style={{ fontSize:10.5, color:C.power, marginLeft:"auto" }}>騎TSS≈{bikeTss}</span>}
        </div>

        {week.race ? <RaceWeek/> : (
          <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", background:C.surface }}>
            {rows.map((row,ri)=>{
              const d = dateFor(week.n,row.day);
              const past = d<now && d.toDateString()!==now.toDateString();
              const today = d.toDateString()===now.toDateString();
              return (
                <div key={row.day} style={{ display:"flex", borderTop:ri===0?"none":`1px solid ${C.line}`, opacity:past?0.5:1, background:today?"rgba(11,124,140,0.08)":"transparent" }}>
                  <div style={{ width:44, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 0", borderRight:`1px solid ${C.line}` }}>
                    <span className="osw" style={{ fontSize:14, fontWeight:700, color:today?C.water:C.text }}>{DAY_LABEL[row.day]}</span>
                    <span className="mono" style={{ fontSize:9, color:C.muted }}>{fmt(d)}</span>
                  </div>
                  <div style={{ flex:1, padding:"6px 8px", display:"flex", flexDirection:"column", gap:4, minWidth:0 }}>
                    {row.items.map((it,ii)=>{
                      if (it.rest) return <div key={ii} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.muted, padding:"4px 2px" }}><Moon size={12}/> 全休</div>;
                      if (it.run) {
                        const key = `${week.n}:${it.run}`;
                        return (
                          <div key={ii} style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:11, color:RC[it.run], flexShrink:0, width:56 }}>
                              <Footprints size={12}/>{runLabel[it.run]}
                            </span>
                            <input value={runNotes[key]||""} onChange={(e)=>onRun(week.n, it.run, e.target.value)} placeholder="填入自主跑步課表…"
                              style={{ flex:1, minWidth:0, background:"transparent", border:"none", borderBottom:`1px dashed ${C.line}`, borderRadius:0, padding:"2px 4px", fontFamily:"'Inter',sans-serif", fontSize:12.5, color:C.text, outline:"none" }} />
                            <span style={{ width:14, flexShrink:0, fontSize:10, color:C.green }}>{savedKey===key?"✓":""}</span>
                          </div>
                        );
                      }
                      const open = expanded===it.id;
                      return (
                        <div key={ii}>
                          <button className="rowbtn" onClick={()=>setExpanded(open?null:it.id)}
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
      </div>
    </div>
  );
}

function RaceWeek(){
  const tasks = [
    ["一","全休;檢查裝備與補給採買"],
    ["二","游泳喚醒:300m+4x50m加速+200m"],
    ["三",`單車喚醒:30分輕鬆,中段3x2分比賽配速(${W(0.72)}W);查車況`],
    ["四","輕鬆跑20分+4x20秒步幅;增加碳水"],
    ["五","移動/報到;熟悉轉換區;早睡"],
    ["六","檢錄/託運;15分極輕活動;確認氣象;早睡"],
  ];
  return (
    <div>
      <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", marginBottom:10, background:C.surface }}>
        {tasks.map(([d,t],i)=>(
          <div key={i} style={{ display:"flex", borderTop:i===0?"none":`1px solid ${C.line}` }}>
            <div style={{ width:44, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", padding:"7px 0", borderRight:`1px solid ${C.line}` }}>
              <span className="osw" style={{ fontSize:14, fontWeight:700 }}>{d}</span>
            </div>
            <div style={{ flex:1, padding:"7px 10px", fontSize:12, lineHeight:1.5 }}>{t}</div>
          </div>
        ))}
      </div>
      <div style={{ border:`1.5px solid ${C.gold}`, borderRadius:12, padding:"12px 14px", background:"rgba(168,127,0,0.08)" }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:6, display:"flex", gap:6, alignItems:"center" }}><Flag size={15} color={C.gold}/>日 11/8 — Season 的 226 比賽日</div>
        <div style={{ fontSize:12.5, lineHeight:1.7 }}>
          <div><b style={{ color:C.water }}>游 3.8k</b>：2:05/100m(約1:19-1:22),起跳勿快,善用跟游</div>
          <div><b style={{ color:C.power }}>騎 180k</b>：{W(0.70)}-{W(0.75)}W(70-75%FTP),15-20分補給一次</div>
          <div><b style={{ color:C.red }}>跑 42.2k</b>：5:19-5:39/km,前10km刻意壓慢</div>
        </div>
        <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>加油,去完成它!🎉</div>
      </div>
    </div>
  );
}
function Nav({ dir, onClick, disabled }){
  return (
    <button onClick={onClick} disabled={disabled} aria-label={dir==="p"?"上一週":"下一週"}
      style={{ width:28, height:28, borderRadius:"50%", background:C.surface, border:`1px solid ${C.line}`, color:disabled?C.muted:C.text, display:"flex", alignItems:"center", justifyContent:"center", cursor:disabled?"not-allowed":"pointer", opacity:disabled?0.4:1, flexShrink:0 }}>
      {dir==="p"?<ChevronLeft size={15}/>:<ChevronRight size={15}/>}
    </button>
  );
}
