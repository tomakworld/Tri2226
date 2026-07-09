import { storage } from "./storage.js";
import React, { useState, useEffect, useMemo } from "react";
import { Waves, Bike as BikeIcon, Footprints, Dumbbell, Moon, Settings2, ChevronLeft, ChevronRight, Flag, Sun, ChevronDown, Minus, Plus, RotateCcw } from "lucide-react";

/* ---------------- light theme tokens ---------------- */
const C = {
  ink: "#F7F5F0",        // page bg (warm paper)
  surface: "#FFFFFF",
  surface2: "#EFECE3",
  line: "#DDD7C9",
  water: "#0E8C9C",
  power: "#C07A14",
  red: "#C6452F",
  green: "#2E8B62",
  gold: "#A87F00",
  iron: "#6B5AA8",
  text: "#22303A",
  muted: "#8A8F8C",
};

const PHASES = {
  base:   { label: "基礎期",   color: C.water, note:"鞏固有氧與技術" },
  build1: { label: "強化期一", color: C.power, note:"提升FTP與閾值" },
  build2: { label: "強化期二", color: C.power, note:"長課逼近比賽時長" },
  peak:   { label: "巔峰期",   color: C.red,   note:"180km模擬・專項刺激" },
  taper:  { label: "減量期",   color: C.green, note:"降量保強度・超補償" },
  race:   { label: "比賽週",   color: C.gold,  note:"最終確認・祝完賽順利" },
};
function climateNote(month) {
  if (month >= 6 && month <= 9) return "高溫期：課表移清晨/室內,勤補電解質";
  if (month === 5 || month === 10) return "過渡季：早晚舒適,長課清晨出發";
  return "涼爽季：配速可貼近目標,品質黃金期";
}

const DAY_OFFSET = { mon:0, tue:1, wed:2, thu:3, fri:4, sat:5, sun:6 };
const DAY_LABEL = { mon:"一", tue:"二", wed:"三", thu:"四", fri:"五", sat:"六", sun:"日" };

function mondayOfThisWeek() {
  const d = new Date(); d.setHours(0,0,0,0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}
function fmtDate(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }

/* ---------------- zone / pace math ---------------- */
const BIKE_ZONES = { Z1:[0,0.55], Z2:[0.56,0.75], Z3:[0.76,0.90], Z4:[0.91,1.05], Z5:[1.06,1.20], Z6:[1.21,1.50], Z7:[1.51,2.0] };
function bikeZoneText(ftp, key) {
  const [lo, hi] = BIKE_ZONES[key];
  const a = Math.round(ftp * lo), b = Math.round(ftp * hi);
  if (key === "Z7") return `${key} ${a}W+`;
  if (key === "Z2") return `${key} ${a}-${b}W`;
  return `${key}(${Math.round(lo*100)}-${Math.round(hi*100)}%FTP) ${a}-${b}W`;
}
function renderBike(text, ftp) {
  return text
    .replace(/Sweet Spot\(88-93%FTP\)/g, `Sweet Spot(88-93%FTP, ${Math.round(ftp*0.88)}-${Math.round(ftp*0.93)}W)`)
    .replace(/\{(Z[1-7])\}/g, (_, k) => bikeZoneText(ftp, k));
}
const SWIM_OFFSET = { EN1: 25, EN2: 12, THR: 0, VO2: -6 };
const SWIM_FALLBACK = { EN1: "輕鬆", EN2: "中等", THR: "門檻", VO2: "最大攝氧" };
function paceStr(sec){ const m=Math.floor(sec/60), r=Math.round(sec%60); return `${m}:${String(r).padStart(2,"0")}`; }
function renderSwim(text, tp) {
  return text.replace(/\{(EN1|EN2|THR|VO2)\}/g, (_, k) => tp ? `(${k} ${paceStr(tp + SWIM_OFFSET[k])}/100m)` : `(${SWIM_FALLBACK[k]})`);
}
function parseMS(s){ const m=/^(\d+):(\d{1,2})$/.exec((s||"").trim()); return m ? (+m[1])*60+(+m[2]) : null; }
function parseHMM(s){ const m=/^(\d+):(\d{1,2})$/.exec((s||"").trim()); return m ? (+m[1])*3600+(+m[2])*60 : null; }
function runPaces(str){
  const t = parseHMM(str); if(!t) return null;
  const mp = t/42.195;
  return { easy:[mp*1.15, mp*1.28], long:[mp*1.08, mp*1.18], mp, thr: mp*0.955, itv:[mp*0.88, mp*0.93], im:[mp+35, mp+55] };
}
function round5(v){ return Math.round(v/5)*5; }
function round50(v){ return Math.round(v/50)*50; }
function tssCalc(segs){ return Math.round(segs.reduce((a,[m,i]) => a + m*i*i, 0) / 60 * 100); }
function trainerLong(mins){ return `室內 ${round5(mins*0.85)}分（戶外 ${mins}分）`; }
function fmtHM(sec){ const h=Math.floor(sec/3600), m=Math.round((sec%3600)/60); return `${h}:${String(m).padStart(2,"0")}`; }

/* ---------------- strength ---------------- */
const STRENGTH = {
  base:  {t:"肌力基礎", x:"3-4組x8-10下:深蹲/硬舉/臥推/划船;單邊動作+抗旋轉核心;每週+3-5%負荷"},
  build1:{t:"最大肌力", x:"主項4-6RM,3-4組,組間休2-3分;推拉平衡護肩"},
  build2:{t:"最大肌力+爆發啟蒙", x:"維持4-6RM+單邊最大肌力;後半加登箱跳2-3組x5"},
  peak:  {t:"爆發力轉換", x:"登階跳/藥球拋擲,3組x5-6,總量降低重質不重量"},
  taper: {t:"神經活化", x:"極輕高速,2組x5;賽前一週僅動態伸展或跳過"},
  race:  {t:"賽前活化(選)", x:"動態熱身+彈力帶10分內,或跳過"},
};

/* ---------------- swim/bike generators ---------------- */
function genSwimBike(phase, wi, rec) {
  const f = rec ? 0.72 : 1;
  if (phase === "base") {
    const r1=Math.max(6,Math.round((8+(wi-1))*f)), r2=Math.max(6,Math.round((10+(wi-1)*2)*f));
    const d3=Math.max(1400,round50((2000+(wi-1)*250)*f));
    const bw=Math.max(55,round5((75+(wi-1)*5)*f)), bte=Math.max(8,Math.round((12+(wi-1)*2)*f)), btr=4;
    const bs=Math.max(120,round5((170+(wi-1)*25)*f));
    return { swim:{
      tue:{t:"技術✕有氧", x:`熱身400m;技術8x50m;主課 ${r1}x150m {EN2} 息15秒;緩和200m`, v:`${800+r1*150+200}m`},
      fri:{t:"閾值間歇", x:`熱身400m;主課 ${r2}x100m {THR} 息15秒;緩和200m`, v:`${400+r2*100+200}m`},
      sun:{t:"有氧耐力", x:`連續 ${d3}m {EN1};緩和200m`, v:`${d3+200}m`},
    }, bike:{
      wed:{t:"Z2+Tempo收尾", x:`${bw}分 {Z2},最後10分 {Z3};跑步間歇在前,間隔4小時+`, v:`${bw}分`, tss:tssCalc([[bw-10,0.65],[10,0.83]])},
      thu:{t:"閾值間歇", x:`熱身15分;主課 ${btr}x${bte}分 {Z3}上緣~{Z4}下緣(室內取下緣,開風扇);息4分;緩和10分`, v:`${15+btr*bte+btr*4+10}分`, tss:tssCalc([[15,0.6],[btr*bte,0.88],[btr*4,0.5],[10,0.55]])},
      sat:{t:"長騎有氧", x:`{Z2},${trainerLong(bs)};每20分補水+電解質`, v:`${bs}分`, tss:tssCalc([[bs,0.65]])},
    }};
  }
  if (phase === "build1") {
    const r1=Math.max(4,Math.round((6+(wi-1))*f)), r2=Math.max(3,Math.round((4+(wi-1))*f));
    const d3=Math.max(1800,round50((2600+(wi-1)*200)*f));
    const bw=Math.max(60,round5((80+(wi-1)*5)*f)), bte=Math.max(12,Math.round((15+(wi-1)*2)*f)), btr=3;
    const bs=Math.max(150,round5((220+(wi-1)*20)*f));
    return { swim:{
      tue:{t:"有氧量能", x:`熱身400m;技術8x50m;主課 ${r1}x200m {EN2} 息20秒;緩和200m`, v:`${800+r1*200+200}m`},
      fri:{t:"長閾值", x:`熱身400m;主課 ${r2}x300m {THR} 息30秒;緩和200m`, v:`${400+r2*300+200}m`},
      sun:{t:"開放水域✕配速", x:`連續${d3}m,抬頭定位,後段比賽配速;緩和200m`, v:`${d3+200}m`},
    }, bike:{
      wed:{t:"Z2+Sweet Spot", x:`${bw}分 {Z2},中段2x10分 Sweet Spot(88-93%FTP);跑步間歇後4小時+`, v:`${bw}分`, tss:tssCalc([[bw-20,0.65],[20,0.90]])},
      thu:{t:"FTP強化", x:`熱身15分;主課 ${btr}x${bte}分 {Z4}(室內91%FTP起);息5分;緩和10分`, v:`${15+btr*bte+btr*5+10}分`, tss:tssCalc([[15,0.6],[btr*bte,0.92],[btr*5,0.5],[10,0.55]])},
      sat:{t:"長距耐力", x:`{Z2},${trainerLong(bs)};鎖空力姿勢`, v:`${bs}分`, tss:tssCalc([[bs,0.67]])},
    }};
  }
  if (phase === "build2") {
    const r1=Math.max(4,Math.round((6+(wi-1))*f)), r2=Math.max(3,Math.round((5+(wi-1))*f));
    const d3=Math.max(2200,round50((3000+(wi-1)*200)*f));
    const bw=Math.max(60,round5((85+(wi-1)*5)*f)), bte=Math.max(14,Math.round((18+(wi-1)*3)*f)), btr=3;
    const bs=Math.max(180,round5((270+(wi-1)*25)*f));
    const brick = wi>=2 && !rec;
    return { swim:{
      tue:{t:"有氧維持", x:`熱身400m;技術6x50m;主課 ${r1}x200m {EN2} 息20秒;緩和200m`, v:`${700+r1*200+200}m`},
      fri:{t:"高強度閾值", x:`熱身400m;主課 ${r2}x300m {THR} 息30秒;緩和200m`, v:`${400+r2*300+200}m`},
      sun:{t:"長泳耐力", x:`連續${d3}m,模擬比賽節奏與補給;緩和200m`, v:`${d3+200}m`},
    }, bike:{
      wed:{t:"Z2+Sweet Spot", x:`${bw}分 {Z2},中段2x12分 Sweet Spot(88-93%FTP);跑步間歇後4小時+`, v:`${bw}分`, tss:tssCalc([[bw-24,0.65],[24,0.90]])},
      thu:{t:"FTP高峰", x:`熱身15分;主課 ${btr}x${bte}分 {Z4} 下緣;息5分;緩和10分`, v:`${15+btr*bte+btr*5+10}分`, tss:tssCalc([[15,0.6],[btr*bte,0.93],[btr*5,0.5],[10,0.55]])},
      sat:{t: brick ? "長距+Brick" : "長距耐力", x:`{Z2}~{Z3},${trainerLong(bs)}${brick?";下車接20分226配速跑":""};建議部分戶外`, v:`${bs}分`, tss:tssCalc([[bs,0.70]])},
    }};
  }
  if (phase === "peak") {
    const T = [
      { swim:{ tue:{t:"有氧維持", x:"熱身400m;技術6x50m;主課 6x200m {EN2} 息20秒;緩和200m", v:"2200m"},
               fri:{t:"高強度閾值", x:"熱身400m;主課 6x300m {THR} 息30秒;緩和200m", v:"2600m"},
               sun:{t:"長泳✕配速", x:"連續3200m {EN1},後1000m比賽配速;緩和200m", v:"3400m"} },
        bike:{ wed:{t:"Z2+Sweet Spot", x:"90分 {Z2},中段2x12分 Sweet Spot(88-93%FTP)", v:"90分", tss:79},
               thu:{t:"FTP高峰", x:"熱身15分;主課 3x20分 {Z4} 下緣;息5分;緩和10分", v:"110分", tss:105},
               sat:{t:"前哨長騎+Brick", x:"比賽配速 {Z3};戶外270分/室內230分;下車接30分226配速跑", v:"4.5hr+30分", tss:288} } },
      { key:true,
        swim:{ tue:{t:"量能維持", x:"熱身400m;技術6x50m;主課 5x200m {EN2} 息20秒;緩和200m", v:"2100m"},
               fri:{t:"高強度閾值", x:"熱身400m;主課 5x300m {THR} 息30秒;緩和200m", v:"2500m"},
               sun:{t:"🔑長泳關鍵", x:"連續3600m,全程比賽配速,完整演練補給;緩和200m", v:"3800m"} },
        bike:{ wed:{t:"恢復迴轉", x:"50分 {Z1}~{Z2}", v:"50分", tss:28},
               thu:{t:"FTP高峰", x:"熱身15分;主課 2x28分 {Z4} 下緣;息8分;緩和10分", v:"105分", tss:99},
               sat:{t:"🔑180km關鍵+Brick", x:"全程比賽配速 {Z3},務必戶外,300-330分;下車接40分226配速跑 — 最重單日", v:"5.5hr+40分", tss:335} } },
      { swim:{ tue:{t:"量能收斂", x:"熱身400m;主課 4x200m {EN2} 息20秒;緩和200m", v:"1800m"},
               fri:{t:"閾值維持", x:"熱身400m;主課 4x250m {THR} 息25秒;緩和200m", v:"1800m"},
               sun:{t:"中距收量", x:"連續2400m {EN1};緩和200m", v:"2600m"} },
        bike:{ wed:{t:"恢復迴轉", x:"45分 {Z1}~{Z2}", v:"45分", tss:24},
               thu:{t:"FTP維持", x:"熱身15分;主課 3x12分 {Z4};息4分;緩和10分", v:"75分", tss:71},
               sat:{t:"長騎收斂", x:"{Z2} 含30分比賽配速;室內155分/戶外180分", v:"3hr", tss:142} } },
    ];
    return T[Math.min(wi-1, 2)];
  }
  const T = [
    { swim:{ tue:{t:"減量有氧", x:"熱身300m;主課 4x100m {EN2} 息20秒;緩和200m", v:"1000m"},
             fri:{t:"減量閾值", x:"熱身300m;主課 4x100m {THR} 息25秒;緩和200m", v:"1000m"},
             sun:{t:"輕鬆游", x:"連續1500m {EN1};緩和200m", v:"1700m"} },
      bike:{ wed:{t:"完全恢復", x:"30分 {Z1}", v:"30分", tss:15},
             thu:{t:"神經敏銳", x:"熱身15分;主課 3x5分 {Z4};息3分;緩和10分", v:"40分", tss:40},
             sat:{t:"減量長騎", x:"{Z2};室內75分/戶外90分", v:"1.5hr", tss:63} } },
    { swim:{ tue:{t:"賽前喚醒", x:"熱身300m;主課 4x50m 加速 {VO2} 息30秒;緩和200m", v:"700m"},
             fri:{t:"賽前開合", x:"熱身300m;主課 6x50m 比賽配速 息20秒;緩和200m", v:"700m"},
             sun:{t:"熟悉裝備", x:"連續1000m {EN1},比賽泳裝/防寒衣;緩和200m", v:"1200m"} },
      bike:{ wed:{t:"極輕量", x:"20分 {Z1}", v:"20分", tss:10},
             thu:{t:"賽前開合", x:"20分 {Z1}~{Z2},最後5分 {Z3}", v:"20分", tss:14},
             sat:{t:"裝備確認", x:"{Z2} 45分,戶外比賽車+輪組,測補給品", v:"45分", tss:32} } },
  ];
  return T[Math.min(wi-1, 1)];
}

/* ---------------- run generator ---------------- */
function genRun(phase, wi, rec, rp, key) {
  const P = (a) => rp ? `${paceStr(a)}/km` : "自覺強度";
  const PR = (a,b) => rp ? `${paceStr(a)}-${paceStr(b)}/km` : "自覺強度";
  const easy = rp ? PR(rp.easy[0], rp.easy[1]) : "對話配速";
  const lng = rp ? PR(rp.long[0], rp.long[1]) : "中等有氧";
  const mp = rp ? P(rp.mp) : "全馬配速";
  const thr = rp ? P(rp.thr) : "閾值";
  const itv = rp ? PR(rp.itv[0], rp.itv[1]) : "間歇";
  const im = rp ? PR(rp.im[0], rp.im[1]) : "226配速";
  const easyRun = { t:"輕鬆跑", x:`30-45分 @${easy},純恢復`, v:"30-45分" };

  if (phase === "base") {
    const lk = rec ? 14 : 16 + wi*2;
    return {
      wed:{ t:"間歇", x:`熱身2km;${rec?6:8+wi}x400m @${itv} 慢跑200m恢復;緩和1km`, v:`${rec?6:8+wi}x400m` },
      thu: easyRun,
      fri:{ t:"速度節奏", x:`熱身2km;${rec?6:10}x300m @${itv} +100m慢;緩和1km`, v:`${rec?6:10}x300m` },
      sat: easyRun,
      sun:{ t:"長跑", x:`${lk}km:前2/3 @${lng} 漸速至 ${mp},末1/3 @${im} 練節奏轉換`, v:`${lk}km` },
    };
  }
  if (phase === "build1") {
    const lk = rec ? 16 : 21 + wi*2;
    return {
      wed:{ t:"間歇", x:`熱身2km;${rec?3:5}x1000m @${thr} 休2分;緩和1km`, v:`${rec?3:5}x1000m` },
      thu: easyRun,
      fri:{ t:"節奏跑", x:`熱身2km;${rec?15:20+wi*5}分連續 @${thr};緩和1km`, v:`${rec?15:20+wi*5}分` },
      sat: easyRun,
      sun:{ t:"長跑", x:`${lk}km @${lng},中段3x2km @${mp};每40分補給`, v:`${lk}km` },
    };
  }
  if (phase === "build2") {
    const lk = Math.min(rec ? 18 : 24 + wi*2, 30);
    return {
      wed:{ t:"巡航間歇", x:`熱身2km;${rec?2:3}x2000m @${thr} 休90秒;緩和1km`, v:`${rec?2:3}x2km` },
      thu: easyRun,
      fri:{ t:"配速跑", x:`熱身2km;${rec?8:10+wi}km @${mp};緩和1km`, v:`${rec?8:10+wi}km` },
      sat: easyRun,
      sun:{ t:"長跑", x:`${lk}km:@${lng} 為主,末8km @${im},演練補給`, v:`${lk}km` },
    };
  }
  if (phase === "peak") {
    if (key) return {
      wed:{ t:"配速維持", x:`熱身2km;2x3km @${mp} 休2分;緩和1km`, v:"2x3km" },
      thu: easyRun,
      fri:{ t:"226配速", x:`熱身1km;6km @${im};緩和1km`, v:"6km" },
      sat: easyRun,
      sun:{ t:"短長跑", x:`昨日負荷大,僅14km @${easy}`, v:"14km" },
    };
    return {
      wed:{ t:"配速維持", x:`熱身2km;2x3km @${mp} 休2分+4x100m加速;緩和1km`, v:"2x3km" },
      thu: easyRun,
      fri:{ t:"226配速", x:`熱身1km;8-10km @${im},末2km提至 ${mp};緩和1km`, v:"8-10km" },
      sat: easyRun,
      sun:{ t:"長跑", x:`${wi===1?28:20}km @${lng},末6km @${im}`, v:`${wi===1?28:20}km` },
    };
  }
  const last = wi >= 2;
  return {
    wed:{ t:"神經喚醒", x:`熱身2km;${last?4:6}x200m @${itv};緩和1km`, v:`${last?4:6}x200m` },
    thu:{ t:"輕鬆跑", x:`${last?20:30}分 @${easy}`, v:`${last?20:30}分` },
    fri:{ t:"開合跑", x:`熱身1km;${last?3:4}km @${im};緩和1km`, v:`${last?3:4}km` },
    sat:{ t:"輕鬆跑", x:`20-30分 @${easy}+4x60m加速`, v:"20-30分" },
    sun:{ t:"中短長跑", x:`${last?8:12}km @${easy}`, v:`${last?8:12}km` },
  };
}

/* ---------------- plan builder ---------------- */
function buildPlan(raceDateStr) {
  const race = new Date(raceDateStr + "T00:00:00");
  if (isNaN(race)) return null;
  const start = mondayOfThisWeek();
  const days = Math.round((race - start) / 864e5);
  if (days < 21) return { error: "距比賽不足3週,建議直接進入減量與恢復。" };
  const n = Math.min(30, Math.floor(days / 7) + 1);
  const taper = n >= 12 ? 2 : 1;
  const peak = n >= 16 ? 3 : n >= 12 ? 2 : 1;
  const trainWeeks = n - 1 - taper - peak;
  const base = Math.max(1, Math.round(trainWeeks * 0.4));
  const build1 = Math.max(1, Math.round(trainWeeks * 0.3));
  const build2 = Math.max(0, trainWeeks - base - build1);

  const weeks = [];
  let idx = 1;
  const push = (phase, count) => {
    for (let wi = 1; wi <= count; wi++) {
      const rec = ["base","build1","build2"].includes(phase) && wi === count && count >= 3;
      const sb = genSwimBike(phase, wi, rec);
      weeks.push({ n: idx++, phase, rest: rec, key: !!sb.key, swim: sb.swim, bike: sb.bike, wi });
    }
  };
  push("base", base); push("build1", build1);
  if (build2 > 0) push("build2", build2);
  push("peak", peak); push("taper", taper);
  weeks.push({ n: idx, phase: "race", race: true });
  return { weeks, n, start };
}

/* ---------------- main ---------------- */
export default function IronmanPlan() {
  const [profile, setProfile] = useState({ height: 175, weight: 68, ftp: 250, tpace: "1:35", marathon: "3:20", raceDate: "2026-11-08", lastSwim: "", lastBike: "", lastRun: "", goal: "", adjS: 0, adjB: 0, adjR: 0 });
  const [editing, setEditing] = useState(true);
  const [selected, setSelected] = useState(1);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const p = await storage.get("athlete:profile", false);
        if (p && p.value) { setProfile((d) => ({ ...d, ...JSON.parse(p.value) })); setEditing(false); }
      } catch (e) {}
    })();
  }, []);
  useEffect(() => { setExpanded(null); }, [selected]);

  async function saveProfile(next) {
    setProfile(next);
    try { await storage.set("athlete:profile", JSON.stringify(next), false); } catch (e) {}
  }

  const plan = useMemo(() => buildPlan(profile.raceDate), [profile.raceDate]);
  const rp = runPaces(profile.marathon);
  const tpaceSec = parseMS(profile.tpace);
  const now = new Date();

  if (!plan || plan.error) {
    return (
      <Shell profile={profile} editing={true} setEditing={setEditing} saveProfile={saveProfile} rp={rp}>
        <div style={{ padding: 20, color: C.red, fontSize: 14 }}>{plan?.error || "請輸入有效的比賽日期"}</div>
      </Shell>
    );
  }

  const { weeks, n: N, start } = plan;
  const sel = Math.min(selected, N);
  const week = weeks.find((w) => w.n === sel);
  const phase = PHASES[week.phase];
  const dateFor = (weekN, dayKey) => { const d = new Date(start); d.setDate(d.getDate() + (weekN-1)*7 + DAY_OFFSET[dayKey]); return d; };
  const bikeTss = week.race ? 0 : (week.bike.wed.tss||0)+(week.bike.thu.tss||0)+(week.bike.sat.tss||0);
  const run = week.race ? null : genRun(week.phase, week.wi, week.rest, rp, week.key);
  const monMonth = dateFor(week.n, "mon").getMonth() + 1;
  const RUNCOLOR = { wed:C.red, thu:C.green, fri:C.red, sat:C.green, sun:C.gold };

  const mkRun = (day) => ({ id:`${day}-run`, color: RUNCOLOR[day], icon:<Footprints size={13}/>, title:`跑·${run[day].t}`, vol:run[day].v, detail:run[day].x });
  const mkBike = (day) => ({ id:`${day}-bike`, color:C.power, icon:<BikeIcon size={13}/>, title:week.bike[day].t, vol:`${week.bike[day].v}·TSS${week.bike[day].tss}`, detail:renderBike(week.bike[day].x, profile.ftp) });
  const mkSwim = (day) => ({ id:`${day}-swim`, color:C.water, icon:<Waves size={13}/>, title:week.swim[day].t, vol:week.swim[day].v, detail:renderSwim(week.swim[day].x, tpaceSec) });

  const rows = week.race ? [] : [
    { day:"mon", items:[{ rest:true }] },
    { day:"tue", items:[{ id:"tue-str", color:C.iron, icon:<Dumbbell size={13}/>, title:STRENGTH[week.phase].t, detail:STRENGTH[week.phase].x }, mkSwim("tue")] },
    { day:"wed", items:[mkRun("wed"), mkBike("wed")] },
    { day:"thu", items:[mkRun("thu"), mkBike("thu")] },
    { day:"fri", items:[mkRun("fri"), mkSwim("fri")] },
    { day:"sat", items:[mkRun("sat"), mkBike("sat")] },
    { day:"sun", items:[mkRun("sun"), mkSwim("sun")] },
  ];

  return (
    <Shell profile={profile} editing={editing} setEditing={setEditing} saveProfile={saveProfile} rp={rp}
      raceInfo={`${profile.raceDate} · ${N}週 · 倒數 ${N - sel > 0 ? `${N - sel}週` : "本週"}`}>
      <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
        <NavBtn dir="prev" disabled={sel===1} onClick={() => setSelected((s)=>Math.max(1,s-1))} />
        <div className="strip" style={{ display:"flex", gap:5, overflowX:"auto", padding:"3px 2px", flex:1 }}>
          {weeks.map((w) => {
            const active = w.n === sel;
            const isPast = dateFor(w.n, "sun") < now;
            return (
              <button key={w.n} onClick={() => setSelected(w.n)} className="osw"
                style={{ flexShrink:0, minWidth:42, borderRadius:8, padding:"4px 3px", cursor:"pointer",
                  background: active ? PHASES[w.phase].color : C.surface,
                  color: active ? "#fff" : (isPast ? C.muted : C.text),
                  border:`1px solid ${active ? PHASES[w.phase].color : C.line}`,
                  opacity: isPast && !active ? 0.55 : 1, textAlign:"center" }}>
                <div style={{ fontSize:11, fontWeight:700 }}>{w.race ? "🏁" : `W${w.n}`}</div>
                <div className="mono" style={{ fontSize:8.5 }}>{fmtDate(dateFor(w.n,"mon"))}</div>
              </button>
            );
          })}
        </div>
        <NavBtn dir="next" disabled={sel===N} onClick={() => setSelected((s)=>Math.min(N,s+1))} />
      </div>

      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap", fontSize:11.5 }}>
        <span className="osw" style={{ fontSize:12, letterSpacing:1, color:phase.color, textTransform:"uppercase", fontWeight:700 }}>
          {phase.label}{week.rest ? "·減量" : ""}{week.key ? "·🔑" : ""}
        </span>
        <span style={{ color:C.muted }}>{phase.note}</span>
        <span style={{ color:C.muted }}>|</span>
        <span style={{ color:C.muted, display:"flex", gap:4, alignItems:"center" }}><Sun size={11}/>{climateNote(monMonth)}</span>
        {!week.race && <span className="mono" style={{ fontSize:10.5, color:C.power, marginLeft:"auto" }}>騎TSS≈{bikeTss}</span>}
      </div>

      {week.race ? (
        <RaceWeekView profile={profile} rp={rp} dateFor={dateFor} weekN={week.n} raceDate={new Date(profile.raceDate+"T00:00:00")} />
      ) : (
        <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", background:C.surface }}>
          {rows.map((row, ri) => {
            const d = dateFor(week.n, row.day);
            const isPast = d < now && d.toDateString() !== now.toDateString();
            const isToday = d.toDateString() === now.toDateString();
            return (
              <div key={row.day} style={{ display:"flex", borderTop: ri===0 ? "none" : `1px solid ${C.line}`, opacity:isPast?0.5:1, background:isToday?"rgba(14,140,156,0.07)":"transparent" }}>
                <div style={{ width:44, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 0", borderRight:`1px solid ${C.line}` }}>
                  <span className="osw" style={{ fontSize:14, fontWeight:700, color:isToday?C.water:C.text }}>{DAY_LABEL[row.day]}</span>
                  <span className="mono" style={{ fontSize:9, color:C.muted }}>{fmtDate(d)}</span>
                </div>
                <div style={{ flex:1, padding:"6px 8px", display:"flex", flexDirection:"column", gap:4, minWidth:0 }}>
                  {row.items.map((it, ii) => {
                    if (it.rest) return (
                      <div key={ii} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.muted, padding:"4px 2px" }}>
                        <Moon size={12}/> 全休
                      </div>
                    );
                    const open = expanded === it.id;
                    return (
                      <div key={ii}>
                        <button className="rowbtn" onClick={() => setExpanded(open ? null : it.id)}
                          style={{ display:"flex", alignItems:"center", gap:6, width:"100%", background:"transparent", border:"none", color:C.text, cursor:"pointer", padding:"3px 2px", textAlign:"left", borderRadius:6 }}>
                          <span style={{ color:it.color, flexShrink:0, display:"flex" }}>{it.icon}</span>
                          <span style={{ fontSize:12.5, fontWeight:600, flexShrink:0 }}>{it.title}</span>
                          {it.vol && <span className="mono" style={{ fontSize:10.5, color:it.color, marginLeft:"auto", flexShrink:0 }}>{it.vol}</span>}
                          <ChevronDown size={13} color={C.muted} style={{ flexShrink:0, transform:open?"rotate(180deg)":"none", transition:"transform .15s", marginLeft:it.vol?0:"auto" }}/>
                        </button>
                        {open && <div style={{ fontSize:12, color:C.text, opacity:0.85, lineHeight:1.6, padding:"2px 4px 6px 21px", borderLeft:`2px solid ${it.color}`, marginLeft:5, marginTop:2 }}>{it.detail}</div>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Shell>
  );
}

/* ---------------- shell ---------------- */
function Shell({ profile, editing, setEditing, saveProfile, rp, raceInfo, children }) {
  return (
    <div style={{ minHeight: "100vh", background: C.ink, color: C.text, fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500;600&display=swap');
        .osw { font-family:'Oswald',sans-serif; } .mono { font-family:'Roboto Mono',monospace; }
        input { background:#fff; border:1px solid ${C.line}; color:${C.text}; border-radius:8px; padding:8px 10px; font-family:'Roboto Mono',monospace; font-size:14px; width:100%; }
        button:focus-visible, input:focus-visible { outline:2px solid ${C.water}; outline-offset:2px; }
        .strip::-webkit-scrollbar{ height:4px; } .strip::-webkit-scrollbar-thumb{ background:${C.line}; border-radius:4px; }
        .rowbtn { transition: background .12s ease; } .rowbtn:hover { background:${C.surface2}; }
      `}</style>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 50px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h1 className="osw" style={{ fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: 0.5 }}>Ironman 226 訓練面板</h1>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{raceInfo || "輸入數據,自動生成整期課表"}</div>
          </div>
          <button onClick={() => setEditing((v) => !v)} style={{ background: C.surface, border:`1px solid ${C.line}`, borderRadius:10, padding:"7px 10px", color:C.text, display:"flex", gap:5, alignItems:"center", cursor:"pointer", fontSize:12, flexShrink:0 }}>
            <Settings2 size={14} /> 我的數據
          </button>
        </div>

        {editing && (
          <div style={{ background: C.surface, border:`1px solid ${C.line}`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="比賽日期"><input type="date" value={profile.raceDate} onChange={(e) => saveProfile({ ...profile, raceDate:e.target.value })} /></Field>
              <Field label="全馬成績 h:mm"><input type="text" placeholder="3:20" value={profile.marathon} onChange={(e) => saveProfile({ ...profile, marathon:e.target.value })} /></Field>
              <Field label="FTP (W)"><input type="number" value={profile.ftp} onChange={(e) => saveProfile({ ...profile, ftp:+e.target.value })} /></Field>
              <Field label="游泳T-pace mm:ss"><input type="text" placeholder="1:35" value={profile.tpace} onChange={(e) => saveProfile({ ...profile, tpace:e.target.value })} /></Field>
              <Field label="上次226 游 h:mm"><input type="text" placeholder="1:25" value={profile.lastSwim} onChange={(e) => saveProfile({ ...profile, lastSwim:e.target.value })} /></Field>
              <Field label="上次226 騎 h:mm"><input type="text" placeholder="5:55" value={profile.lastBike} onChange={(e) => saveProfile({ ...profile, lastBike:e.target.value })} /></Field>
              <Field label="上次226 跑 h:mm"><input type="text" placeholder="3:50" value={profile.lastRun} onChange={(e) => saveProfile({ ...profile, lastRun:e.target.value })} /></Field>
              <Field label="目標完賽 h:mm"><input type="text" placeholder="10:45" value={profile.goal} onChange={(e) => saveProfile({ ...profile, goal:e.target.value })} /></Field>
            </div>
          </div>
        )}

        {rp && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:10, fontSize:11 }} className="mono">
            <PaceChip c={C.green} l="輕鬆" v={`${paceStr(rp.easy[0])}-${paceStr(rp.easy[1])}`} />
            <PaceChip c={C.gold} l="長跑" v={`${paceStr(rp.long[0])}-${paceStr(rp.long[1])}`} />
            <PaceChip c={C.red} l="閾值" v={paceStr(rp.thr)} />
            <PaceChip c={C.red} l="間歇" v={`${paceStr(rp.itv[0])}-${paceStr(rp.itv[1])}`} />
            <PaceChip c={C.water} l="226" v={`${paceStr(rp.im[0])}-${paceStr(rp.im[1])}`} />
          </div>
        )}
        <GoalAnalysis profile={profile} saveProfile={saveProfile} />
        {children}
      </div>
    </div>
  );
}

/* ---------------- goal analysis + 強項微調 ---------------- */
function GoalAnalysis({ profile, saveProfile }) {
  const sS=parseHMM(profile.lastSwim), sB=parseHMM(profile.lastBike), sR=parseHMM(profile.lastRun), g=parseHMM(profile.goal);
  if (!sS || !sB || !sR || !g) return null;
  const TRANS = 12*60;
  const lastMove = sS+sB+sR;
  const k = (g - TRANS) / lastMove;
  const adj = { s:(profile.adjS||0)*60, b:(profile.adjB||0)*60, r:(profile.adjR||0)*60 };
  const tgt = { s: sS*k + adj.s, b: sB*k + adj.b, r: sR*k + adj.r };
  const total = tgt.s + tgt.b + tgt.r + TRANS;
  const diff = Math.round((total - g)/60);
  const improvePct = ((1-k)*100).toFixed(1);
  const aggressive = k < 0.93;
  const setAdj = (key, delta) => saveProfile({ ...profile, [key]: (profile[key]||0) + delta });
  const rows = [
    ["游 3.8k", sS, tgt.s, `${paceStr(tgt.s/38)}/100m`, "adjS"],
    ["騎 180k", sB, tgt.b, `${(180/(tgt.b/3600)).toFixed(1)}km/h`, "adjB"],
    ["跑 42.2k", sR, tgt.r, `${paceStr(tgt.r/42.195)}/km`, "adjR"],
  ];
  return (
    <div style={{ background:C.surface, border:`1px solid ${aggressive?C.red:C.line}`, borderRadius:12, padding:"10px 12px", marginBottom:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
        <span className="osw" style={{ fontSize:12, color:C.gold, fontWeight:700, letterSpacing:0.5 }}>目標拆分</span>
        <span style={{ fontSize:11, color:C.muted }}>需進步{improvePct}%{aggressive && <b style={{color:C.red}}> ⚠️偏激進</b>}</span>
        <span className="mono" style={{ fontSize:11, marginLeft:"auto", color: diff===0?C.green:C.red }}>
          合計 {fmtHM(total)}{diff!==0 && `（${diff>0?"+":""}${diff}分）`}
        </span>
        {(profile.adjS||profile.adjB||profile.adjR) ? (
          <button onClick={() => saveProfile({ ...profile, adjS:0, adjB:0, adjR:0 })}
            style={{ background:"transparent", border:"none", color:C.muted, cursor:"pointer", padding:2, display:"flex" }} aria-label="重設微調">
            <RotateCcw size={13}/>
          </button>
        ) : null}
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"auto 1fr 1fr 1fr auto", gap:"5px 10px", fontSize:12, alignItems:"center" }} className="mono">
        <span/><span style={{ color:C.muted, fontSize:10.5 }}>上次</span><span style={{ color:C.muted, fontSize:10.5 }}>目標</span><span style={{ color:C.muted, fontSize:10.5 }}>配速</span><span style={{ color:C.muted, fontSize:10.5, fontFamily:"'Inter',sans-serif" }}>微調</span>
        {rows.map(([n, last, t, pace, key]) => (
          <React.Fragment key={key}>
            <span style={{ fontFamily:"'Inter',sans-serif", fontWeight:600, fontSize:12 }}>{n}</span>
            <span>{fmtHM(last)}</span>
            <span style={{ color:C.gold, fontWeight:600 }}>{fmtHM(t)}</span>
            <span style={{ color:C.water }}>{pace}</span>
            <span style={{ display:"flex", gap:3, alignItems:"center" }}>
              <MiniBtn onClick={() => setAdj(key, -1)}><Minus size={11}/></MiniBtn>
              <span style={{ width:26, textAlign:"center", fontSize:11 }}>{(profile[key]||0)>0?"+":""}{profile[key]||0}</span>
              <MiniBtn onClick={() => setAdj(key, 1)}><Plus size={11}/></MiniBtn>
            </span>
          </React.Fragment>
        ))}
      </div>
      <div style={{ fontSize:10.5, color:C.muted, marginTop:6 }}>
        微調單位=分鐘。強項已到天花板→按＋放慢該項,再把其他項按−補回,讓合計歸零。
      </div>
    </div>
  );
}
function MiniBtn({ onClick, children }) {
  return (
    <button onClick={onClick} style={{ width:20, height:20, borderRadius:5, background:C.surface2, border:`1px solid ${C.line}`, color:C.text, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}>
      {children}
    </button>
  );
}

/* ---------------- race week ---------------- */
function RaceWeekView({ profile, rp, dateFor, weekN, raceDate }) {
  const raceDayIdx = (raceDate.getDay() + 6) % 7;
  const keys = ["mon","tue","wed","thu","fri","sat","sun"];
  const tasks = [
    "全休;檢查裝備與補給採買",
    "游泳喚醒:300m+4x50m加速+200m",
    "單車喚醒:30分輕鬆,中段3x2分比賽配速;查車況",
    "輕鬆跑20分+4x20秒步幅;增加碳水",
    "移動/報到;熟悉轉換區;早睡",
    "檢錄/託運;15分極輕活動;確認氣象;早睡",
  ];
  const preDays = keys.slice(0, raceDayIdx);
  const chosen = tasks.slice(Math.max(0, tasks.length - preDays.length));
  return (
    <div>
      {preDays.length > 0 && (
        <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", marginBottom:10, background:C.surface }}>
          {preDays.map((kk, i) => (
            <div key={kk} style={{ display:"flex", borderTop:i===0?"none":`1px solid ${C.line}` }}>
              <div style={{ width:44, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"7px 0", borderRight:`1px solid ${C.line}` }}>
                <span className="osw" style={{ fontSize:14, fontWeight:700 }}>{DAY_LABEL[kk]}</span>
                <span className="mono" style={{ fontSize:9, color:C.muted }}>{fmtDate(dateFor(weekN,kk))}</span>
              </div>
              <div style={{ flex:1, padding:"7px 10px", fontSize:12, lineHeight:1.5 }}>{chosen[i]}</div>
            </div>
          ))}
        </div>
      )}
      <div style={{ border:`1.5px solid ${C.gold}`, borderRadius:12, padding:"12px 14px", background:"rgba(168,127,0,0.07)" }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:6, display:"flex", gap:6, alignItems:"center" }}><Flag size={15} color={C.gold}/>{DAY_LABEL[keys[raceDayIdx]]} {fmtDate(raceDate)} — 226 比賽日</div>
        <div style={{ fontSize:12.5, lineHeight:1.7 }}>
          <div><b style={{ color:C.water }}>游 3.8k</b>：輕鬆-中等,起跳勿快,善用跟游</div>
          <div><b style={{ color:C.power }}>騎 180k</b>：70-75%FTP（{Math.round(profile.ftp*0.7)}-{Math.round(profile.ftp*0.75)}W）,15-20分補給一次</div>
          <div><b style={{ color:C.red }}>跑 42.2k</b>：{rp ? `${paceStr(rp.im[0])}-${paceStr(rp.im[1])}/km` : "輕鬆-中等"},前10km壓慢</div>
        </div>
      </div>
    </div>
  );
}

/* ---------------- small components ---------------- */
function Field({ label, children }) {
  return (<label style={{ display:"block" }}><div style={{ fontSize:10.5, color:C.muted, marginBottom:3 }}>{label}</div>{children}</label>);
}
function PaceChip({ c, l, v }) {
  return (<span style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:6, padding:"2px 7px", display:"inline-flex", gap:5 }}>
    <span style={{ color:c, fontWeight:600 }}>{l}</span><span style={{ color:C.text }}>{v}</span></span>);
}
function NavBtn({ dir, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={dir==="prev"?"上一週":"下一週"}
      style={{ width:28, height:28, borderRadius:"50%", background:C.surface, border:`1px solid ${C.line}`, color: disabled?C.muted:C.text, display:"flex", alignItems:"center", justifyContent:"center", cursor: disabled?"not-allowed":"pointer", opacity: disabled?0.4:1, flexShrink:0 }}>
      {dir==="prev" ? <ChevronLeft size={15}/> : <ChevronRight size={15}/>}
    </button>
  );
}
