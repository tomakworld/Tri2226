import { useState, useEffect, useRef } from "react";
import { storage } from "./storage.js";
import { Waves, Bike as BikeIcon, Footprints, Dumbbell, Moon, Settings2, ChevronLeft, ChevronRight, Check, Info, Flag, Sun, ChevronDown, MonitorPlay } from "lucide-react";

/* ---------------- design tokens ---------------- */
const C = {
  ink: "#0E1B24", surface: "#152530", surface2: "#1C323D", line: "#294550",
  water: "#35B4C4", power: "#F2A340", red: "#E4553F", green: "#7BC9A0",
  gold: "#FFD166", iron: "#8C7BC4", text: "#EAF3F5", muted: "#8CA3AC",
};

const PHASES = {
  base: { label: "基礎期 · 熱適應", color: C.water },
  build1: { label: "強化期一", color: C.power },
  build2: { label: "強化期二", color: C.power },
  peak: { label: "巔峰期", color: C.red },
  taper: { label: "減量期", color: C.green },
  race: { label: "比賽週", color: C.gold },
};
const PHASE_NOTE = {
  base: "已有訓練基礎，直接以中高量起步，在盛夏高溫下鞏固有氧引擎與熱適應。",
  build1: "提升FTP與游泳閾值，長騎長泳持續加量；關鍵課表安排在清晨或室內執行。",
  build2: "向226比賽時長靠近：長騎推進至4小時以上、長泳3km以上，配速逐漸貼近目標值。",
  peak: "最吃重的區塊：關鍵長騎模擬完整180km，秋季涼爽氣候有利執行高品質課表。",
  taper: "大幅降低訓練量、保留強度，讓身體在比賽前完成超補償。",
  race: "比賽週 — 賽前最終確認，祝你 226 完賽旅途順利！",
};
const PHASE_ENV = {
  base: "🌡️ 盛夏(7-8月)：體感常35°C+。戶外課移清晨或日落後；訓練台間歇課品質不受天氣影響,是此階段優勢。",
  build1: "🌡️ 8-9月仍濕熱且為颱風季：訓練台可完全排除颱風干擾;長騎若在室內請備足風扇與水。",
  build2: "🍂 9-10月轉涼：戶外配速可貼近目標值;建議部分長騎移到戶外練實路操控與補給。",
  peak: "🍂 10月中下旬涼爽穩定：180km關鍵長騎強烈建議戶外執行,模擬實際路感、風阻與補給;開始關注比賽地氣象。",
  taper: "❄️ 11月將至(20-26°C)：氣候溫和,專心恢復;留意比賽日若偏熱需微調補水。",
  race: "🏁 11月上旬偶有秋老虎：賽前一晚確認當地氣象、氣溫與風向,微調配速與補給。",
};

const RUN_TYPE = { wed: "interval", thu: "easy", fri: "interval", sat: "easy", sun: "long" };
const RUN_META = {
  interval: { label: "間歇", color: C.red },
  easy: { label: "輕鬆", color: C.green },
  long: { label: "長跑", color: C.gold },
};
const DAY_OFFSET = { mon: 0, tue: 1, wed: 2, thu: 3, fri: 4, sat: 5, sun: 6 };

/* ---------------- date engine ---------------- */
const PROGRAM_START = new Date(2026, 6, 6);   // 2026-07-06 Mon
const RACE_DATE = new Date(2026, 10, 8);       // 2026-11-08 Sun
const N_WEEKS = 18;
function dateFor(weekN, dayKey) {
  const d = new Date(PROGRAM_START);
  d.setDate(d.getDate() + (weekN - 1) * 7 + DAY_OFFSET[dayKey]);
  return d;
}
function fmtDate(d) { return `${d.getMonth() + 1}/${d.getDate()}`; }

/* ---------------- zone math ---------------- */
const BIKE_ZONES = { Z1:[0,0.55], Z2:[0.56,0.75], Z3:[0.76,0.90], Z4:[0.91,1.05], Z5:[1.06,1.20], Z6:[1.21,1.50], Z7:[1.51,2.0] };
function bikeZoneText(ftp, key) {
  const [lo, hi] = BIKE_ZONES[key];
  const a = Math.round(ftp * lo), b = Math.round(ftp * hi);
  if (key === "Z7") return `${key} ${a}W+`;
  if (key === "Z2") return `${key} ${a}-${b}W`;          // Z2 維持純瓦數
  const pl = Math.round(lo * 100), ph = Math.round(hi * 100);
  return `${key}(${pl}-${ph}%FTP) ${a}-${b}W`;           // 其餘附 FTP% 範圍
}
function renderBike(text, ftp) {
  return text
    .replace(/Sweet Spot\(88-93%FTP\)/g, `Sweet Spot(88-93%FTP, ${Math.round(ftp*0.88)}-${Math.round(ftp*0.93)}W)`)
    .replace(/\{(Z[1-7])\}/g, (_, k) => bikeZoneText(ftp, k));
}
const SWIM_OFFSET = { EN1: 25, EN2: 12, THR: 0, VO2: -6 };
const SWIM_FALLBACK = { EN1: "輕鬆有氧", EN2: "中等有氧", THR: "門檻配速", VO2: "最大攝氧" };
function formatPace(sec) { const s=Math.max(sec,20); const m=Math.floor(s/60), r=Math.round(s%60); return `${m}:${String(r).padStart(2,"0")}/100m`; }
function renderSwim(text, tpaceSec) {
  return text.replace(/\{(EN1|EN2|THR|VO2)\}/g, (_, k) => tpaceSec ? `(${k} ${formatPace(tpaceSec + SWIM_OFFSET[k])})` : `(${SWIM_FALLBACK[k]})`);
}
function parseHMM(str){ const m=/^(\d+):(\d{1,2})$/.exec((str||"").trim()); return m ? (+m[1])*3600+(+m[2])*60 : null; }
function paceStr(sec){ const m=Math.floor(sec/60), r=Math.round(sec%60); return `${m}:${String(r).padStart(2,"0")}`; }
function runPaces(marathonStr){
  const t = parseHMM(marathonStr); if(!t) return null;
  const mp = t/42.195;
  return {
    easy:[mp*1.15, mp*1.28], long:[mp*1.08, mp*1.18], mp,
    thr: mp*0.955, itv:[mp*0.88, mp*0.93], im:[mp+55, mp+75],
  };
}
function round5(v){ return Math.round(v/5)*5; }
function round50(v){ return Math.round(v/50)*50; }
/* TSS 估算:每段 = 分鐘 x IF^2,總和 /60 x100。IF 依區間中值假設:
   Z1≈0.50-0.55 Z2≈0.65 Z3≈0.83 SweetSpot≈0.90 Z4下緣≈0.92 組間≈0.50 */
function tssCalc(segs){ return Math.round(segs.reduce((a,[m,i]) => a + m*i*i, 0) / 60 * 100); }

/* ---------------- strength ---------------- */
const STRENGTH = {
  base:  {t:"肌力基礎鞏固", x:"直接以3-4組x8-10下工作組進行深蹲/硬舉/臥推/划船;加入單邊動作(保加利亞蹲、單腳硬舉)與抗旋轉核心;每週漸進負荷3-5%。"},
  build1:{t:"最大肌力期", x:"深蹲/硬舉/臥推進入4-6RM低反覆高負荷,3-4組,組間休息2-3分鐘;核心維持抗旋轉,上肢推拉平衡保護游泳肩部。"},
  build2:{t:"最大肌力峰值 ✕ 爆發力啟蒙", x:"維持4-6RM並加入單邊最大肌力;後半段加入登箱跳2-3組x5下,為轉換爆發力做準備。"},
  peak:  {t:"爆發力轉換期", x:"登階跳、藥球拋擲、彈震式動作,3組x5-6下,總量降低,重質不重量,避免疲勞影響長騎/長跑品質。"},
  taper: {t:"神經活化週", x:"極輕負荷、高速度動作,2組x5下,僅作神經肌肉喚醒;第2週建議僅做動態伸展或跳過。"},
  race:  {t:"賽前活化(選擇性)", x:"僅做動態熱身與彈力帶啟動(10分鐘內),或直接跳過,把精力留給比賽。"},
};

/* ---------------- generators（單車以訓練台為主,間歇取FTP的95-97%起） ----------------
   訓練台調整原則:
   - 間歇/閾值課:室內散熱差、無慣性,同瓦數體感較戶外高,目標功率以區間「下緣~中段」執行即可,不必打到上緣
   - 恢復課:直接照Z1瓦數,訓練台反而更容易控制
   - 長騎:室內版時間打85折(無紅燈滑行、持續踩踏,訓練刺激等效),另附戶外原時長 */
function trainerLong(mins){ return `室內訓練台 ${round5(mins*0.85)}分鐘（戶外則騎 ${mins}分鐘）`; }

function genBase(w, rec) {
  const f = rec ? 0.72 : 1;
  const r1 = Math.max(6, Math.round((8+(w-1))*f));
  const r2 = Math.max(6, Math.round((10+(w-1)*2)*f));
  const d3 = Math.max(1400, round50((2000+(w-1)*250)*f));
  const bw = Math.max(55, round5((75+(w-1)*5)*f));
  const bte = Math.max(8, Math.round((12+(w-1)*2)*f)), btr=4;
  const bs = Math.max(120, round5((170+(w-1)*25)*f));
  return {
    swim:{
      tue:{t:"技術✕有氧量能", x:`熱身400m;技術分解8x50m;主課 ${r1}x150m {EN2} 息15秒;緩和200m`, v:`約${800+r1*150+200}m`},
      fri:{t:"閾值間歇", x:`熱身400m;主課 ${r2}x100m {THR} 息15秒;緩和200m`, v:`約${400+r2*100+200}m`},
      sun:{t:"有氧耐力(熱適應)", x:`連續游 ${d3}m {EN1},以自覺強度控制,避開正午;緩和200m`, v:`約${d3+200}m`},
    },
    bike:{
      wed:{t:"Z2耐力+Tempo收尾(訓練台)", x:`${bw}分鐘 {Z2} 穩定踩踏,最後10分鐘拉至 {Z3};當天有跑步間歇,單車擺在間歇後至少4小時或晚間`, v:`${bw}分鐘`, tss:tssCalc([[bw-10,0.65],[10,0.83]])},
      thu:{t:"閾值間歇(訓練台)", x:`熱身15分鐘;主課 ${btr}x${bte}分鐘 {Z3}上緣~{Z4}下緣(室內以區間下緣執行即可,務必開風扇);息4分鐘;緩和10分鐘`, v:`${15+btr*bte+btr*4+10}分鐘`, tss:tssCalc([[15,0.6],[btr*bte,0.88],[btr*4,0.5],[10,0.55]])},
      sat:{t:"長騎有氧", x:`{Z2} 穩定踩踏,${trainerLong(bs)};每20分鐘補水+電解質`, v:`${bs}分鐘基準`, tss:tssCalc([[bs,0.65]])},
    },
  };
}
function genBuild1(w, rec) {
  const f = rec ? 0.72 : 1;
  const r1 = Math.max(4, Math.round((6+(w-1))*f));
  const r2 = Math.max(3, Math.round((4+(w-1))*f));
  const d3 = Math.max(1800, round50((2600+(w-1)*200)*f));
  const bw = Math.max(60, round5((80+(w-1)*5)*f));
  const bte = Math.max(12, Math.round((15+(w-1)*2)*f)), btr=3;
  const bs = Math.max(150, round5((220+(w-1)*20)*f));
  return {
    swim:{
      tue:{t:"有氧量能提升", x:`熱身400m;技術分解8x50m;主課 ${r1}x200m {EN2} 息20秒;緩和200m`, v:`約${800+r1*200+200}m`},
      fri:{t:"長閾值間歇", x:`熱身400m;主課 ${r2}x300m {THR} 息30秒;緩和200m`, v:`約${400+r2*300+200}m`},
      sun:{t:"開放水域✕比賽配速", x:`連續${d3}m,練習抬頭定位,後段比賽配速;緩和200m`, v:`約${d3+200}m`},
    },
    bike:{
      wed:{t:"Z2耐力+Sweet Spot(訓練台)", x:`${bw}分鐘 {Z2},中段插入2x10分鐘 Sweet Spot(88-93%FTP);排在跑步間歇後至少4小時`, v:`${bw}分鐘`, tss:tssCalc([[bw-20,0.65],[20,0.90]])},
      thu:{t:"FTP強化(訓練台)", x:`熱身15分鐘;主課 ${btr}x${bte}分鐘 {Z4}(室內從下緣${Math.round(0.91*100)}%FTP開始,體感允許再上調);息5分鐘;緩和10分鐘`, v:`${15+btr*bte+btr*5+10}分鐘`, tss:tssCalc([[15,0.6],[btr*bte,0.92],[btr*5,0.5],[10,0.55]])},
      sat:{t:"長距耐力(180km備戰)", x:`{Z2} 為主,${trainerLong(bs)};室內請鎖定空力姿勢維持練習`, v:`${bs}分鐘基準`, tss:tssCalc([[bs,0.67]])},
    },
  };
}
function genBuild2(w, rec) {
  const f = rec ? 0.72 : 1;
  const r1 = Math.max(4, Math.round((6+(w-1))*f));
  const r2 = Math.max(3, Math.round((5+(w-1))*f));
  const d3 = Math.max(2200, round50((3000+(w-1)*200)*f));
  const bw = Math.max(60, round5((85+(w-1)*5)*f));
  const bte = Math.max(14, Math.round((18+(w-1)*3)*f)), btr=3;
  const bs = Math.max(180, round5((270+(w-1)*25)*f));
  return {
    swim:{
      tue:{t:"有氧量能維持", x:`熱身400m;技術分解6x50m;主課 ${r1}x200m {EN2} 息20秒;緩和200m`, v:`約${700+r1*200+200}m`},
      fri:{t:"高強度閾值", x:`熱身400m;主課 ${r2}x300m {THR} 息30秒;緩和200m`, v:`約${400+r2*300+200}m`},
      sun:{t:"長泳耐力", x:`連續${d3}m,全程模擬比賽節奏與補給;緩和200m`, v:`約${d3+200}m`},
    },
    bike:{
      wed:{t:"Z2耐力+Sweet Spot(訓練台)", x:`${bw}分鐘 {Z2},中段插入2x12分鐘 Sweet Spot(88-93%FTP);排在跑步間歇後至少4小時`, v:`${bw}分鐘`, tss:tssCalc([[bw-24,0.65],[24,0.90]])},
      thu:{t:"FTP高峰(訓練台)", x:`熱身15分鐘;主課 ${btr}x${bte}分鐘 {Z4} 下緣起跳;息5分鐘;緩和10分鐘`, v:`${15+btr*bte+btr*5+10}分鐘`, tss:tssCalc([[15,0.6],[btr*bte,0.93],[btr*5,0.5],[10,0.55]])},
      sat:{t: w>=2&&!rec ? "長距耐力+轉換跑Brick" : "長距耐力(接近比賽時長)", x:`{Z2}~{Z3} 混合配速,${trainerLong(bs)}${w>=2&&!rec?";下車後立即接20分鐘226目標配速轉換跑":""};建議此階段開始部分移戶外`, v:`${bs}分鐘基準`, tss:tssCalc([[bs,0.70]])},
    },
  };
}

/* ---------------- 18-week array ---------------- */
const WEEKS = [];
for (let w=1; w<=4; w++) WEEKS.push({ n:w, phase:"base", rest:w===4, ...genBase(w, w===4) });
for (let w=1; w<=4; w++) WEEKS.push({ n:4+w, phase:"build1", rest:w===4, ...genBuild1(w, w===4) });
for (let w=1; w<=4; w++) WEEKS.push({ n:8+w, phase:"build2", rest:w===4, ...genBuild2(w, w===4) });

WEEKS.push({ n:13, phase:"peak", swim:{
    tue:{t:"有氧量能維持", x:"熱身400m;技術分解6x50m;主課 6x200m {EN2} 息20秒;緩和200m", v:"約2200m"},
    fri:{t:"高強度閾值", x:"熱身400m;主課 6x300m {THR} 息30秒;緩和200m", v:"約2600m"},
    sun:{t:"長泳✕比賽配速", x:"連續3200m {EN1},後1000m比賽配速,完整練習補給;緩和200m", v:"約3400m"},
  }, bike:{
    wed:{t:"Z2耐力+Sweet Spot(訓練台)", x:"90分鐘 {Z2},中段2x12分鐘 Sweet Spot(88-93%FTP)", v:"90分鐘", tss:79},
    thu:{t:"FTP高峰(訓練台)", x:"熱身15分鐘;主課 3x20分鐘 {Z4} 下緣起跳;息5分鐘;緩和10分鐘", v:"110分鐘", tss:105},
    sat:{t:"180km前哨長騎+Brick", x:"比賽配速 {Z3} 為主,穿插補給演練;強烈建議戶外(戶外270分鐘/室內230分鐘);下車立即接30分鐘226目標配速轉換跑", v:"約4.5小時+跑30分", tss:288},
  }});
WEEKS.push({ n:14, phase:"peak", key:true, swim:{
    tue:{t:"賽前量能維持", x:"熱身400m;技術分解6x50m;主課 5x200m {EN2} 息20秒;緩和200m", v:"約2100m"},
    fri:{t:"高強度閾值", x:"熱身400m;主課 5x300m {THR} 息30秒;緩和200m", v:"約2500m"},
    sun:{t:"🔑 長泳關鍵課", x:"連續3600m,全程比賽配速,完整演練補給與吞嚥節奏;緩和200m", v:"約3800m"},
  }, bike:{
    wed:{t:"恢復迴轉(訓練台)", x:"連續50分鐘 {Z1}~{Z2}", v:"50分鐘", tss:28},
    thu:{t:"FTP高峰(訓練台)", x:"熱身15分鐘;主課 2x28分鐘 {Z4} 下緣;息8分鐘;緩和10分鐘", v:"105分鐘", tss:99},
    sat:{t:"🔑 180km關鍵長騎+Brick", x:"全程比賽配速 {Z3},完整演練補給、姿勢與散熱;本課務必戶外執行以模擬實路,300-330分鐘;下車立即接40分鐘226目標配速轉換跑 — 本計畫最重單日", v:"約5.5小時+跑40分", tss:335},
  }});
WEEKS.push({ n:15, phase:"peak", swim:{
    tue:{t:"量能收斂", x:"熱身400m;主課 4x200m {EN2} 息20秒;緩和200m", v:"約1800m"},
    fri:{t:"閾值維持", x:"熱身400m;主課 4x250m {THR} 息25秒;緩和200m", v:"約1800m"},
    sun:{t:"中距耐力(收量)", x:"連續2400m {EN1} 中等配速;緩和200m", v:"約2600m"},
  }, bike:{
    wed:{t:"恢復迴轉(訓練台)", x:"連續45分鐘 {Z1}~{Z2}", v:"45分鐘", tss:24},
    thu:{t:"FTP維持(訓練台)", x:"熱身15分鐘;主課 3x12分鐘 {Z4};息4分鐘;緩和10分鐘", v:"75分鐘", tss:71},
    sat:{t:"長騎收斂", x:"{Z2} 含30分鐘比賽配速;室內155分鐘/戶外180分鐘", v:"約3小時", tss:142},
  }});
WEEKS.push({ n:16, phase:"taper", rest:true, swim:{
    tue:{t:"減量有氧", x:"熱身300m;主課 4x100m {EN2} 息20秒;緩和200m", v:"約1000m"},
    fri:{t:"減量閾值", x:"熱身300m;主課 4x100m {THR} 息25秒;緩和200m", v:"約1000m"},
    sun:{t:"輕鬆游", x:"連續1500m {EN1};緩和200m", v:"約1700m"},
  }, bike:{
    wed:{t:"完全恢復(訓練台)", x:"連續30分鐘 {Z1}", v:"30分鐘", tss:15},
    thu:{t:"神經肌肉敏銳(訓練台)", x:"熱身15分鐘;主課 3x5分鐘 {Z4};息3分鐘;緩和10分鐘", v:"40分鐘", tss:40},
    sat:{t:"減量長騎", x:"{Z2};室內75分鐘/戶外90分鐘", v:"約1.5小時", tss:63},
  }});
WEEKS.push({ n:17, phase:"taper", rest:true, swim:{
    tue:{t:"賽前喚醒", x:"熱身300m;主課 4x50m 加速 {VO2} 息30秒;緩和200m", v:"約700m"},
    fri:{t:"賽前開合", x:"熱身300m;主課 6x50m 比賽配速 息20秒;緩和200m", v:"約700m"},
    sun:{t:"熟悉裝備", x:"連續1000m {EN1},熟悉比賽泳裝/防寒衣;緩和200m", v:"約1200m"},
  }, bike:{
    wed:{t:"極輕量(訓練台)", x:"連續20分鐘 {Z1}", v:"20分鐘", tss:10},
    thu:{t:"賽前開合(訓練台)", x:"20分鐘 {Z1}~{Z2},最後5分鐘比賽配速 {Z3}", v:"20分鐘", tss:14},
    sat:{t:"裝備最終確認", x:"{Z2} 45分鐘,建議戶外用比賽車+比賽輪組,同步測試補給品", v:"45分鐘", tss:32},
  }});
WEEKS.push({ n:18, phase:"race", race:true, swim:{}, bike:{} });

const LOAD = {1:6,2:7,3:7,4:5,5:7,6:8,7:8,8:5,9:8,10:9,11:9,12:6,13:9,14:10,15:8,16:5,17:3};

/* ---------------- main ---------------- */
export default function IronmanPlan() {
  const [profile, setProfile] = useState({ height: 175, weight: 68, ftp: 250, tpace: "1:35", marathon: "3:15" });
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(1);
  const [runNotes, setRunNotes] = useState({});
  const [savedFlag, setSavedFlag] = useState({});
  const [expanded, setExpanded] = useState(null); // "wed-bike" etc.
  const saveTimers = useRef({});

  useEffect(() => {
    (async () => {
      try {
        const p = await storage.get("athlete:profile", false);
        if (p && p.value) setProfile(JSON.parse(p.value));
      } catch (e) {}
      const notes = {};
      await Promise.all(
        WEEKS.filter(w => !w.race).flatMap((w) =>
          Object.keys(RUN_TYPE).map(async (day) => {
            try {
              const r = await storage.get(`run:${w.n}:${day}`, false);
              if (r && r.value) notes[`${w.n}:${day}`] = r.value;
            } catch (e) {}
          })
        )
      );
      setRunNotes(notes);
    })();
  }, []);

  useEffect(() => { setExpanded(null); }, [selected]);

  async function saveProfile(next) {
    setProfile(next);
    try { await storage.set("athlete:profile", JSON.stringify(next), false); }
    catch (e) { console.error("儲存個人資料失敗", e); }
  }
  function onRunChange(weekN, day, val) {
    const key = `${weekN}:${day}`;
    setRunNotes((prev) => ({ ...prev, [key]: val }));
    setSavedFlag((prev) => ({ ...prev, [key]: false }));
    clearTimeout(saveTimers.current[key]);
    saveTimers.current[key] = setTimeout(async () => {
      try {
        await storage.set(`run:${weekN}:${day}`, val, false);
        setSavedFlag((prev) => ({ ...prev, [key]: true }));
        setTimeout(() => setSavedFlag((prev) => ({ ...prev, [key]: false })), 1500);
      } catch (e) { console.error("儲存跑步課表失敗", e); }
    }, 600);
  }

  const week = WEEKS.find((w) => w.n === selected);
  const phase = PHASES[week.phase];
  const tpaceSec = (() => {
    const m = /^(\d+):(\d{1,2})$/.exec((profile.tpace || "").trim());
    return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
  })();
  const wkg = profile.weight ? (profile.ftp / profile.weight).toFixed(2) : "—";
  const now = new Date();
  const weeksToRace = N_WEEKS - selected;
  const rp = runPaces(profile.marathon);
  const bikeTss = week.race ? 0 : (week.bike.wed.tss||0)+(week.bike.thu.tss||0)+(week.bike.sat.tss||0);

  /* compact rows: [dayKey, label, items[]] where items = {kind, ...} */
  const rows = week.race ? [] : [
    { day:"mon", items:[{ kind:"rest" }] },
    { day:"tue", items:[
      { kind:"work", id:"tue-str", color:C.iron, icon:<Dumbbell size={13}/>, title:STRENGTH[week.phase].t, detail:STRENGTH[week.phase].x },
      { kind:"work", id:"tue-swim", color:C.water, icon:<Waves size={13}/>, title:week.swim.tue.t, vol:week.swim.tue.v, detail:renderSwim(week.swim.tue.x, tpaceSec) },
    ]},
    { day:"wed", items:[
      { kind:"run", day:"wed" },
      { kind:"work", id:"wed-bike", color:C.power, icon:<BikeIcon size={13}/>, title:week.bike.wed.t, vol:`${week.bike.wed.v} · TSS≈${week.bike.wed.tss}`, detail:renderBike(week.bike.wed.x, profile.ftp) },
    ]},
    { day:"thu", items:[
      { kind:"run", day:"thu" },
      { kind:"work", id:"thu-bike", color:C.power, icon:<BikeIcon size={13}/>, title:week.bike.thu.t, vol:`${week.bike.thu.v} · TSS≈${week.bike.thu.tss}`, detail:renderBike(week.bike.thu.x, profile.ftp) },
    ]},
    { day:"fri", items:[
      { kind:"run", day:"fri" },
      { kind:"work", id:"fri-swim", color:C.water, icon:<Waves size={13}/>, title:week.swim.fri.t, vol:week.swim.fri.v, detail:renderSwim(week.swim.fri.x, tpaceSec) },
    ]},
    { day:"sat", items:[
      { kind:"run", day:"sat" },
      { kind:"work", id:"sat-bike", color:C.power, icon:<BikeIcon size={13}/>, title:week.bike.sat.t, vol:`${week.bike.sat.v} · TSS≈${week.bike.sat.tss}`, detail:renderBike(week.bike.sat.x, profile.ftp) },
    ]},
    { day:"sun", items:[
      { kind:"run", day:"sun" },
      { kind:"work", id:"sun-swim", color:C.water, icon:<Waves size={13}/>, title:week.swim.sun.t, vol:week.swim.sun.v, detail:renderSwim(week.swim.sun.x, tpaceSec) },
    ]},
  ];
  const DAY_LABEL = { mon:"一", tue:"二", wed:"三", thu:"四", fri:"五", sat:"六", sun:"日" };

  return (
    <div style={{ minHeight: "100vh", background: C.ink, color: C.text, fontFamily: "'Inter',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500;600&display=swap');
        .osw { font-family:'Oswald',sans-serif; }
        .mono { font-family:'Roboto Mono',monospace; }
        input[type=text], input[type=number] { background:${C.surface2}; border:1px solid ${C.line}; color:${C.text}; border-radius:8px; padding:8px 10px; font-family:'Roboto Mono',monospace; font-size:14px; width:100%; }
        input.runline { background:transparent; border:none; border-bottom:1px dashed ${C.line}; border-radius:0; padding:2px 4px; font-family:'Inter',sans-serif; font-size:12.5px; }
        input.runline:focus { border-bottom-color:${C.water}; }
        button:focus-visible, input:focus-visible { outline:2px solid ${C.water}; outline-offset:2px; }
        .strip::-webkit-scrollbar{ height:4px; } .strip::-webkit-scrollbar-thumb{ background:${C.line}; border-radius:4px; }
        .rowbtn { transition: background .12s ease; } .rowbtn:hover { background:${C.surface2}; }
      `}</style>

      <div style={{ maxWidth: 760, margin: "0 auto", padding: "20px 16px 50px" }}>
        {/* header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
          <div>
            <h1 className="osw" style={{ fontSize: 21, fontWeight: 600, margin: 0, letterSpacing: 0.5 }}>Ironman 226 訓練面板</h1>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>比賽 2026/11/8（日）· 游3.8k／騎180k／跑42.2k · 距離比賽 {weeksToRace > 0 ? `${weeksToRace} 週` : "本週！"}</div>
          </div>
          <button onClick={() => setEditing((v) => !v)} style={{ background: C.surface, border:`1px solid ${C.line}`, borderRadius:10, padding:"7px 10px", color:C.text, display:"flex", gap:5, alignItems:"center", cursor:"pointer", fontSize:12, flexShrink:0 }}>
            <Settings2 size={14} /> 資料
          </button>
        </div>

        {editing && (
          <div style={{ background: C.surface, border:`1px solid ${C.line}`, borderRadius:12, padding:14, marginBottom:12 }}>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <Field label="身高 (cm)"><input type="number" value={profile.height} onChange={(e) => saveProfile({ ...profile, height:+e.target.value })} /></Field>
              <Field label="體重 (kg)"><input type="number" value={profile.weight} onChange={(e) => saveProfile({ ...profile, weight:+e.target.value })} /></Field>
              <Field label="FTP (W)"><input type="number" value={profile.ftp} onChange={(e) => saveProfile({ ...profile, ftp:+e.target.value })} /></Field>
              <Field label="游泳T-pace（mm:ss/100m）"><input type="text" placeholder="1:35" value={profile.tpace} onChange={(e) => saveProfile({ ...profile, tpace:e.target.value })} /></Field>
              <Field label="全馬成績（h:mm）"><input type="text" placeholder="3:15" value={profile.marathon} onChange={(e) => saveProfile({ ...profile, marathon:e.target.value })} /></Field>
            </div>
            <div style={{ display:"flex", gap:14, marginTop:10, flexWrap:"wrap", fontSize:12 }}>
              <Chip label="W/kg" value={wkg} color={C.power} />
              <span style={{ color:C.muted, display:"flex", gap:5 }}><MonitorPlay size={13} style={{marginTop:1}}/>單車以訓練台為主:間歇課以區間下緣執行、長騎時間自動打85折並附戶外時長。</span>
            </div>
          </div>
        )}

        {/* run pace reference */}
        {rp && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:10, fontSize:11 }} className="mono">
            <span style={{ color:C.muted, fontFamily:"'Inter',sans-serif" }}>跑步配速(全馬{profile.marathon}):</span>
            <PaceChip c={C.green} l="輕鬆" v={`${paceStr(rp.easy[0])}-${paceStr(rp.easy[1])}`} />
            <PaceChip c={C.gold} l="長跑" v={`${paceStr(rp.long[0])}-${paceStr(rp.long[1])}`} />
            <PaceChip c={C.red} l="閾值" v={paceStr(rp.thr)} />
            <PaceChip c={C.red} l="間歇" v={`${paceStr(rp.itv[0])}-${paceStr(rp.itv[1])}`} />
            <PaceChip c={C.water} l="226目標" v={`${paceStr(rp.im[0])}-${paceStr(rp.im[1])}`} />
          </div>
        )}

        {/* week strip */}
        <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:10 }}>
          <NavBtn dir="prev" disabled={selected===1} onClick={() => setSelected((s)=>Math.max(1,s-1))} />
          <div className="strip" style={{ display:"flex", gap:5, overflowX:"auto", padding:"3px 2px", flex:1 }}>
            {WEEKS.map((w) => {
              const active = w.n === selected;
              const isPast = dateFor(w.n, "sun") < now;
              return (
                <button key={w.n} onClick={() => setSelected(w.n)} className="osw"
                  style={{ flexShrink:0, minWidth:42, borderRadius:8, padding:"4px 3px", cursor:"pointer",
                    background: active ? PHASES[w.phase].color : C.surface,
                    color: active ? C.ink : (isPast ? C.muted : C.text),
                    border:`1px solid ${active ? PHASES[w.phase].color : C.line}`,
                    opacity: isPast && !active ? 0.5 : 1, textAlign:"center" }}>
                  <div style={{ fontSize:11, fontWeight:700 }}>{w.race ? "🏁" : `W${w.n}`}</div>
                  <div className="mono" style={{ fontSize:8.5 }}>{fmtDate(dateFor(w.n,"mon"))}</div>
                </button>
              );
            })}
          </div>
          <NavBtn dir="next" disabled={selected===N_WEEKS} onClick={() => setSelected((s)=>Math.min(N_WEEKS,s+1))} />
        </div>

        {/* phase + env, one compact line each */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:4, flexWrap:"wrap" }}>
          <span className="osw" style={{ fontSize:12, letterSpacing:1.2, color:phase.color, textTransform:"uppercase" }}>{phase.label}{week.rest ? " · 減量週" : ""}{week.key ? " · 🔑關鍵週" : ""}</span>
          {!week.race && (
            <span style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:120 }}>
              <span style={{ height:5, borderRadius:3, background:C.surface2, flex:1, overflow:"hidden", display:"block" }}>
                <span style={{ display:"block", height:"100%", width:`${LOAD[week.n]*10}%`, background:phase.color, borderRadius:3 }} />
              </span>
              <span className="mono" style={{ fontSize:10, color:C.muted }}>{LOAD[week.n]}/10</span>
              <span className="mono" style={{ fontSize:10, color:C.power, flexShrink:0 }}>騎TSS≈{bikeTss}</span>
            </span>
          )}
        </div>
        <div style={{ fontSize:11.5, color:C.muted, marginBottom:12, lineHeight:1.5, display:"flex", gap:5 }}>
          <Sun size={12} style={{ flexShrink:0, marginTop:2 }} /><span>{PHASE_ENV[week.phase]}</span>
        </div>

        {/* ---- compact week table ---- */}
        {week.race ? (
          <RaceWeekView profile={profile} />
        ) : (
          <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden" }}>
            {rows.map((row, ri) => {
              const d = dateFor(week.n, row.day);
              const isPast = d < now && d.toDateString() !== now.toDateString();
              const isToday = d.toDateString() === now.toDateString();
              return (
                <div key={row.day} style={{ display:"flex", borderTop: ri===0 ? "none" : `1px solid ${C.line}`, opacity:isPast?0.5:1, background:isToday?"rgba(53,180,196,0.07)":"transparent" }}>
                  <div style={{ width:44, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"8px 0", borderRight:`1px solid ${C.line}` }}>
                    <span className="osw" style={{ fontSize:14, fontWeight:700, color:isToday?C.water:C.text }}>{DAY_LABEL[row.day]}</span>
                    <span className="mono" style={{ fontSize:9, color:C.muted }}>{fmtDate(d)}</span>
                  </div>
                  <div style={{ flex:1, padding:"6px 8px", display:"flex", flexDirection:"column", gap:4, minWidth:0 }}>
                    {row.items.map((it, ii) => {
                      if (it.kind === "rest") return (
                        <div key={ii} style={{ display:"flex", alignItems:"center", gap:6, fontSize:12, color:C.muted, padding:"4px 2px" }}>
                          <Moon size={12}/> 全休 — 讓身體吸收訓練刺激
                        </div>
                      );
                      if (it.kind === "run") {
                        const meta = RUN_META[RUN_TYPE[it.day]];
                        const key = `${week.n}:${it.day}`;
                        return (
                          <div key={ii} style={{ display:"flex", alignItems:"center", gap:6 }}>
                            <span style={{ display:"flex", alignItems:"center", gap:3, fontSize:11, color:meta.color, flexShrink:0, width:52 }}>
                              <Footprints size={12}/>{meta.label}
                            </span>
                            <input className="runline" style={{ flex:1, minWidth:0, color:C.text }} placeholder="填入跑步內容…"
                              value={runNotes[key] || ""} onChange={(e) => onRunChange(week.n, it.day, e.target.value)} />
                            <span style={{ width:14, flexShrink:0 }}>{savedFlag[key] && <Check size={12} color={C.green}/>}</span>
                          </div>
                        );
                      }
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

        <div style={{ fontSize:11, color:C.muted, lineHeight:1.6, marginTop:14 }}>
          點課表列可展開／收合詳細內容。單車以訓練台為主：間歇課同瓦數在室內體感較高（散熱差、無滑行），故以區間下緣執行即可，體感允許再上調；長騎室內時間打85折（持續踩踏訓練刺激等效），並務必開風扇＋大量補水；W13-14 的 180km 關鍵長騎與 W17 裝備確認建議移到戶外，模擬實路操控、風阻與補給。跑步內容直接在每列填入，自動儲存。單車 TSS 為估算值（各段時間 × 強度係數²加總,IF 假設:Z2≈0.65、SweetSpot≈0.90、Z4下緣≈0.92）,實際以功率計錄為準,誤差通常在±10%內;週總騎 TSS 顯示於負荷條右側。訓練比例已向單車傾斜：週三單車升級為 Z2/Sweet Spot 量能課（與跑步間歇同日,兩課間隔至少4小時,跑步在前）、長騎全面加量約15%；相應地,週四/週六的慢跑建議控制在30-45分鐘純恢復,把腿留給單車。
        </div>
      </div>
    </div>
  );
}

/* ---------------- race week ---------------- */
function RaceWeekView({ profile }) {
  const rp = runPaces(profile.marathon);
  const bikeTss = week.race ? 0 : (week.bike.wed.tss||0)+(week.bike.thu.tss||0)+(week.bike.sat.tss||0);
  const items = [
    ["一", fmtDate(dateFor(18,"mon")), "全休;檢查裝備清單與補給品採買"],
    ["二", fmtDate(dateFor(18,"tue")), "游泳喚醒:熱身300m;4x50m加速 息30秒;緩和200m(約700m)"],
    ["三", fmtDate(dateFor(18,"wed")), "單車喚醒(訓練台):30分鐘輕鬆迴轉,中段3x2分鐘比賽配速;檢查車況"],
    ["四", fmtDate(dateFor(18,"thu")), "輕鬆跑20分鐘+4x20秒輕快步幅;開始增加碳水攝取"],
    ["五", fmtDate(dateFor(18,"fri")), "移動/報到日;熟悉轉換區;可15分鐘輕鬆游熟悉水域;早睡"],
    ["六", fmtDate(dateFor(18,"sat")), "單車託運/檢錄;15-20分鐘極輕鬆活動+短加速;確認氣象;補給分裝;早睡"],
  ];
  return (
    <div>
      <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", marginBottom:10 }}>
        {items.map(([d, dt, txt], i) => (
          <div key={i} style={{ display:"flex", borderTop:i===0?"none":`1px solid ${C.line}` }}>
            <div style={{ width:44, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", padding:"7px 0", borderRight:`1px solid ${C.line}` }}>
              <span className="osw" style={{ fontSize:14, fontWeight:700 }}>{d}</span>
              <span className="mono" style={{ fontSize:9, color:C.muted }}>{dt}</span>
            </div>
            <div style={{ flex:1, padding:"7px 10px", fontSize:12, color:C.text, opacity:0.9, lineHeight:1.5 }}>{txt}</div>
          </div>
        ))}
      </div>
      <div style={{ border:`1.5px solid ${C.gold}`, borderRadius:12, padding:"12px 14px", background:"rgba(255,209,102,0.06)" }}>
        <div style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>🏁 週日 {fmtDate(RACE_DATE)} — 226 比賽日</div>
        <div style={{ fontSize:12.5, lineHeight:1.7 }}>
          <div><span style={{ color:C.water, fontWeight:600 }}>游 3.8km</span>：輕鬆-中等有氧,起跳勿快,善用跟游</div>
          <div><span style={{ color:C.power, fontWeight:600 }}>騎 180km</span>：約70-75% FTP（{Math.round(profile.ftp*0.7)}-{Math.round(profile.ftp*0.75)}W）,每15-20分鐘補給</div>
          <div><span style={{ color:C.red, fontWeight:600 }}>跑 42.2km</span>：目標配速 {rp ? `${paceStr(rp.im[0])}-${paceStr(rp.im[1])}/km` : "輕鬆-中等"}（約4:00-4:15完跑）,前10km刻意壓慢</div>
        </div>
        <div style={{ fontSize:11.5, color:C.gold, marginTop:8, fontWeight:600 }}>Sub-12 拆分參考：游 1:20-1:30 ＋ T1 約8分 ＋ 騎 6:00-6:15 ＋ T2 約6分 ＋ 跑 4:00-4:15 ≈ 11:40-11:55</div>
        <div style={{ fontSize:11, color:C.muted, marginTop:6 }}>11月上旬偶有秋老虎,起跑前依實際氣溫微調補水與電解質。祝完賽順利！</div>
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
    <span style={{ color:c }}>{l}</span><span style={{ color:C.text }}>{v}/km</span></span>);
}
function Chip({ label, value, color }) {
  return (<span style={{ display:"flex", alignItems:"baseline", gap:5 }}><span style={{ fontSize:11, color:C.muted }}>{label}</span><span className="mono" style={{ fontSize:14, color, fontWeight:600 }}>{value}</span></span>);
}
function NavBtn({ dir, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={dir==="prev"?"上一週":"下一週"}
      style={{ width:28, height:28, borderRadius:"50%", background:C.surface, border:`1px solid ${C.line}`, color: disabled?C.muted:C.text, display:"flex", alignItems:"center", justifyContent:"center", cursor: disabled?"not-allowed":"pointer", opacity: disabled?0.4:1, flexShrink:0 }}>
      {dir==="prev" ? <ChevronLeft size={15}/> : <ChevronRight size={15}/>}
    </button>
  );
}
