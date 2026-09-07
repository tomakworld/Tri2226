import React, { useState, useEffect, useMemo } from "react";
import { Waves, Bike as BikeIcon, Footprints, Dumbbell, Moon, Settings2, ChevronLeft, ChevronRight, Flag, Sun, ChevronDown, Minus, Plus, RotateCcw, Link2 } from "lucide-react";

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
  peak:   { label: "巔峰期",   color: C.red,   note:"維持強度・關鍵長騎" },
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
function encodeProfile(p){
  try { return btoa(encodeURIComponent(JSON.stringify(p))).replace(/=+$/,""); } catch(e){ return ""; }
}
function decodeProfile(str){
  try { return JSON.parse(decodeURIComponent(atob(str))); } catch(e){ return null; }
}

/* ---------------- persistent profile storage ----------------
   Priority on load:
   1) ?d= shared/personal URL payload
   2) window.storage (host environment)
   3) localStorage (normal browser fallback)
   Saving writes to BOTH storage layers when available and keeps ?d= updated.
---------------------------------------------------------------- */
const PROFILE_KEY = "athlete:profile:v4"; // V5 deliberately retains the V4 key for seamless migration.
async function loadSavedProfile(){
  // URL payload is the most portable source and works across devices/bookmarks.
  try {
    const raw = new URLSearchParams(window.location.search).get("d");
    const fromUrl = raw ? decodeProfile(raw) : null;
    if (fromUrl) return { value: fromUrl, source:"url" };
  } catch(e){}

  // Host-provided persistent storage.
  try {
    if (window.storage) {
      const p = await window.storage.get(PROFILE_KEY, false);
      if (p && p.value) return { value: JSON.parse(p.value), source:"storage" };
      // Backward compatibility with previous versions.
      const old = await window.storage.get("athlete:profile", false);
      if (old && old.value) return { value: JSON.parse(old.value), source:"storage-old" };
    }
  } catch(e){}

  // Browser fallback.
  try {
    const raw = localStorage.getItem(PROFILE_KEY) || localStorage.getItem("athlete:profile");
    if (raw) return { value: JSON.parse(raw), source:"localStorage" };
  } catch(e){}

  return null;
}
async function persistProfile(next){
  const raw = JSON.stringify(next);

  try {
    if (window.storage) await window.storage.set(PROFILE_KEY, raw, false);
  } catch(e){}

  try {
    localStorage.setItem(PROFILE_KEY, raw);
  } catch(e){}

  // Keep a portable restore payload in the URL without reloading the page.
  try {
    const enc = encodeProfile(next);
    if (enc) {
      const url = `${window.location.pathname}?d=${enc}${window.location.hash}`;
      window.history.replaceState(null, "", url);
    }
  } catch(e){}
}
function isoOfMonday(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }

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
    .replace(/\{P:([\d.]+)-([\d.]+)\}/g, (_, a, b) => `${Math.round(ftp*(+a))}-${Math.round(ftp*(+b))}W(${Math.round(+a*100)}-${Math.round(+b*100)}%FTP)`)
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
const DISTS = {
  "226": { sw:3.8, bk:180, rn:42.2, k:1,   bikeIF:[0.70,0.75], imOff:[35,55] },
  "113": { sw:1.9, bk:90,  rn:21.1, k:0.7, bikeIF:[0.78,0.83], imOff:[15,30] },
};
/* 跑步配速:以半馬PB為錨(Daniels式換算) */
function runPaces(hmStr, dist){
  const t = parseHMM(hmStr); if(!t) return null;
  const hp = t/21.0975;
  const mp = hp*1.055;
  const off = (dist||DISTS["226"]).imOff;
  return { easy:[mp*1.15, mp*1.28], long:[mp*1.08, mp*1.18], mp, thr: hp, itv:[hp*0.93, hp*0.96], im:[mp+off[0], mp+off[1]] };
}
/* 無比賽成績:以單項PB預測拆分(平路假設,誤差±10-15%) */
function predictSplits(profile, dist){
  const tp = parseMS(profile.tpace), hm = parseHMM(profile.hm), ftp = +profile.ftp;
  if (!tp || !hm || !ftp) return null;
  const swim = tp * 1.10 * (dist.sw*10);
  const raceIF = raceIFFor(profile, dist);
  const v = Math.pow((ftp * (raceIF[0]+raceIF[1])/2) / 0.0061, 1/3);
  const bike = dist.bk / v * 3600;
  const run = dist.id==="113" ? hm + 13*60 : hm*2.085 + 38*60;
  return { s:swim, b:bike, r:run };
}
function round5(v){ return Math.round(v/5)*5; }
function round50(v){ return Math.round(v/50)*50; }
function tssCalc(segs){ return Math.round(segs.reduce((a,[m,i]) => a + m*i*i, 0) / 60 * 100); }
function trainerLong(mins){ return `室內 ${round5(mins*0.85)}分（戶外 ${mins}分）`; }
function fmtHM(sec){ const h=Math.floor(sec/3600), m=Math.round((sec%3600)/60); return `${h}:${String(m).padStart(2,"0")}`; }

/* ---------------- athlete profile / load scaling ---------------- */
function clamp(v, lo, hi){ return Math.max(lo, Math.min(hi, v)); }
function athleteModel(profile, dist){
  const hrs = Math.max(0, +profile.weekHours || 0);
  const swimKm = Math.max(0, +profile.curSwimKm || 0);
  const bikeH = Math.max(0, +profile.curBikeHours || 0);
  const runKm = Math.max(0, +profile.curRunKm || 0);
  const exp = profile.triExp || "first";
  const goal = profile.goalType || "finish";
  const strengthExp = profile.strengthExp || "none";

  // 週量耐受度是 volume 的主要依據；速度能力仍由 FTP/T-pace/HM PB 決定。
  const targetH = dist.id === "226" ? 11 : 8;
  const timeFactor = hrs > 0 ? clamp(hrs / targetH, 0.62, 1.18) : 0.82;
  const baseLoad = dist.id === "226"
    ? clamp((swimKm/7 + bikeH/6 + runKm/45) / 3, 0.55, 1.18)
    : clamp((swimKm/5 + bikeH/4.5 + runKm/35) / 3, 0.60, 1.18);
  const expFactor = { first:0.88, sprint:0.92, "113":1.0, "226":1.08, multi:1.12 }[exp] || 0.9;
  const goalFactor = { finish:0.92, pb:1.0, ag:1.07, custom:1.0 }[goal] || 1.0;
  let volumeFactor = clamp(0.45*timeFactor + 0.35*baseLoad + 0.20*expFactor, 0.58, 1.15);
  const qualityFactor = clamp((expFactor*0.55 + goalFactor*0.45), 0.85, 1.10);

  const longestBike = Math.max(0, +profile.longBikeKm || 0);
  const longestRun = Math.max(0, +profile.longRunKm || 0);
  const longestSwim = Math.max(0, +profile.longSwimM || 0);
  const readiness = [];
  let readinessFactor = 1;
  if (dist.id === "226") {
    if (longestBike && longestBike < 100) { readiness.push("目前最長騎乘未達100km，長騎進階採保守模式"); readinessFactor *= 0.94; }
    if (longestRun && longestRun < 20) { readiness.push("目前最長跑不足20km，跑量需優先建立耐受度"); readinessFactor *= 0.96; }
    if (longestSwim && longestSwim < 2500) { readiness.push("目前最長游泳不足2500m，先建立連續游耐力"); readinessFactor *= 0.97; }
  } else {
    if (longestBike && longestBike < 60) { readiness.push("目前最長騎乘未達60km，113長騎採保守進階"); readinessFactor *= 0.95; }
    if (longestRun && longestRun < 12) { readiness.push("目前最長跑不足12km，先建立跑步耐受度"); readinessFactor *= 0.97; }
  }
  volumeFactor = clamp(volumeFactor * readinessFactor, 0.55, 1.15);
  const br = bikeRunModel(profile, dist);
  return { hrs, swimKm, bikeH, runKm, exp, goal, strengthExp, timeFactor, baseLoad, expFactor, goalFactor, readinessFactor, volumeFactor, qualityFactor, readiness, br };
}

/* ---------------- bike/run relative-strength personalization ----------------
   Swim remains technique-led: T-pace sets pace zones, while swim volume follows
   overall load capacity/readiness rather than a "strong/weak" numeric ranking.
   Bike + Run can be compared more defensibly from FTP W/kg, open-HM ability,
   current discipline load, longest-session readiness, and (when complete)
   previous triathlon bike/run splits.
-------------------------------------------------------------------------- */
function bikeRunModel(profile, dist){
  const ftp = Math.max(0, +profile.ftp || 0);
  const kg = Math.max(1, +profile.weight || 1);
  const wkg = ftp / kg;
  const hm = parseHMM(profile.hm);
  const hmPace = hm ? hm / 21.0975 : null; // sec/km

  // Ability anchors are intentionally broad; they create relative emphasis,
  // not a population percentile or medical/physiological classification.
  const bikeAbility = clamp((wkg - 2.2) / 2.2, 0, 1);
  const runAbility = hmPace ? clamp((360 - hmPace) / 120, 0, 1) : 0.5;

  // Durability/readiness: current weekly discipline load + longest session.
  const bikeWeeklyRef = dist.id === "226" ? 6 : 4.5;
  const runWeeklyRef = dist.id === "226" ? 45 : 35;
  const bikeLongRef = dist.id === "226" ? 140 : 75;
  const runLongRef = dist.id === "226" ? 28 : 18;
  const bikeDur = clamp(((+profile.curBikeHours||0)/bikeWeeklyRef)*0.55 + ((+profile.longBikeKm||0)/bikeLongRef)*0.45, 0, 1.15);
  const runDur = clamp(((+profile.curRunKm||0)/runWeeklyRef)*0.55 + ((+profile.longRunKm||0)/runLongRef)*0.45, 0, 1.15);

  let bikeScore = bikeAbility*0.65 + clamp(bikeDur,0,1)*0.35;
  let runScore = runAbility*0.65 + clamp(runDur,0,1)*0.35;

  // Complete previous-race bike/run splits add a small durability-specific signal.
  const lastB = parseHMM(profile.lastBike), lastR = parseHMM(profile.lastRun);
  if (lastB && lastR) {
    const bikeKmh = dist.bk / (lastB/3600);
    const runP = lastR / dist.rn;
    const bikeRace = clamp((bikeKmh - (dist.id==="226"?27:29)) / 10, 0, 1);
    const runRace = clamp(((dist.id==="226"?390:360) - runP) / 120, 0, 1);
    bikeScore = bikeScore*0.85 + bikeRace*0.15;
    runScore = runScore*0.85 + runRace*0.15;
  }

  const delta = bikeScore - runScore;
  let bikeFactor = 1, runFactor = 1, label = "騎跑均衡";
  if (delta >= 0.18) {
    // Bike is relatively stronger: preserve bike quality, shift a small amount
    // of volume budget toward run development.
    bikeFactor = 0.95; runFactor = 1.08; label = "單車相對強・跑步優先";
  } else if (delta <= -0.18) {
    bikeFactor = 1.08; runFactor = 0.95; label = "跑步相對強・單車優先";
  } else if (delta >= 0.08) {
    bikeFactor = 0.98; runFactor = 1.04; label = "單車略強";
  } else if (delta <= -0.08) {
    bikeFactor = 1.04; runFactor = 0.98; label = "跑步略強";
  }

  // Goal can increase quality, but discipline reallocation stays deliberately small.
  // The overall athleteModel still caps total load by available time/readiness.
  return { wkg, hmPace, bikeAbility, runAbility, bikeDur, runDur, bikeScore, runScore, delta, bikeFactor, runFactor, label };
}

function scaledMinutes(v, A, min=20){ return Math.max(min, round5(v * A.volumeFactor)); }
function scaledDistance(v, A, min=800){ return Math.max(min, round50(v * A.volumeFactor)); }
function strengthFor(phase, exp){
  if (exp === "none") {
    const beginner = {
      base:{t:"肌力入門",x:"2-3組x10-12下：徒手/杯式深蹲、臀橋、划船、提踵、抗旋轉核心；保留3-4下餘裕，先學動作"},
      build1:{t:"肌力建立",x:"3組x8-10下，逐步加重但不做到力竭；單邊動作+核心"},
      build2:{t:"肌力維持",x:"2-3組x6-8下，中等重量；不安排高衝擊爆發動作"},
      peak:{t:"肌力維持",x:"2組x6-8下，總量減半，不追重量PR"},
      taper:{t:"神經活化",x:"彈力帶+動態熱身10分鐘內"}, race:{t:"賽前活化(選)",x:"動態熱身10分鐘內或跳過"}
    }; return beginner[phase];
  }
  if (exp === "lt1") {
    const x = STRENGTH[phase];
    return {...x, x:x.x.replace("4-6RM,3-4組","6-8RM,3組").replace("維持4-6RM","維持6-8RM")};
  }
  return STRENGTH[phase];
}

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
function genSwimBike(phase, wiRaw, rec, dist, A) {
  const wi = Math.min(wiRaw, 6);
  const f = (rec ? 0.72 : 1) * dist.k * (A?.volumeFactor || 1);
  const bf = A?.br?.bikeFactor || 1;
  const qf = A?.qualityFactor || 1;
  if (phase === "base") {
    const r1=Math.max(6,Math.round((8+(wi-1))*f)), r2=Math.max(6,Math.round((10+(wi-1)*2)*f));
    const d3=Math.max(1400,round50((2000+(wi-1)*250)*f));
    const bw=Math.max(55,round5((75+(wi-1)*5)*f*bf)), bte=Math.max(8,Math.round((12+(wi-1)*2)*f*qf*clamp(bf,0.96,1.05))), btr=4;
    const bs=Math.max(120,round5((170+(wi-1)*25)*f*bf));
    return { swim:{
      tue:{t:"技術✕有氧", x:`熱身400m;技術8x50m;主課 ${r1}x150m {EN2} 息15秒;緩和200m`, v:`${800+r1*150+200}m`},
      fri:{t:"閾值間歇", x:`熱身400m;主課 ${r2}x100m {THR} 息15秒;緩和200m`, v:`${400+r2*100+200}m`},
      sun:{t:"有氧耐力", x:`連續 ${d3}m {EN1};緩和200m`, v:`${d3+200}m`},
    }, bike:{
      wed:{t:"Z2+Tempo收尾", x:`${bw}分 @{P:0.62-0.72},最後10分拉至 @{P:0.78-0.83};跑步間歇在前,間隔4小時+`, v:`${bw}分`, tss:tssCalc([[bw-10,0.65],[10,0.83]])},
      thu:{t:"閾值間歇", x:`熱身15分;主課 ${btr}x${bte}分 @{P:0.88-0.91}(務必開風扇);息4分(短休息,練有氧天花板與乳酸排除);緩和10分`, v:`${15+btr*bte+btr*4+10}分`, tss:tssCalc([[15,0.6],[btr*bte,0.88],[btr*4,0.5],[10,0.55]])},
      sat:{t:"長騎有氧", x:`@{P:0.62-0.72},${trainerLong(bs)};每20分補水+電解質`, v:`${bs}分`, tss:tssCalc([[bs,0.65]])},
    }};
  }
  if (phase === "build1") {
    const r1=Math.max(4,Math.round((6+(wi-1))*f)), r2=Math.max(3,Math.round((4+(wi-1))*f));
    const d3=Math.max(1800,round50((2600+(wi-1)*200)*f));
    const bw=Math.max(60,round5((80+(wi-1)*5)*f*bf)), bte=Math.max(12,Math.round((15+(wi-1)*2)*f*qf*clamp(bf,0.96,1.05))), btr=3;
    const bs=Math.max(150,round5((220+(wi-1)*20)*f*bf));
    return { swim:{
      tue:{t:"有氧量能", x:`熱身400m;技術8x50m;主課 ${r1}x200m {EN2} 息20秒;緩和200m`, v:`${800+r1*200+200}m`},
      fri:{t:"長閾值", x:`熱身400m;主課 ${r2}x300m {THR} 息30秒;緩和200m`, v:`${400+r2*300+200}m`},
      sun:{t:"開放水域✕配速", x:`連續${d3}m,抬頭定位,後段比賽配速;緩和200m`, v:`${d3+200}m`},
    }, bike:{
      wed:{t:"Z2+Sweet Spot", x:`${bw}分 @{P:0.62-0.72},中段2x10分 Sweet Spot @{P:0.88-0.93},組間休5分 @{P:0.55-0.65}(2:1);跑步間歇後4小時+`, v:`${bw}分`, tss:tssCalc([[bw-20,0.65],[20,0.90]])},
      thu:{t:"FTP強化", x:`熱身15分;主課 ${btr}x${bte}分 @{P:0.93-0.95}(先從下緣起);息5分(短休息,約3:1);緩和10分`, v:`${15+btr*bte+btr*5+10}分`, tss:tssCalc([[15,0.6],[btr*bte,0.92],[btr*5,0.5],[10,0.55]])},
      sat:{t:"長距耐力", x:`@{P:0.64-0.72},${trainerLong(bs)};鎖空力姿勢`, v:`${bs}分`, tss:tssCalc([[bs,0.67]])},
    }};
  }
  if (phase === "build2") {
    const r1=Math.max(4,Math.round((6+(wi-1))*f)), r2=Math.max(3,Math.round((5+(wi-1))*f));
    const d3=Math.max(2200,round50((3000+(wi-1)*200)*f));
    const bw=Math.max(60,round5((85+(wi-1)*5)*f*bf)), bte=Math.max(14,Math.round((18+(wi-1)*3)*f*qf*clamp(bf,0.96,1.05))), btr=3;
    const bs=Math.max(180,round5((270+(wi-1)*25)*f*bf));
    const brick = wi>=2 && !rec;
    return { swim:{
      tue:{t:"有氧維持", x:`熱身400m;技術6x50m;主課 ${r1}x200m {EN2} 息20秒;緩和200m`, v:`${700+r1*200+200}m`},
      fri:{t:"高強度閾值", x:`熱身400m;主課 ${r2}x300m {THR} 息30秒;緩和200m`, v:`${400+r2*300+200}m`},
      sun:{t:"長泳耐力", x:`連續${d3}m,模擬比賽節奏與補給;緩和200m`, v:`${d3+200}m`},
    }, bike:{
      wed:{t:"Z2+Sweet Spot", x:`${bw}分 @{P:0.62-0.72},中段2x12分 Sweet Spot @{P:0.88-0.93},組間休5分 @{P:0.55-0.65}(2.4:1);跑步間歇後4小時+`, v:`${bw}分`, tss:tssCalc([[bw-24,0.65],[24,0.90]])},
      thu:{t:"FTP高峰", x:`熱身15分;主課 ${btr}x${bte}分 @{P:0.93-0.95};息5分(短休息,約3:1);緩和10分`, v:`${15+btr*bte+btr*5+10}分`, tss:tssCalc([[15,0.6],[btr*bte,0.93],[btr*5,0.5],[10,0.55]])},
      sat:{t: brick ? "長距+Brick" : "長距耐力", x:`@{P:0.66-0.76},${trainerLong(bs)}${brick?";下車接20分226配速跑":""};建議部分戶外`, v:`${bs}分`, tss:tssCalc([[bs,0.70]])},
    }};
  }
  if (phase === "peak") {
    if (dist.id === "113") {
      const T113 = [
        { swim:{ tue:{t:"有氧維持", x:"熱身400m;主課 5x200m {EN2} 息20秒;緩和200m", v:"1600m"},
                 fri:{t:"高強度閾值", x:"熱身400m;主課 4x300m {THR} 息30秒;緩和200m", v:"1800m"},
                 sun:{t:"長泳✕配速", x:"連續1800m {EN1},後500m比賽配速;緩和200m", v:"2000m"} },
          bike:{ wed:{t:"Z2+Sweet Spot", x:"70分 @{P:0.62-0.72},中段2x10分 Sweet Spot @{P:0.88-0.93},組間休5分 @{P:0.55-0.65}", v:"70分", tss:60},
                 thu:{t:"FTP高峰", x:"熱身15分;主課 2x20分 @{P:0.93-0.95};息5分(短休息,約3:1);緩和10分", v:"90分", tss:82},
                 sat:{t:"90km前哨+Brick", x:"比賽配速 @{P:0.78-0.83};戶外160分/室內135分;下車接20分113配速跑", v:"2.7hr+20分", tss:158} } },
        { key:true,
          swim:{ tue:{t:"量能維持", x:"熱身400m;主課 4x200m {EN2} 息20秒;緩和200m", v:"1400m"},
                 fri:{t:"高強度閾值", x:"熱身400m;主課 4x250m {THR} 息25秒;緩和200m", v:"1600m"},
                 sun:{t:"🔑長泳關鍵", x:"連續2200m,全程比賽配速,演練補給;緩和200m", v:"2400m"} },
          bike:{ wed:{t:"恢復迴轉", x:"45分 @{P:0.50-0.62}", v:"45分", tss:25},
                 thu:{t:"FTP高峰", x:"熱身15分;主課 2x22分 @{P:0.92-0.94};息7分;緩和10分", v:"90分", tss:85},
                 sat:{t:"🔑90km關鍵+Brick", x:"全程比賽配速 @{P:0.70-0.75}上緣,務必戶外,165-180分;下車接30分113配速跑 — 最重單日", v:"3hr+30分", tss:190} } },
        { swim:{ tue:{t:"量能收斂", x:"熱身400m;主課 3x200m {EN2} 息20秒;緩和200m", v:"1200m"},
                 fri:{t:"閾值維持", x:"熱身400m;主課 3x250m {THR} 息25秒;緩和200m", v:"1350m"},
                 sun:{t:"中距收量", x:"連續1600m {EN1};緩和200m", v:"1800m"} },
          bike:{ wed:{t:"恢復迴轉", x:"40分 @{P:0.50-0.62}", v:"40分", tss:22},
                 thu:{t:"FTP維持", x:"熱身15分;主課 3x10分 @{P:0.93-0.95};息4分(短休息,練有氧天花板與乳酸排除);緩和10分", v:"65分", tss:58},
                 sat:{t:"長騎收斂", x:"@{P:0.64-0.70} 含20分比賽配速 @{P:0.78-0.83};室內105分/戶外120分", v:"2hr", tss:96} } },
      ];
      return T113[Math.min(wi-1, 2)];
    }
    const T = [
      { swim:{ tue:{t:"有氧維持", x:"熱身400m;技術6x50m;主課 6x200m {EN2} 息20秒;緩和200m", v:"2200m"},
               fri:{t:"高強度閾值", x:"熱身400m;主課 6x300m {THR} 息30秒;緩和200m", v:"2600m"},
               sun:{t:"長泳✕配速", x:"連續3200m {EN1},後1000m比賽配速;緩和200m", v:"3400m"} },
        bike:{ wed:{t:"Z2+Sweet Spot", x:"90分 @{P:0.62-0.72},中段2x12分 Sweet Spot @{P:0.88-0.93},組間休5分 @{P:0.55-0.65}", v:"90分", tss:79},
               thu:{t:"FTP高峰", x:"熱身15分;主課 3x20分 @{P:0.93-0.95};息5分(短休息,約3:1);緩和10分", v:"110分", tss:105},
               sat:{t:"前哨長騎+Brick", x:"比賽配速 @{P:0.70-0.75};戶外270分/室內230分;下車接30分226配速跑", v:"4.5hr+30分", tss:288} } },
      { key:true,
        swim:{ tue:{t:"量能維持", x:"熱身400m;技術6x50m;主課 5x200m {EN2} 息20秒;緩和200m", v:"2100m"},
               fri:{t:"高強度閾值", x:"熱身400m;主課 5x300m {THR} 息30秒;緩和200m", v:"2500m"},
               sun:{t:"🔑長泳關鍵", x:"連續3600m,全程比賽配速,完整演練補給;緩和200m", v:"3800m"} },
        bike:{ wed:{t:"恢復迴轉", x:"50分 @{P:0.50-0.62}", v:"50分", tss:28},
               thu:{t:"FTP高峰", x:"熱身15分;主課 2x28分 @{P:0.92-0.94}(長組略降);息8分(較長休息,確保每組品質);緩和10分", v:"105分", tss:99},
               sat:{t:"🔑180km關鍵+Brick", x:"全程比賽配速 @{P:0.70-0.75},務必戶外,300-330分;下車接40分226配速跑 — 最重單日", v:"5.5hr+40分", tss:335} } },
      { swim:{ tue:{t:"量能收斂", x:"熱身400m;主課 4x200m {EN2} 息20秒;緩和200m", v:"1800m"},
               fri:{t:"閾值維持", x:"熱身400m;主課 4x250m {THR} 息25秒;緩和200m", v:"1800m"},
               sun:{t:"中距收量", x:"連續2400m {EN1};緩和200m", v:"2600m"} },
        bike:{ wed:{t:"恢復迴轉", x:"45分 @{P:0.50-0.62}", v:"45分", tss:24},
               thu:{t:"FTP維持", x:"熱身15分;主課 3x12分 @{P:0.93-0.95};息4分(短休息,練有氧天花板與乳酸排除);緩和10分", v:"75分", tss:71},
               sat:{t:"長騎收斂", x:"@{P:0.64-0.70} 含30分比賽配速 @{P:0.70-0.75};室內155分/戶外180分", v:"3hr", tss:142} } },
    ];
    return T[Math.min(wi-1, 2)];
  }
  const T = [
    { swim:{ tue:{t:"減量有氧", x:"熱身300m;主課 4x100m {EN2} 息20秒;緩和200m", v:"1000m"},
             fri:{t:"減量閾值", x:"熱身300m;主課 4x100m {THR} 息25秒;緩和200m", v:"1000m"},
             sun:{t:"輕鬆游", x:"連續1500m {EN1};緩和200m", v:"1700m"} },
      bike:{ wed:{t:"完全恢復", x:"30分 @{P:0.45-0.55}", v:"30分", tss:15},
             thu:{t:"神經敏銳", x:"熱身15分;主課 3x5分 @{P:0.95-1.00};息3分;緩和10分", v:"40分", tss:40},
             sat:{t:"減量長騎", x:"@{P:0.62-0.70};室內75分/戶外90分", v:"1.5hr", tss:63} } },
    { swim:{ tue:{t:"賽前喚醒", x:"熱身300m;主課 4x50m 加速 {VO2} 息30秒;緩和200m", v:"700m"},
             fri:{t:"賽前開合", x:"熱身300m;主課 6x50m 比賽配速 息20秒;緩和200m", v:"700m"},
             sun:{t:"熟悉裝備", x:"連續1000m {EN1},比賽泳裝/防寒衣;緩和200m", v:"1200m"} },
      bike:{ wed:{t:"極輕量", x:"20分 @{P:0.45-0.55}", v:"20分", tss:10},
             thu:{t:"賽前開合", x:"20分 @{P:0.50-0.62},最後5分 @{P:0.78-0.85}", v:"20分", tss:14},
             sat:{t:"裝備確認", x:"@{P:0.62-0.70} 45分,戶外比賽車+輪組,測補給品", v:"45分", tss:32} } },
  ];
  return T[Math.min(wi-1, 1)];
}

/* V5: every displayed workout has a total duration, including warm-up,
   recoveries and cool-down. Time blocks, not distance estimates, are binding.
   IF and frequency rules are conservative coaching heuristics, not predictions. */
function raceIFFor(profile, dist) {
  const br = bikeRunModel(profile, dist);
  const experienced = ["113","226","multi"].includes(profile.triExp);
  const competitive = ["pb","ag"].includes(profile.goalType);
  let low = dist.id === "226" ? 0.65 : 0.73;
  if (experienced) low += 0.02;
  if (experienced && competitive) low += 0.01;
  if (br.bikeDur >= 0.95 && br.runDur >= 0.90 && br.hmPace && br.hmPace <= 330) low += 0.01;
  if (br.bikeDur < 0.65) low -= 0.02;
  if (br.runDur < 0.65 || !br.hmPace || br.hmPace > 360 || br.delta > 0.18) low -= 0.01;
  low = Math.round(clamp(low, dist.id === "226" ? 0.60 : 0.68, dist.id === "226" ? 0.70 : 0.80)*100)/100;
  return [low, Math.round((low+0.03)*100)/100];
}
function budgetMinutes(profile) {
  const h = Number(profile.weekHours);
  return Number.isFinite(h) && h >= 0 && profile.weekHours !== "" && profile.weekHours != null
    ? Math.floor(h*60) : 480;
}
function runPolicy(profile, dist) {
  const novice = !["113","226","multi"].includes(profile.triExp);
  const competitive = ["pb","ag"].includes(profile.goalType);
  const established = (+profile.curRunKm||0) >= (dist.id === "226" ? 35 : 25)
    && (+profile.longRunKm||0) >= (dist.id === "226" ? 18 : 12);
  const advanced = !novice && competitive && established;
  return { novice, advanced, days: advanced ? 5 : novice && dist.id === "113" ? 3 : 4,
    quality: novice || !established || profile.goalType === "finish" ? 0 : advanced ? 2 : 1 };
}
function workoutMinutes(v) {
  const m = /^(\d+(?:\.\d+)?)(hr|分)/.exec(v);
  if (!m) throw new Error(`Missing bike duration: ${v}`);
  return Math.round(+m[1]*(m[2] === "hr" ? 60 : 1));
}
function writeSession(s, minutes = s.minutes) {
  const m = Math.max(0, Math.floor(minutes));
  s.minutes = m;
  s.v = `${m}分`;
  if (!m) { s.t = "本週省略"; s.x = "時間預算不足，本週省略此課。"; s.tss = 0; return s; }
  const warm = Math.min(s.sport === "bike" ? 10 : 8, Math.floor(m/4));
  const cool = Math.min(5, Math.floor(m/5));
  const main = m-warm-cool;
  if (s.sport === "swim") {
    const technique = Math.min(10, Math.floor(main/3));
    s.x = `總計${m}分：熱身${warm}分 {EN1}；技術${technique}分（流線、划水、換氣）；主課${main-technique}分 ${s.intensity || "{EN2}"}，每50–200m短休15–20秒，休息包含在主課時間內；緩和${cool}分。時間到即結束，不追里程。`;
    s.tss = 0;
  } else if (s.sport === "strength") {
    s.x = `總計${m}分（含熱身、組間休息）：${s.strengthText}。按時間刪減輔助動作或組數，不壓縮必要休息，時間到即結束。`;
    s.tss = 0;
  } else if (s.kind === "quality" && main >= (s.sport === "bike" ? 12 : 8)) {
    const recovery = s.recovery || 3;
    const reps = Math.min(s.reps, Math.max(1, Math.floor((main+recovery)/(s.block+recovery))));
    const block = Math.min(s.block, Math.floor((main-(reps-1)*recovery)/reps));
    const easy = main-reps*block-(reps-1)*recovery;
    s.x = `總計${m}分：熱身${warm}分；${reps}×${block}分 ${s.intensity}，組間${recovery}分輕鬆（共${reps-1}次）；另${easy}分輕鬆；緩和${cool}分。品質下降就提早結束。`;
    s.tss = s.sport === "bike" ? tssCalc([[m-reps*block,0.60],[reps*block,s.ifValue]]) : 0;
  } else {
    if (s.kind === "quality") { s.kind = "easy"; s.t = "輕鬆恢復"; s.intensity = s.sport === "bike" ? "@{P:0.56-0.65}" : "對話配速"; }
    s.x = `總計${m}分：熱身${warm}分；${main}分 ${s.intensity || "對話配速"}；緩和${cool}分。${s.note || ""}`;
    s.tss = s.sport === "bike" ? tssCalc([[warm+cool,0.55],[main,s.ifValue || 0.62]]) : 0;
  }
  return s;
}
function prepareWeek(week, profile, dist, A) {
  const w = {...week, swim:{}, bike:{}, run:{}, strength:{}};
  const policy = runPolicy(profile, dist);
  const rp = runPaces(profile.hm, dist);
  const raceIF = raceIFFor(profile, dist);
  const racePower = `Race Power @{P:${raceIF[0]}-${raceIF[1]}}`;
  const isPeak = w.phase === "peak", taper = w.phase === "taper";
  const vo2 = !w.rest && !policy.novice && ((w.phase === "base" || w.phase === "build1") && w.wi === 3 || w.phase === "build2" && w.wi === 2);
  for (const day of ["tue","fri","sun"]) {
    const old = week.swim[day];
    // A generous rest/technical allowance converts old distance templates to
    // an initial time allocation. The resulting timed prescription is final.
    const pace = (parseMS(profile.tpace) || 150)+25;
    const minutes = Math.ceil(parseFloat(old.v)/100*pace/60*1.15);
    w.swim[day] = writeSession({sport:"swim", t:old.t, minutes, kind:"easy", priority:day === "sun" ? 4 : 3,
      intensity:day === "fri" && !policy.novice && !w.rest ? "{THR}" : "{EN2}"});
  }
  for (const day of ["wed","thu","sat"]) {
    let minutes = workoutMinutes(week.bike[day].v);
    let s = {sport:"bike", t:week.bike[day].t, minutes, kind:"easy", intensity:"@{P:0.60-0.70}", ifValue:0.65, priority:1};
    if (day === "thu") {
      const match = /(?:主課 )?(\d+)x(\d+)分/.exec(week.bike[day].x);
      s = {...s,kind:"quality",priority:4,reps:match ? +match[1] : 2,block:match ? +match[2] : 10,recovery:5,intensity:"@{P:0.90-0.95}",ifValue:0.925};
    }
    if (day === "wed") {
      s.t = "Z2有氧";
      if (vo2) s = {...s,t:"VO2天花板刺激",minutes:55,kind:"quality",priority:4,reps:4,block:3,recovery:3,intensity:"@{P:1.05-1.10}",ifValue:1.075};
    }
    if (day === "thu" && vo2) s = {...s,t:"VO2後Z2恢復",minutes:45,kind:"easy",priority:1,intensity:"@{P:0.56-0.65}",ifValue:0.60,note:"昨天VO2是本週單車主品質課。"};
    if (isPeak && dist.id === "226") {
      if (day === "wed") s = {...s,t:"Peak Z2收量",minutes:w.wi === 1 ? 60 : 40};
      if (day === "thu") s = {...s,t:"FTP維持",minutes:w.wi === 1 ? 60 : 50,reps:2,block:w.wi === 1 ? 15 : 10,recovery:5};
    }
    if (taper && day === "thu") s = {...s,t:"短強度維持",reps:3,block:2,recovery:3};
    if (day === "sat") {
      s = {...s,kind:"long",priority:6,t:w.key ? "🔑關鍵長騎" : "長騎耐力",intensity:isPeak || w.phase === "build2" ? racePower : "@{P:0.62-0.70}",ifValue:isPeak || w.phase === "build2" ? (raceIF[0]+raceIF[1])/2 : 0.66,
        note:"戶外優先；演練空力姿勢與已耐受的補給，監控後半功率及心率；依時間完成，不強制騎滿比賽里程。"};
      if (isPeak && dist.id === "226") s.minutes = [270,330,150][Math.min(w.wi-1,2)];
      // Conservative duration ceiling using recent longest ride as a proxy;
      // absent durability data cannot unlock a full key ride.
      const knownLong = (+profile.longBikeKm||0)/25*60;
      s.minutes = Math.min(s.minutes, Math.max(90, Math.round(knownLong*(1+Math.min(w.n,16)*0.04))));
    }
    w.bike[day] = writeSession(s);
  }
  const brick = !w.rest && (w.phase === "build2" && w.wi >= 2 || isPeak && w.wi <= 2);
  const runDays = policy.days === 3 ? ["wed",brick ? "sat" : "fri","sun"] : policy.days === 4 ? ["wed","fri","sat","sun"] : ["wed","thu","fri","sat","sun"];
  const qualityDays = w.rest || vo2 || w.key || policy.novice || taper ? [] : policy.quality === 2 && !isPeak ? ["wed","fri"] : policy.quality ? ["wed"] : [];
  for (const day of runDays) {
    let minutes = taper ? (w.wi >= 2 ? 20 : 30) : Math.max(20,round5(35*A.volumeFactor*A.br.runFactor));
    let s = {sport:"run",kind:"easy",t:"輕鬆跑",minutes,intensity:"對話配速（可跑走）",priority:1};
    if (qualityDays.includes(day)) s = {...s,t:"閾值維持",kind:"quality",minutes:45,reps:3,block:5,recovery:2,intensity:rp ? `@${paceStr(rp.thr)}/km，依體感下修` : "穩定節奏，保留餘裕",priority:day === "fri" ? 2 : 4};
    if (day === "sun") {
      const current = (+profile.longRunKm||0)*(rp ? rp.easy[1]/60 : 7);
      const maxLong = dist.id === "226" ? 150 : 105;
      minutes = Math.min(maxLong,Math.max(40,Math.round(current*(1+Math.min(w.n,16)*0.025))));
      if (w.rest || w.key) minutes = Math.round(minutes*0.65);
      if (taper) minutes = Math.min(minutes,w.wi >= 2 ? 40 : 60);
      if (isPeak && w.wi >= 3) minutes = Math.round(minutes*0.75);
      s = {...s,t:"輕鬆長跑",kind:"long",minutes,priority:5,note:"以輕鬆強度完成，跑走皆可；不加末段閾值。"};
    }
    if (day === "sat" && brick) s = {...s,t:"下車Brick",minutes:policy.novice ? 15 : w.key ? 30 : 20,priority:3,note:"長騎後接跑，取代當天其他跑課；疲勞高則取消。"};
    w.run[day] = writeSession(s);
  }
  w.strength.tue = writeSession({sport:"strength",kind:"easy",t:strengthFor(w.phase,profile.strengthExp||"none").t,
    strengthText:strengthFor(w.phase,profile.strengthExp||"none").x, minutes:taper ? 10 : isPeak ? 20 : 35,priority:3});
  const all = [...Object.values(w.swim),...Object.values(w.bike),...Object.values(w.run),...Object.values(w.strength)];
  const requested = all.reduce((a,s)=>a+s.minutes,0);
  const cap = budgetMinutes(profile);
  let excess = Math.max(0,requested-cap);
  const changes = [];
  // Remove recovery volume, then the second quality workout, then ancillary
  // volume. Main quality and long sessions are protected until necessary.
  const order = [...all].sort((a,b)=>a.priority-b.priority);
  for (const s of order) {
    if (!excess) break;
    const floor = s.kind === "long" ? 30 : s.kind === "quality" ? 25 : s.sport === "strength" ? 10 : 20;
    let reduction = Math.min(excess,Math.max(0,s.minutes-floor));
    if (s.minutes-reduction > 0 && s.minutes-reduction < 15 && s.sport !== "strength") reduction = s.minutes;
    if (reduction) { const before=s.minutes,title=s.t; writeSession(s,before-reduction); excess=Math.max(0,excess-reduction); changes.push(`${title} ${before}→${s.minutes}分`); }
  }
  for (const s of order) {
    if (!excess) break;
    if (s.minutes) { const before=s.minutes,title=s.t; writeSession(s,0); excess=Math.max(0,excess-before); changes.push(`省略${title} ${before}分`); }
  }
  const total = all.reduce((a,s)=>a+s.minutes,0);
  w.budget = {cap,total,requested,changes,limited:total < requested,
    runDays:Object.values(w.run).filter(s=>s.minutes>0).length,
    qualityRuns:Object.values(w.run).filter(s=>s.minutes>0 && s.kind === "quality").length};
  return w;
}
/* ---------------- plan builder ---------------- */
function buildPlan(raceDateStr, dist, startStr, A) {
  const race = new Date(raceDateStr + "T00:00:00");
  if (isNaN(race)) return null;
  let start;
  if (startStr) { const d = new Date(startStr + "T00:00:00"); d.setDate(d.getDate() - ((d.getDay()+6)%7)); start = isNaN(d) ? mondayOfThisWeek() : d; }
  else start = mondayOfThisWeek();
  const days = Math.round((race - start) / 864e5);
  if (days < 21) return { error: "距比賽不足3週,建議直接進入減量與恢復。" };
  if (days >= 280) return {error:"計畫最多40週，請將起始日移近比賽日期。"};
  const n = Math.floor(days / 7) + 1;
  const taper = n >= 12 ? 2 : 1;
  const peak = n >= 16 ? 3 : n >= 12 ? 2 : 1;
  const trainWeeks = n - 1 - taper - peak;
  const base = Math.max(1, Math.round(trainWeeks * 0.4));
  const build1 = Math.min(trainWeeks-base, Math.max(1, Math.round(trainWeeks * 0.3)));
  const build2 = Math.max(0, trainWeeks - base - build1);

  const weeks = [];
  let idx = 1;
  const push = (phase, count) => {
    for (let wi = 1; wi <= count; wi++) {
      const isTrainPhase = ["base","build1","build2"].includes(phase);
      const rec = isTrainPhase && count >= 3 && (wi === count || (wi % 4 === 0 && wi !== count));
      const sb = genSwimBike(phase, wi, rec, dist, A);
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
  const [profile, setProfile] = useState({ height: 175, weight: 68, ftp: 250, tpace: "1:35", hm: "1:32", dist: "226", raceDate: "2026-11-08", startDate: "", lastSwim: "", lastBike: "", lastRun: "", goal: "", adjS: 0, adjB: 0, adjR: 0, weekHours:8, curSwimKm:4, curBikeHours:4, curRunKm:30, longSwimM:2000, longBikeKm:80, longRunKm:18, triExp:"first", goalType:"finish", strengthExp:"none" });
  const [editing, setEditing] = useState(true);
  const [selected, setSelected] = useState(1);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const saved = await loadSavedProfile();
        if (saved && saved.value) {
          const loaded = { ...saved.value };
          if (!loaded.startDate) loaded.startDate = isoOfMonday(mondayOfThisWeek());
          setProfile((d) => ({ ...d, ...loaded }));
          setEditing(false);

          // Migrate/refresh all persistence layers after loading an old or URL profile.
          await persistProfile({ ...profile, ...loaded });
        } else {
          const initial = { ...profile, startDate: isoOfMonday(mondayOfThisWeek()) };
          setProfile(initial);
          await persistProfile(initial);
        }
      } catch (e) {
        const initial = { ...profile, startDate: isoOfMonday(mondayOfThisWeek()) };
        setProfile(initial);
      }
    })();
    // Initial load only; profile defaults are intentionally captured once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { setExpanded(null); }, [selected]);
  const [autoJumped, setAutoJumped] = useState(false);
  const distForJump = { id: profile.dist || "226", ...DISTS[profile.dist || "226"] };
  const athleteForJump = athleteModel(profile, distForJump);
  const planForJump = useMemo(() => buildPlan(profile.raceDate, distForJump, profile.startDate, athleteForJump), [profile]);
  useEffect(() => {
    if (autoJumped || !planForJump || planForJump.error) return;
    const cur = Math.floor((mondayOfThisWeek() - planForJump.start) / (7 * 864e5)) + 1;
    if (cur >= 1 && cur <= planForJump.n) setSelected(cur);
    setAutoJumped(true);
  }, [planForJump, autoJumped]);

  async function saveProfile(next) {
    setProfile(next);
    await persistProfile(next);
  }

  const dist = { id: profile.dist || "226", ...DISTS[profile.dist || "226"] };
  const athlete = athleteModel(profile, dist);
  const plan = useMemo(() => buildPlan(profile.raceDate, dist, profile.startDate, athlete), [profile]);
  const rp = runPaces(profile.hm, dist);
  const tpaceSec = parseMS(profile.tpace);
  const now = new Date();

  if (!plan || plan.error) {
    return (
      <Shell profile={profile} editing={true} setEditing={setEditing} saveProfile={saveProfile} rp={rp}>
        <div style={{ padding: 20, color: C.red, fontSize: 14 }}>{plan?.error || "請輸入有效的比賽日期"}</div>
      </Shell>
    );
  }

  const { weeks: rawWeeks, n: N, start } = plan;
  const weeks = rawWeeks.map(w => w.race ? w : prepareWeek(w, profile, dist, athlete));
  const sel = Math.min(selected, N);
  const week = weeks.find((w) => w.n === sel);
  const phase = PHASES[week.phase];
  const dateFor = (weekN, dayKey) => { const d = new Date(start); d.setDate(d.getDate() + (weekN-1)*7 + DAY_OFFSET[dayKey]); return d; };
  const bikeTss = week.race ? 0 : (week.bike.wed.tss||0)+(week.bike.thu.tss||0)+(week.bike.sat.tss||0);
  const run = week.race ? null : week.run;
  const monMonth = dateFor(week.n, "mon").getMonth() + 1;
  const RUNCOLOR = { wed:C.red, thu:C.green, fri:C.red, sat:C.green, sun:C.gold };

  const mkRun = (day) => !run[day]?.minutes ? null : ({ id:`${day}-run`, color: RUNCOLOR[day], icon:<Footprints size={13}/>, title:`跑·${run[day].t}`, vol:run[day].v, detail:run[day].x });
  const mkBike = (day) => !week.bike[day]?.minutes ? null : ({ id:`${day}-bike`, color:C.power, icon:<BikeIcon size={13}/>, title:week.bike[day].t, vol:`${week.bike[day].v}·TSS${week.bike[day].tss}`, detail:renderBike(week.bike[day].x, profile.ftp) });
  const mkSwim = (day) => !week.swim[day]?.minutes ? null : ({ id:`${day}-swim`, color:C.water, icon:<Waves size={13}/>, title:week.swim[day].t, vol:week.swim[day].v, detail:renderSwim(week.swim[day].x, tpaceSec) });

  const rows = week.race ? [] : [
    { day:"mon", items:[{ rest:true }] },
    { day:"tue", items:[week.strength.tue.minutes ? { id:"tue-str", color:C.iron, icon:<Dumbbell size={13}/>, title:week.strength.tue.t, vol:week.strength.tue.v, detail:week.strength.tue.x } : null, mkSwim("tue")] },
    { day:"wed", items:[mkRun("wed"), mkBike("wed")] },
    { day:"thu", items:[mkRun("thu"), mkBike("thu")] },
    { day:"fri", items:[mkRun("fri"), mkSwim("fri")] },
    { day:"sat", items:[mkBike("sat"), mkRun("sat")] },
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

      {!week.race && <div style={{fontSize:12,lineHeight:1.7,marginBottom:12,padding:10,background:C.surface,borderRadius:10}}>
        <b>每週時間預算：{week.budget.total} / {week.budget.cap} 分</b> · 跑步{week.budget.runDays}次，其中品質{week.budget.qualityRuns}次
        <div>含游泳、單車、跑步（含Brick）、重訓及課內熱身／休息／緩和；不含交通、更衣與正式比賽。所有課程以總分鐘為上限。</div>
        {week.budget.limited && <div style={{color:C.power}}>原配置{week.budget.requested}分，已依優先級縮課：{week.budget.changes.join("；")}。此預算無法容納完整專項訓練，請依實際耐受度調整備賽目標。</div>}
      </div>}
      {week.race ? (
        <RaceWeekView profile={profile} rp={rp} dist={dist} dateFor={dateFor} weekN={week.n} raceDate={new Date(profile.raceDate+"T00:00:00")} />
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
                  {(row.items.filter(Boolean).length ? row.items.filter(Boolean) : [{rest:true}]).map((it, ii) => {
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
  const [copied, setCopied] = useState(false);
  return (
    <div style={{ minHeight: "100vh", background: C.ink, color: C.text, fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500;600&display=swap');
        .osw { font-family:'Oswald',sans-serif; } .mono { font-family:'Roboto Mono',monospace; }
        input,select { background:#fff; border:1px solid ${C.line}; color:${C.text}; border-radius:8px; padding:8px 10px; font-family:'Roboto Mono',monospace; font-size:14px; width:100%; }
        button:focus-visible, input:focus-visible, select:focus-visible { outline:2px solid ${C.water}; outline-offset:2px; }
        .strip::-webkit-scrollbar{ height:4px; } .strip::-webkit-scrollbar-thumb{ background:${C.line}; border-radius:4px; }
        .rowbtn { transition: background .12s ease; } .rowbtn:hover { background:${C.surface2}; }
      `}</style>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 50px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h1 className="osw" style={{ fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: 0.5 }}>Ironman 個人化訓練面板 V5</h1>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{raceInfo || "輸入數據,自動生成整期課表"}</div>
          </div>
          <button onClick={() => setEditing((v) => !v)} style={{ background: C.surface, border:`1px solid ${C.line}`, borderRadius:10, padding:"7px 10px", color:C.text, display:"flex", gap:5, alignItems:"center", cursor:"pointer", fontSize:12, flexShrink:0 }}>
            <Settings2 size={14} /> 我的數據
          </button>
        </div>

        {editing && (
          <div style={{ background: C.surface, border:`1px solid ${C.line}`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ fontSize:10.5, color:C.water, fontWeight:700, marginBottom:6, letterSpacing:0.5 }}>① 訓練強度數據（課表配速/瓦數的來源,必填）</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="賽事距離">
                <div style={{ display:"flex", gap:6 }}>
                  {["226","113"].map(d => (
                    <button key={d} onClick={() => saveProfile({ ...profile, dist:d })}
                      style={{ flex:1, padding:"8px 0", borderRadius:8, cursor:"pointer", fontFamily:"'Roboto Mono',monospace", fontSize:14, fontWeight:600,
                        background: (profile.dist||"226")===d ? C.water : "#fff",
                        color: (profile.dist||"226")===d ? "#fff" : C.text,
                        border:`1px solid ${(profile.dist||"226")===d ? C.water : C.line}` }}>{d}</button>
                  ))}
                </div>
              </Field>
              <Field label="比賽日期"><input type="date" value={profile.raceDate} onChange={(e) => saveProfile({ ...profile, raceDate:e.target.value })} /></Field>
              <Field label="計畫起始日（換裝置請填同一天）"><input type="date" value={profile.startDate || ""} onChange={(e) => saveProfile({ ...profile, startDate:e.target.value })} /></Field>
              <Field label="半馬PB h:mm"><input type="text" placeholder="1:32" value={profile.hm} onChange={(e) => saveProfile({ ...profile, hm:e.target.value })} /></Field>
              <Field label="FTP (W)"><input type="number" value={profile.ftp} onChange={(e) => saveProfile({ ...profile, ftp:+e.target.value })} /></Field>
              <Field label="游泳T-pace mm:ss"><input type="text" placeholder="1:35" value={profile.tpace} onChange={(e) => saveProfile({ ...profile, tpace:e.target.value })} /></Field>
              <Field label="體重 kg"><input type="number" value={profile.weight} onChange={(e) => saveProfile({ ...profile, weight:+e.target.value })} /></Field>
              <Field label="身高 cm"><input type="number" value={profile.height} onChange={(e) => saveProfile({ ...profile, height:+e.target.value })} /></Field>
              </div>
              <div style={{ fontSize:10.5, color:C.power, fontWeight:700, margin:"14px 0 6px", letterSpacing:0.5 }}>② 訓練耐受度（總週量）＋騎跑數據個人化</div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
                <Field label="每週訓練時間上限 小時（含重訓／Brick）"><input type="number" min="0" step="0.5" value={profile.weekHours ?? ""} onChange={(e)=>saveProfile({...profile,weekHours:+e.target.value})}/></Field>
                <Field label="目前每週游泳 km（只校正總量，不做強弱排名）"><input type="number" min="0" step="0.5" value={profile.curSwimKm||""} onChange={(e)=>saveProfile({...profile,curSwimKm:+e.target.value})}/></Field>
                <Field label="目前每週單車 小時"><input type="number" min="0" step="0.5" value={profile.curBikeHours||""} onChange={(e)=>saveProfile({...profile,curBikeHours:+e.target.value})}/></Field>
                <Field label="目前每週跑步 km"><input type="number" min="0" step="1" value={profile.curRunKm||""} onChange={(e)=>saveProfile({...profile,curRunKm:+e.target.value})}/></Field>
                <Field label="最長連續游泳 m（耐力安全檢查）"><input type="number" min="0" step="100" value={profile.longSwimM||""} onChange={(e)=>saveProfile({...profile,longSwimM:+e.target.value})}/></Field>
                <Field label="最長單車 km"><input type="number" min="0" step="5" value={profile.longBikeKm||""} onChange={(e)=>saveProfile({...profile,longBikeKm:+e.target.value})}/></Field>
                <Field label="最長跑步 km"><input type="number" min="0" step="1" value={profile.longRunKm||""} onChange={(e)=>saveProfile({...profile,longRunKm:+e.target.value})}/></Field>
                <Field label="三項經驗"><select value={profile.triExp||"first"} onChange={(e)=>saveProfile({...profile,triExp:e.target.value})}><option value="first">第一次參賽</option><option value="sprint">短距離/標鐵經驗</option><option value="113">完成過113</option><option value="226">完成過226</option><option value="multi">多次長距離</option></select></Field>
                <Field label="訓練目標"><select value={profile.goalType||"finish"} onChange={(e)=>saveProfile({...profile,goalType:e.target.value})}><option value="finish">安全完賽</option><option value="pb">突破PB</option><option value="ag">競爭Age Group</option><option value="custom">自訂目標</option></select></Field>
                <Field label="重訓經驗"><select value={profile.strengthExp||"none"} onChange={(e)=>saveProfile({...profile,strengthExp:e.target.value})}><option value="none">無經驗</option><option value="lt1">未滿1年</option><option value="1to3">1-3年</option><option value="3plus">3年以上</option></select></Field>
              </div>
            <div style={{ marginTop:12, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <button onClick={() => {
                const url = `${window.location.origin}${window.location.pathname}?d=${encodeProfile(profile)}${window.location.hash}`;
                navigator.clipboard?.writeText(url).then(()=>setCopied(true)).catch(()=>{});
                setTimeout(()=>setCopied(false), 2500);
              }} style={{ background:C.water, border:"none", borderRadius:8, padding:"8px 14px", color:"#fff", fontSize:12.5, fontWeight:600, cursor:"pointer", display:"flex", gap:6, alignItems:"center" }}>
                <Link2 size={14}/> 備份／複製我的專屬連結
              </button>
              {copied && <span style={{ fontSize:11.5, color:C.green }}>✓ 已複製；同一裝置會自動儲存，換裝置可用此連結完整還原</span>}
            </div>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:5, lineHeight:1.5 }}>
              資料會自動同時儲存在目前環境與瀏覽器本機；網址中的專屬資料則作為跨裝置／瀏覽器備份。一般情況下重新開啟不需要重填。
            </div>
            <div style={{ fontSize:10.5, color:C.muted, marginTop:4, lineHeight:1.5 }}>
              手機瀏覽器可能會自動清除網站資料,建議複製連結後加入書籤或主畫面,換手機/換瀏覽器也能直接開啟同一份課表。
            </div>
            <div style={{ fontSize:10.5, color:C.gold, fontWeight:700, margin:"12px 0 6px", letterSpacing:0.5 }}>③ 拆分基準（僅影響目標拆分卡:有比賽成績優先採用,三項須齊全;未填則自動用①的PB預測）</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="上次比賽 游 h:mm"><input type="text" placeholder="1:25" value={profile.lastSwim} onChange={(e) => saveProfile({ ...profile, lastSwim:e.target.value })} /></Field>
              <Field label="上次比賽 騎 h:mm"><input type="text" placeholder="5:55" value={profile.lastBike} onChange={(e) => saveProfile({ ...profile, lastBike:e.target.value })} /></Field>
              <Field label="上次比賽 跑 h:mm"><input type="text" placeholder="3:50" value={profile.lastRun} onChange={(e) => saveProfile({ ...profile, lastRun:e.target.value })} /></Field>
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
        <AthleteSummary profile={profile} />
        <GoalAnalysis profile={profile} saveProfile={saveProfile} />
        {children}
      </div>
    </div>
  );
}

function AthleteSummary({ profile }) {
  const dist = { id: profile.dist || "226", ...DISTS[profile.dist || "226"] };
  const A = athleteModel(profile, dist);
  const lvl = A.volumeFactor < 0.72 ? "保守起步" : A.volumeFactor < 0.92 ? "標準進階" : "高耐受進階";
  return (
    <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:12, padding:"9px 11px", marginBottom:10, fontSize:11.5, lineHeight:1.55 }}>
      <div style={{ display:"flex", gap:8, flexWrap:"wrap", alignItems:"center" }}>
        <b style={{ color:C.power }}>Athlete Profile · V5</b>
        <span className="mono">{lvl} · Volume ×{A.volumeFactor.toFixed(2)} · Quality ×{A.qualityFactor.toFixed(2)}</span>
        <span style={{ color:C.muted }}>每週上限 {budgetMinutes(profile)/60}hr · 目標 {({finish:"完賽",pb:"PB",ag:"Age Group",custom:"自訂"}[A.goal]||A.goal)}</span>
      </div>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginTop:5 }}>
        <span style={{ border:`1px solid ${C.water}`, borderRadius:6, padding:"2px 6px", color:C.water }}>游泳：技術導向 · T-pace只定強度</span>
        <span style={{ border:`1px solid ${C.power}`, borderRadius:6, padding:"2px 6px", color:C.power }}>單車：{A.br.label} · {A.br.wkg.toFixed(2)} W/kg · 量×{A.br.bikeFactor.toFixed(2)}</span>
        <span style={{ border:`1px solid ${C.red}`, borderRadius:6, padding:"2px 6px", color:C.red }}>跑步：HM {A.br.hmPace?paceStr(A.br.hmPace):"未填"}/km · 量×{A.br.runFactor.toFixed(2)}</span>
      </div>
      <div>Race IF：{raceIFFor(profile,dist).map(v=>Math.round(v*100)).join("–")}% FTP · 跑步基準{runPolicy(profile,dist).days}次／週，實際依預算及階段縮減；首次／完賽導向以輕鬆跑為主。</div>
      {A.readiness.length > 0 && <div style={{ color:C.red, marginTop:4 }}>⚠ {A.readiness.join("；")}</div>}
      <div style={{ color:C.muted, marginTop:4 }}>游泳不以T-pace做強弱排名；單車用FTP/Wkg＋單車耐久資料、跑步用半馬PB＋跑量/長跑資料做相對強弱判斷。Race IF為保守規則估算，依經驗、目標、跑力及耐久資料調整；需以長騎實測驗證，不能當作完賽保證。</div>
    </div>
  );
}

/* ---------------- goal analysis + 強項微調 ---------------- */
function GoalAnalysis({ profile, saveProfile }) {
  const dist = { id: profile.dist || "226", ...DISTS[profile.dist || "226"] };
  const g = parseHMM(profile.goal);
  if (!g) return null;
  let sS=parseHMM(profile.lastSwim), sB=parseHMM(profile.lastBike), sR=parseHMM(profile.lastRun);
  let predicted = false;
  const filled = [sS,sB,sR].filter(Boolean).length;
  const partial = filled > 0 && filled < 3;
  if (filled < 3) {
    const pd = predictSplits(profile, dist);
    if (!pd) return null;
    sS = pd.s; sB = pd.b; sR = pd.r; predicted = true;
  }
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
    [`游 ${dist.sw}k`, sS, tgt.s, `${paceStr(tgt.s/(dist.sw*10))}/100m`, "adjS"],
    [`騎 ${dist.bk}k`, sB, tgt.b, `${(dist.bk/(tgt.b/3600)).toFixed(1)}km/h`, "adjB"],
    [`跑 ${dist.rn}k`, sR, tgt.r, `${paceStr(tgt.r/dist.rn)}/km`, "adjR"],
  ];
  return (
    <div style={{ background:C.surface, border:`1px solid ${aggressive?C.red:C.line}`, borderRadius:12, padding:"10px 12px", marginBottom:12 }}>
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6, flexWrap:"wrap" }}>
        <span className="osw" style={{ fontSize:12, color:C.gold, fontWeight:700, letterSpacing:0.5 }}>目標拆分·{dist.id}</span>
        <span style={{ fontSize:10, color: predicted?C.power:C.green, border:`1px solid ${predicted?C.power:C.green}`, borderRadius:4, padding:"1px 5px" }}>{predicted ? "PB預測±10-15%" : "實測"}</span>
        {partial && <span style={{ fontSize:10, color:C.red }}>⚠ 比賽成績只填{filled}/3項,未達採用門檻,目前用PB預測 — 補齊三項即切換為實測</span>}
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
        <span/><span style={{ color:C.muted, fontSize:10.5 }}>{predicted ? "預測" : "上次"}</span><span style={{ color:C.muted, fontSize:10.5 }}>目標</span><span style={{ color:C.muted, fontSize:10.5 }}>配速</span><span style={{ color:C.muted, fontSize:10.5, fontFamily:"'Inter',sans-serif" }}>微調</span>
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
function RaceWeekView({ profile, rp, dist, dateFor, weekN, raceDate }) {
  dist = {...dist, bikeIF:raceIFFor(profile,dist)};
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
  let remaining = budgetMinutes(profile);
  const durations = [0,25,30,25,0,15];
  const offset = Math.max(0,tasks.length-preDays.length);
  const chosen = tasks.slice(offset).map((task,i)=>{
    const requested=durations[offset+i];
    if (!requested) return task;
    if (remaining < requested) return "休息／裝備確認（本週時間預算已保留給其他喚醒課）";
    remaining -= requested;
    return `${task}；總計${requested}分，含熱身與緩和，時間到即結束`;
  });
  return (
    <div>
      <div style={{fontSize:12,marginBottom:10}}>賽前訓練 {budgetMinutes(profile)-remaining} / {budgetMinutes(profile)} 分；正式比賽不計入訓練預算。</div>
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
        <div style={{ fontWeight:700, fontSize:14, marginBottom:6, display:"flex", gap:6, alignItems:"center" }}><Flag size={15} color={C.gold}/>{DAY_LABEL[keys[raceDayIdx]]} {fmtDate(raceDate)} — {dist.id} 比賽日</div>
        <div style={{ fontSize:12.5, lineHeight:1.7 }}>
          <div><b style={{ color:C.water }}>游 {dist.sw}k</b>：輕鬆-中等,起跳勿快,善用跟游</div>
          <div><b style={{ color:C.power }}>騎 {dist.bk}k</b>：{Math.round(dist.bikeIF[0]*100)}-{Math.round(dist.bikeIF[1]*100)}%FTP（{Math.round(profile.ftp*dist.bikeIF[0])}-{Math.round(profile.ftp*dist.bikeIF[1])}W）,15-20分補給一次</div>
          <div><b style={{ color:C.red }}>跑 {dist.rn}k</b>：{rp ? `${paceStr(rp.im[0])}-${paceStr(rp.im[1])}/km` : "輕鬆-中等"},前段壓慢</div>
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
