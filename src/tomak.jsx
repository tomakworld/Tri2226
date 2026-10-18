import React, { useState, useEffect } from "react";
import { Footprints, Dumbbell, Bike, Moon, ChevronLeft, ChevronRight, Flag, Target, AlertTriangle, BedDouble } from "lucide-react";

/* ============================================================
   tomak 專屬 Sub-3 課表　2026-10-19(一) 起 · 12週 · 賽 2027-01-10(日)
   45歲 / 169cm / 64kg / 最大心率 178 / 全馬PB 3:08:05(2024台北馬)

   ── 建檔依據(全部來自實測) ──
   [2024台北馬] 3:08:05。前半1:33:58 後半1:34:07,正負差9秒;脫鉤+4.1%;
     平均心率150(84%max)、最高166、終點157。35km後配速4:23→4:33 而心率不升甚至微降
     → 不是心肺到頂,是肌肉/肝醣見底。這決定了整份課表的重心。
   [VDOT落差] Garmin預測 5K 54.7 / 10K 52.0 / 半馬 51.2 / 全馬 48.2,落差6.5點
     (正常1-2點)。速度端夠用,馬拉松專項耐力是缺口 → 刻意減少 I/R,量押在 T 與 M。
   [跑量] 月實測 5月14.8 → 9月40.9 → 10月51.0 km/週。12週能安全到的峰值約72km跑步
     + 每週1-2次Z2騎車。Sub-3常見週量80-110km,這是最大的結構限制。
   [睡眠] 8/24-9/20 平均6:33(需求8:24) / 9/21-10/18 平均6:20(需求8:23),56天只有1天達標。
     同期HRV 50→41轉不平衡、負荷比1.0最佳 → 負荷合理,恢復不足。本人已決定調整睡眠。
   [補給] 2024比賽每小時40-50g碳水。3小時約需500-540g醣類,庫存500-600g,
     他只補回25% → 35km見底的位置完全吻合。拉到70-80g/hr是全案投報率最高的改動。
   [重訓] 深蹲/硬舉 5x5 @1.5倍體重(約96kg,推估1RM約110kg = 85-88%),含核心與跳箱。
     型態與強度已正確,不需轉換期;只改位置(週四→週二傍晚)與分期遞減(砍組數不砍重量)。
   [騎車] 每週2-3次 → 取代週三輕鬆跑,同樣有氧刺激、零衝擊。長跑與兩堂Q課必須是跑步。

   ── 核心指標 ──
   比賽心率150-157。訓練追蹤「心率152-155時的配速」:
   現在約4:40-4:45 → 2024比賽4:27 → Sub-3需要4:15。
   ============================================================ */

const store = {
  async get(k){
    if (window.storage) { const r = await window.storage.get(k, false); return r ? r.value : null; }
    try { return localStorage.getItem("tomak:" + k); } catch(e) { return null; }
  },
  async set(k, v){
    if (window.storage) return window.storage.set(k, v, false);
    try { localStorage.setItem("tomak:" + k, v); } catch(e) {}
  },
};

const C = {
  bg:"#F4F1EA", surface:"#FFFFFF", surface2:"#EAE4D8", line:"#D8CFBC",
  main:"#1F6F5C", accent:"#B4531F", red:"#B33A2B", green:"#2E8B62",
  gold:"#9A7B16", iron:"#5A5570", sky:"#2B6E96", text:"#241F18", muted:"#7D7465",
};

/* ---------- Daniels-Gilbert ---------- */
const pctVO2 = (t) => 0.8 + 0.1894393*Math.exp(-0.012778*t) + 0.2989558*Math.exp(-0.1932605*t);
const vo2of  = (v) => -4.60 + 0.182258*v + 0.000104*v*v;
function vdotOf(m, min){ return vo2of(m/min) / pctVO2(min); }
function velAt(V,p){ const a=0.000104,b=0.182258,c=-4.60-V*p; return (-b+Math.sqrt(b*b-4*a*c))/(2*a); }
const secPerKm = (V,p) => 1000/velAt(V,p)*60;
const pstr = (s) => (!isFinite(s)||s<=0) ? "—" : `${Math.floor(s/60)}:${String(Math.round(s%60)).padStart(2,"0")}`;
const hms = (s) => `${Math.floor(s/3600)}:${String(Math.floor(s%3600/60)).padStart(2,"0")}:${String(Math.round(s%60)).padStart(2,"0")}`;
const pacesOf = (V) => ({ eLo:secPerKm(V,0.66), eHi:secPerKm(V,0.74),
  t:secPerKm(V,0.88), i:secPerKm(V,0.975), r:secPerKm(V,1.11) });
function marathonTimeFor(V){ let lo=140,hi=260;
  for(let k=0;k<60;k++){ const m=(lo+hi)/2; if(vdotOf(42195,m)>V) lo=m; else hi=m; } return (lo+hi)/2*60; }

/* ---------- 參數 ---------- */
const PROGRAM_START = new Date(2026, 9, 19);
const RACE_DATE     = new Date(2027, 0, 10);
const N = 12;
const GOAL_SEC  = 2*3600 + 59*60 + 30;
const GOAL_PACE = GOAL_SEC / 42.195;          // 4:15/km
const HR_MAX = 178;
const HR_M   = [151, 157];                     // 比賽心率區(2024實測150平均/157終點)
const HRZ = { E:[116,141], M:[142,158], T:[157,164], I:[169,178] };

/* ---- 氣溫校正 ----
   訓練在台中清晨(10月下旬22-24°C,濕度75-85%),比賽在台北1月早上(約14-16°C)。
   溫差8-10度。3小時等級的跑者,氣溫每高5°C約慢1.5-3%,濕度>70%再往上加。
   2024台北馬當天11°C — 那已是好條件,所以3:08沒有「天氣不好」的空間可回收。
   基準溫度取比賽日的 12-16°C。 */
const TEMPS = [
  { k:"≤16°C", adj:0,  lbl:"比賽日條件" },
  { k:"17-20", adj:7,  lbl:"涼" },
  { k:"21-24", adj:13, lbl:"偏熱" },
  { k:"25-28", adj:22, lbl:"熱" },
];
const HUMID_ADJ = 6;                      // 濕度 >75% 再加
/* 各週預期晨溫(台中)與主控指標 */
const WEEK_TEMP = {1:23,2:22,3:22,4:21,5:20,6:19,7:17,8:16,9:16,10:15,11:15,12:14};
const primaryBy = (w) => w<=5 ? "hr" : (w<=9 ? "both" : "pace");

const VDOT_BY_WEEK = {1:51,2:51,3:51.5,4:51.5,5:51.5,6:52,7:52.5,8:52.5,9:53,10:53,11:53.5,12:53.5};
const RUN_KM   = {1:45,2:51,3:56,4:47,5:60,6:64,7:69,8:56,9:72,10:52,11:39,12:25};
const WEEK_PHASE = {1:"p1",2:"p1",3:"p2",4:"p2",5:"p2",6:"p3",7:"p3",8:"p3",9:"p4",10:"taper",11:"taper",12:"race"};
const DELOAD = {4:true, 8:true};
const PEAK_RUN = 72;

const PHASES = {
  p1:{ label:"基礎期",     color:C.main,   note:"睡眠優先。先把 HRV 接回基線,再談加量" },
  p2:{ label:"強化期一",   color:C.accent, note:"T配速為主軸 — 瓶頸在這裡,不在速度" },
  p3:{ label:"強化期二",   color:C.accent, note:"T + M 混合,長跑帶質量,補給拉到 70g/hr" },
  p4:{ label:"馬拉松專項", color:C.red,    note:"全部繞著 4:15 轉,把目標配速變成本能" },
  taper:{ label:"減量期",  color:C.green,  note:"量減46%,配速一秒不讓;重訓砍組數不砍重量" },
  race:{ label:"比賽週",   color:C.gold,   note:"1/10 渣打,去把 2:59 拿下來" },
};

/* 補給分期 — 2024只吃40-50g/hr,補回消耗的25%,是35km崩掉的主因之一 */
const FUEL = {
  p1:{ gph:"水與電解質為主,90分後才吃第一包", why:"低補給長跑:正常吃晚餐、早上空腹出門、全程純E,練脂肪利用。這階段不跟M配速同堂。" },
  p2:{ gph:"60 g/hr", why:"開始練腸胃。一包膠約20-25g,配500ml運動飲料(6%約30g)比純吃膠好吞。" },
  p3:{ gph:"70-80 g/hr", why:"所有超過90分的課都照比賽規格吃。選葡萄糖:果糖 2:1 的配方 — 純葡萄糖吸收上限約60g/hr,混合可到90。" },
  p4:{ gph:"70-80 g/hr", why:"鎖定有效組合,不再試新東西。" },
  taper:{ gph:"70-80 g/hr", why:"長跑仍照比賽規格,確認腸胃穩定。" },
  race:{ gph:"70-80 g/hr", why:"每40分一包,第一包在40分而不是渴了才吃。" },
};

/* 重訓 — 5x5 @96kg 已是 85-88% 1RM,型態正確。只改位置與組數,重量全程不降 */
const STRENGTH = {
  p1:{ t:"大重量 5x5", x:"深蹲/硬舉 5組x5 @目前重量(約96kg)+ 單腳RDL + 核心 + 跳箱。週二晨跑後傍晚做,間隔12小時以上 — 絕不排在週五Q2前一天" },
  p2:{ t:"大重量 5x5", x:"維持 5組x5 @96kg + 跳箱。重量不加,把進步留給跑步" },
  p3:{ t:"維持 3x5", x:"砍到 3組x5,重量不變。跑量到峰值,重訓只留神經適應,不製造痠痛" },
  p4:{ t:"維持 3x5", x:"3組x5 @96kg + 跳箱。45歲的肌腱剛性是 35km 之後的本錢" },
  taper:{ t:"神經活化 2x3", x:"2組x3 @96kg,重量仍不降 — 降重量會把神經適應丟掉。另加彈力帶與動態熱身" },
  race:{ t:"只做跳箱/徒手", x:"或直接跳過" },
};

/* ---------- Q課庫 ---------- */
function qOf(wk, P){
  const E=`${pstr(P.eLo)}-${pstr(P.eHi)}`, T=pstr(P.t), M=pstr(GOAL_PACE);
  const rep=(m,s)=>`(每趟 ${pstr(s*m/1000)})`;
  const hrCap = `配速守 ${M}、心率上限 ${HR_M[1]} — 超過就代表今天狀態不到位,當天降到 4:20 完成,不要硬撐`;
  const Q = {
    1:{ q1:{t:"Q1·T入門(輕)", x:`熱身2km;2x10分 T @${T} 休3分;緩和2km。本週刻意輕 — HRV 連掉四週已轉不平衡,先接回來再談加量`, v:"2x10分T", km:9},
        q2:{t:"Q2·M起步", x:`熱身2km;6km @${M};緩和2km。第一次踩 Sub-3 的節奏,記住它有多快。${hrCap}`, v:`6km@${M}`, km:10},
        lg:{km:20, x:`全程 E @${E},心率壓在 141 以下;最後2km 轉 @${M}`} },
    2:{ q1:{t:"Q1·T巡航", x:`熱身2km;2x12分 T @${T} 休3分;緩和2km`, v:"2x12分T", km:11},
        q2:{t:"Q2·M專項", x:`熱身2km;8km @${M};收尾4x200m ${rep(200,P.r)};緩和1km。${hrCap}`, v:`8km@${M}`, km:12},
        lg:{km:22, x:`E @${E},末4km @${M};心率壓在 141 以下`} },
    3:{ q1:{t:"Q1·T鞏固", x:`熱身2km;2x3km T @${T} 休2分;緩和3km`, v:"2x3km T", km:11},
        q2:{t:"Q2·M專項", x:`熱身2km;10km @${M};緩和2km。${hrCap}`, v:`10km@${M}`, km:14},
        lg:{km:24, x:`E @${E},末4km @${M}`} },
    4:{ q1:{t:"Q1·減量T", x:`熱身2km;2x10分 T @${T} 休3分;緩和2km`, v:"2x10分T", km:9},
        q2:{t:"Q2·輕M", x:`熱身2km;6km @${M};緩和2km。${hrCap}`, v:`6km@${M}`, km:10},
        lg:{km:20, x:`全程 E @${E},純恢復。本階段最後一次低補給長跑`} },
    5:{ q1:{t:"Q1·T延長", x:`熱身2km;2x3km T @${T} 休2分;緩和3km`, v:"2x3km T", km:11},
        q2:{t:"Q2·M專項", x:`熱身2km;10km @${M};緩和2km。${hrCap}`, v:`10km@${M}`, km:14},
        lg:{km:26, x:`E @${E},末5km @${M}。本週起改全補給,照比賽規格吃`} },
    6:{ q1:{t:"🔬 10K 實測", x:`熱身3km(含4x100m加速);10km 全力計時,平路、單趟、不要配速員;緩和2km。中期校準點 — 用結果重設下半期所有配速`, v:"10K TT", km:15},
        q2:{t:"Q2·M專項", x:`熱身2km;8km @${M};緩和2km。測驗後第3天,本週高強度已用在測驗上,M課縮短。${hrCap}`, v:`8km@${M}`, km:12},
        lg:{km:26, x:`E @${E},末4km @${M}`} },
    7:{ q1:{t:"Q1·短T(為週五讓路)", x:`熱身2km;4x1000m T ${rep(1000,P.t)} 休2分;緩和2km。本週重頭戲在週五,週二只維持不消耗`, v:"4x1000T", km:8},
        q2:{t:"Q2·🎯 16km @M", x:`熱身2km;16km @${M};緩和2km。全期最重要的一堂 — 撐不撐得完,是 Sub-3 的誠實答案。${hrCap}`, v:`16km@${M}`, km:20},
        lg:{km:28, x:`E @${E},末4km @${M}。上限2小時40分,超時就停 — 時間比距離重要`} },
    8:{ q1:{t:"Q1·減量T", x:`熱身2km;2x12分 T @${T} 休3分;緩和2km`, v:"2x12分T", km:11},
        q2:{t:"Q2·輕M", x:`熱身2km;10km @${M};緩和2km。${hrCap}`, v:`10km@${M}`, km:14},
        lg:{km:22, x:`E @${E},末4km @${M}`} },
    9:{ q1:{t:"Q1·T鞏固", x:`熱身2km;2x3km T @${T} 休2分;緩和2km`, v:"2x3km T", km:10},
        q2:{t:"Q2·最後大M", x:`熱身2km;11km @${M};緩和2km。賽前最後一堂大M課 — 之後只會變短不會變慢。${hrCap}`, v:`11km@${M}`, km:15},
        lg:{km:30, x:`E @${E},末8km @${M}。全期最長也最該保護的一堂;完整演練比賽日補給與裝備,M段要落在已經跑了20km之後`} },
    10:{ q1:{t:"Q1·敏銳", x:`熱身2km;5x1000m T ${rep(1000,P.t)} 休2分;緩和2km — 趟數減、配速不減`, v:"5x1000T", km:9},
        q2:{t:"Q2·M維持", x:`熱身2km;9km @${M};4x100m加速;緩和2km。${hrCap}`, v:`9km@${M}`, km:13},
        lg:{km:22, x:`E @${E},末4km @${M}。減量期把長跑砍到18km以下是最常見的錯誤`} },
    11:{ q1:{t:"Q1·短而銳", x:`熱身2km;4x1000m T ${rep(1000,P.t)} 休2分;緩和2km`, v:"4x1000T", km:8},
        q2:{t:"Q2·M記憶", x:`熱身2km;6km @${M};4x100m加速;緩和1km`, v:`6km@${M}`, km:9},
        lg:{km:16, x:`E @${E},末3km @${M}`} },
  };
  return Q[wk] || null;
}

/* ---------- 條件式加量閘門 ---------- */
function gateFor(wk){
  if (wk === 1) return { t:"W1 是恢復週,不是起跑",
    c:["本週跑量 45km,刻意低於目前的 51km","目標:HRV 回到 42 以上(基線帶內)、睡眠週均 ≥6:45"],
    fail:"週日檢查:HRV 仍不平衡 → W2 原地重複 W1,不要往上加" };
  if (wk === 4) return { t:"減量週 — 第一個放行閘門",
    c:["HRV 全週在基線帶內(42以上)","睡眠週均 ≥6:45","Q課沒有因為跑不動而降速"],
    fail:"任一項沒到 → W5 重複 W3 的量(56km),不要跳到 60km" };
  if (wk === 8) return { t:"減量週 — 第二個放行閘門",
    c:["HRV 全週 Balanced","睡眠週均 ≥7:00","W7 的 16km @4:15 有完成"],
    fail:"任一項沒到 → W9 峰值降到 64km,長跑縮到 26km。保住減量期的品質比硬撐峰值重要" };
  return null;
}

/* ---------- Garmin 對照 ---------- */
function garminFor(toGo){
  if (toGo >= 10) return { lr:"0.85-1.00", hrv:"目標:從不平衡回到 42 以上", st:"Maintaining",
    note:"10/18 基準:HRV 連掉四週 50→41、睡眠 6:20(需求 8:23)、負荷比 1.0。負荷沒問題,恢復有問題 — 這兩週如果 HRV 還在掉,先看睡眠,不要改課表" };
  if (toGo === 2) return { lr:"0.80-0.95", hrv:"全週 Balanced", st:"Productive / Maintaining",
    note:"最後一個有份量的週(52km含22km長跑);負荷比掉破0.75代表減太快,長跑加3km補回來" };
  if (toGo === 1) return { lr:"0.68-0.82", hrv:"Balanced,往基線帶上緣走", st:"Maintaining → Peaking",
    note:"Peaking 多在這週末出現;若顯示 Unproductive,Q1 加回1趟1000m" };
  if (toGo === 0) return { lr:"0.55-0.72", hrv:"Balanced,賽前三天應是全期最高", st:"Peaking",
    note:"負荷比低於0.50就是減過頭;Training Readiness 要在 High/Prime" };
  return null;
}

const DAY_OFFSET = { mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6 };
const DAY_LABEL  = { mon:"一",tue:"二",wed:"三",thu:"四",fri:"五",sat:"六",sun:"日" };
function dateFor(w,d){ const x=new Date(PROGRAM_START); x.setDate(x.getDate()+(w-1)*7+DAY_OFFSET[d]); return x; }
const fmtD = (d) => `${d.getMonth()+1}/${d.getDate()}`;

export default function App(){
  const [vdotAdj, setVdotAdj] = useState(0);
  const [tIdx, setTIdx] = useState(2);
  const [humid, setHumid] = useState(true);
  const [sel, setSel] = useState(1);
  const [ready, setReady] = useState(false);
  const [jumped, setJumped] = useState(false);

  useEffect(()=>{ (async()=>{
    const v=await store.get("vdotAdj"); if(v!==null && v!=="") setVdotAdj(Number(v)||0);
    const t=await store.get("tIdx");    if(t!==null && t!=="") setTIdx(Number(t)||0);
    const h=await store.get("humid");   if(h!==null && h!=="") setHumid(h==="1");
    setReady(true); })(); },[]);
  useEffect(()=>{ if(ready){ store.set("vdotAdj", String(vdotAdj)); store.set("tIdx", String(tIdx)); store.set("humid", humid?"1":"0"); } },[vdotAdj,tIdx,humid,ready]);

  const now = new Date();
  const curWeek = Math.min(N, Math.max(1, Math.floor((now - PROGRAM_START)/(7*864e5)) + 1));
  useEffect(()=>{ if(ready && !jumped){ setSel(curWeek); setJumped(true); } },[ready,jumped,curWeek]);

  const V = (VDOT_BY_WEEK[sel]||51) + vdotAdj;
  const P = pacesOf(V);
  const ph = WEEK_PHASE[sel];
  const phase = PHASES[ph];
  const isRace = sel === N;
  const q = isRace ? null : qOf(sel, P);
  const km = RUN_KM[sel];
  const g = garminFor(N - sel);
  const gate = gateFor(sel);
  const fuel = FUEL[ph];

  const tAdj = TEMPS[tIdx].adj + (humid ? HUMID_ADJ : 0);
  const mToday = GOAL_PACE + tAdj;
  const prim = primaryBy(sel);

  const easyTotal = isRace ? 0 : Math.max(4, km - q.q1.km - q.q2.km - q.lg.km);
  const eThu = Math.round(easyTotal*0.55), eSat = easyTotal - eThu;

  const rows = isRace ? [] : [
    { day:"mon", icon:<Moon size={13}/>, color:C.muted, t:"全休", x:"完全休息。45歲加上目前的睡眠缺口,這天不要安排任何訓練 — 包括騎車", v:"" },
    { day:"tue", icon:<Footprints size={13}/>, color:C.accent, ...q.q1,
      extra:`傍晚 重訓 ${STRENGTH[ph].t}：${STRENGTH[ph].x}` },
    { day:"wed", icon:<Bike size={13}/>, color:C.sky, t:"Z2 騎車(取代輕鬆跑)",
      x:`45-60分 Z2,心率 ${HRZ.E[0]}-${HRZ.E[1]}。同樣的有氧刺激、零衝擊 — 把腿留給週五和週日。想多騎第二趟就放這天加長到90分`, v:"45-60分" },
    { day:"thu", icon:<Footprints size={13}/>, color:C.main, t:"輕鬆跑 + 加速跑",
      x:`${eThu}km @${pstr(P.eLo)}-${pstr(P.eHi)} 含 6x100m 加速。真的要輕鬆 — 這天跑太快會吃掉週五`, v:`${eThu}km` },
    { day:"fri", icon:<Footprints size={13}/>, color:C.accent, ...q.q2 },
    { day:"sat", icon:<Footprints size={13}/>, color:C.main, t:"輕鬆跑",
      x:`${eSat}km @${pstr(P.eLo)}-${pstr(P.eHi)};長跑前保留體力。這天也可以改成 40 分 Z2 騎車`, v:`${eSat}km` },
    { day:"sun", icon:<Footprints size={13}/>, color:C.red, t:"長跑", x:q.lg.x, v:`${q.lg.km}km` },
  ];

  return (
    <div style={{ background:C.bg, minHeight:"100vh", color:C.text, fontFamily:"ui-sans-serif,system-ui,'Noto Sans TC',sans-serif" }}>
      <style>{`.mono{font-variant-numeric:tabular-nums;font-family:ui-monospace,monospace}.osw{letter-spacing:.5px}`}</style>

      <div style={{ maxWidth:720, margin:"0 auto", padding:"18px 14px 60px" }}>
        <div style={{ marginBottom:14 }}>
          <div className="osw" style={{ fontSize:25, fontWeight:800, letterSpacing:-0.3 }}>tomak · Sub-3</div>
          <div style={{ fontSize:12.5, color:C.muted, marginTop:3 }}>
            45歲 · 169cm · 64kg · max HR 178 · PB 3:08:05　|　2026/10/19 起 · 12週 · 渣打 2027/01/10(日)
          </div>
        </div>

        {/* 核心診斷 */}
        <div style={{ background:C.surface, border:`1.5px solid ${C.accent}`, borderRadius:12, padding:"12px 14px", marginBottom:12 }}>
          <div style={{ display:"flex", gap:6, alignItems:"center", fontWeight:700, fontSize:13.5, color:C.accent, marginBottom:6 }}>
            <Target size={15}/> 2024 台北馬告訴我們什麼
          </div>
          <div style={{ fontSize:12.3, lineHeight:1.75 }}>
            3:08:05,前半 1:33:58 / 後半 1:34:07 —— <b>正負差 9 秒</b>,脫鉤 +4.1%,平均心率 150(84% max)。
            配速配得近乎完美,所以 3:09 裡面<b>沒有藏著「配速沒配好」的免費空間</b>。
            <div style={{ marginTop:6 }}>
              但 35km 之後配速 4:23 → 4:33 而<b>心率不升反降</b>(156→151)。心率不升、速度掉 ——
              那不是心肺到頂,是肌肉與肝醣見底。你比賽只用到 84% 的最大心率,心肺有餘裕。
            </div>
            <div style={{ marginTop:6, padding:"7px 9px", background:C.surface2, borderRadius:8 }}>
              <b>所以這 12 週的重心是三件事</b>：疲勞狀態下維持 4:15 的能力(長跑末段 M 配速)、
              把補給從 45g/hr 拉到 75g/hr、以及用重訓撐住 35km 之後的離心耐受。
              <b>不是練更多間歇</b> —— 你的速度端 VDOT 54.7,不缺那個。
            </div>
          </div>
        </div>

        {/* 配速 + 心率 */}
        <div style={{ background:C.surface, border:`1px solid ${C.line}`, borderRadius:12, padding:"11px 13px", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:8, flexWrap:"wrap" }}>
            <span style={{ fontWeight:700, fontSize:13 }}>本週配速</span>
            <span className="mono" style={{ fontSize:11.5, color:C.muted }}>訓練 VDOT {V.toFixed(1)}</span>
            <span style={{ fontSize:11, color:C.muted, marginLeft:"auto" }}>W6 實測後用下方微調</span>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(88px,1fr))", gap:7 }}>
            {[["E 輕鬆",`${pstr(P.eLo)}-${pstr(P.eHi)}`,C.main,`${HRZ.E[0]}-${HRZ.E[1]}`],
              ["M 目標",pstr(GOAL_PACE),C.red,`${HR_M[0]}-${HR_M[1]}`],
              ["T 閾值",pstr(P.t),C.accent,`${HRZ.T[0]}-${HRZ.T[1]}`],
              ["I 間歇",pstr(P.i),C.iron,`${HRZ.I[0]}-${HRZ.I[1]}`],
              ["R 反覆",pstr(P.r),C.gold,"不看心率"]].map(([k,v,col,hr])=>(
              <div key={k} style={{ background:C.surface2, borderRadius:9, padding:"7px 9px", textAlign:"center" }}>
                <div style={{ fontSize:10.5, color:C.muted }}>{k}</div>
                <div className="mono" style={{ fontSize:15, fontWeight:700, color:col }}>{v}</div>
                <div className="mono" style={{ fontSize:9.5, color:C.muted, marginTop:1 }}>♥ {hr}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize:11.3, color:C.muted, marginTop:8, lineHeight:1.6 }}>
            <b>追蹤這一個數字就好:心率 152-155 時的配速。</b>
            現在約 4:40-4:45 → 2024比賽 4:27 → Sub-3 需要 <b className="mono" style={{color:C.red}}>4:15</b>。
            每堂 M 課記下來,它往下掉的速度比任何預測模型都準。
            <div style={{ marginTop:5, display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
              <span>VDOT 微調</span>
              <button onClick={()=>setVdotAdj(v=>Math.round((v-0.5)*10)/10)} style={{ padding:"3px 10px", borderRadius:7, border:`1px solid ${C.line}`, background:C.surface, cursor:"pointer", fontSize:13 }}>−0.5</button>
              <span className="mono" style={{ minWidth:42, textAlign:"center", fontWeight:700 }}>{vdotAdj>0?"+":""}{vdotAdj}</span>
              <button onClick={()=>setVdotAdj(v=>Math.round((v+0.5)*10)/10)} style={{ padding:"3px 10px", borderRadius:7, border:`1px solid ${C.line}`, background:C.surface, cursor:"pointer", fontSize:13 }}>+0.5</button>
              <span style={{ color:C.muted }}>→ 預測全馬 {hms(marathonTimeFor(V))}</span>
            </div>
          </div>
        </div>

        {/* 氣溫校正 */}
        <div style={{ background:C.surface, border:`1.5px solid ${prim==="hr"?C.red:C.line}`, borderRadius:12, padding:"11px 13px", marginBottom:12 }}>
          <div style={{ display:"flex", alignItems:"baseline", gap:8, marginBottom:7, flexWrap:"wrap" }}>
            <span style={{ fontWeight:700, fontSize:13 }}>🌡 今天幾度？</span>
            <span style={{ fontSize:11, color:C.muted }}>本週預期晨溫 約 {WEEK_TEMP[sel]}°C</span>
          </div>
          <div style={{ display:"flex", gap:5, flexWrap:"wrap", marginBottom:7 }}>
            {TEMPS.map((t,i)=>(
              <button key={t.k} onClick={()=>setTIdx(i)} style={{
                padding:"5px 10px", borderRadius:8, cursor:"pointer", fontSize:11.5, fontWeight:600,
                background: i===tIdx?C.accent:C.surface, color:i===tIdx?"#fff":C.text,
                border:`1px solid ${i===tIdx?C.accent:C.line}` }}>
                {t.k}<span style={{ fontSize:9.5, opacity:0.75, marginLeft:4 }}>{t.lbl}</span>
              </button>
            ))}
            <button onClick={()=>setHumid(h=>!h)} style={{
              padding:"5px 10px", borderRadius:8, cursor:"pointer", fontSize:11.5, fontWeight:600,
              background: humid?C.sky:C.surface, color:humid?"#fff":C.muted,
              border:`1px solid ${humid?C.sky:C.line}` }}>濕度 70%以上</button>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", fontSize:12.3 }}>
            <span>今天的 M 配速：</span>
            <span className="mono" style={{ fontSize:19, fontWeight:800, color:C.red }}>{pstr(mToday)}</span>
            {tAdj>0 && <span className="mono" style={{ fontSize:11.5, color:C.muted }}>(4:15 + {tAdj}秒)</span>}
            <span style={{ marginLeft:"auto", fontSize:11.5, color:C.muted }}>心率不變 {HR_M[0]}-{HR_M[1]}</span>
          </div>
          <div style={{ fontSize:11.3, lineHeight:1.65, marginTop:7, padding:"7px 9px", borderRadius:8,
            background: prim==="hr" ? "rgba(179,58,43,0.08)" : C.surface2 }}>
            {prim==="hr" && <><b style={{color:C.red}}>本週心率優先。</b> 天還熱,硬守 4:15 等於在跑閾值強度 —— 那會把 HRV 繼續往下壓。
              守住 151-157,配速是多少就是多少。</>}
            {prim==="both" && <><b>配速與心率並重。</b> 天氣轉涼了,兩個數字應該開始靠攏。如果心率對了但配速還差 10 秒以上,那是體能問題不是天氣問題。</>}
            {prim==="pace" && <><b>配速優先。</b> 已是接近比賽的條件,4:15 要穩穩守住,心率應落在 151-157。守不住就是真的還沒到。</>}
          </div>
        </div>

        {/* 週導覽 */}
        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:10 }}>
          <Nav dir="p" disabled={sel===1} onClick={()=>setSel(v=>Math.max(1,v-1))}/>
          <div style={{ flex:1, display:"grid", gridTemplateColumns:`repeat(${N},1fr)`, gap:3 }}>
            {Array.from({length:N},(_,i)=>i+1).map(w=>{
              const active=w===sel, past=w<curWeek;
              return (
                <button key={w} onClick={()=>setSel(w)} style={{
                  padding:"5px 0", borderRadius:7, cursor:"pointer", fontSize:11, fontWeight:700,
                  background: active?PHASES[WEEK_PHASE[w]].color:C.surface,
                  color: active?"#fff":(past?C.muted:C.text),
                  border:`1px solid ${active?PHASES[WEEK_PHASE[w]].color:C.line}`,
                  opacity: past&&!active?0.5:1 }}>
                  {w===N?"🏁":(w===6?"🔬6":(w===7?"🎯7":`W${w}`))}
                </button>
              );
            })}
          </div>
          <Nav dir="n" disabled={sel===N} onClick={()=>setSel(v=>Math.min(N,v+1))}/>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10, flexWrap:"wrap", fontSize:11.5 }}>
          <span className="osw" style={{ fontSize:12, color:phase.color, fontWeight:700, letterSpacing:1 }}>
            {phase.label}{DELOAD[sel]?"·減量":""}
          </span>
          <span style={{ color:C.muted }}>{phase.note}</span>
          <span className="mono" style={{ fontSize:10.5, color:C.accent, marginLeft:"auto" }}>
            跑量≈{km}km{isRace?" + 比賽":" + 騎車"}
          </span>
        </div>

        {/* 閘門 */}
        {gate && (
          <div style={{ background:"rgba(180,83,31,0.07)", border:`1.5px solid ${C.accent}`, borderRadius:10, padding:"10px 12px", marginBottom:10, fontSize:11.6, lineHeight:1.65 }}>
            <div style={{ fontWeight:700, color:C.accent, marginBottom:4 }}>🚦 {gate.t}</div>
            {gate.c.map((c,i)=><div key={i}>・{c}</div>)}
            <div style={{ marginTop:4, color:C.red, fontWeight:600 }}>{gate.fail}</div>
          </div>
        )}

        {/* Garmin */}
        {g && (
          <div style={{ background:"rgba(46,139,98,0.07)", border:`1px solid ${C.green}`, borderRadius:10, padding:"9px 11px", marginBottom:10, fontSize:11.3, lineHeight:1.6 }}>
            <div style={{ fontWeight:700, color:C.green, marginBottom:3 }}>⌚ 本週 Garmin 對照</div>
            <div><b>負荷比</b> {g.lr}　<b>HRV</b> {g.hrv}　<b>Status</b> {g.st}</div>
            <div style={{ color:C.muted, marginTop:3 }}>{g.note}</div>
          </div>
        )}

        {isRace ? <RaceWeek P={P}/> : (
          <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", background:C.surface }}>
            {rows.map((r,i)=>{
              const d=dateFor(sel,r.day);
              const today=d.toDateString()===now.toDateString();
              const past=d<now && !today;
              return (
                <div key={r.day} style={{ display:"flex", borderTop:i===0?"none":`1px solid ${C.line}`,
                  opacity:past?0.5:1, background:today?"rgba(31,111,92,0.08)":"transparent" }}>
                  <div style={{ width:46, flexShrink:0, display:"flex", flexDirection:"column", alignItems:"center",
                    justifyContent:"center", padding:"9px 0", borderRight:`1px solid ${C.line}` }}>
                    <span className="osw" style={{ fontSize:14, fontWeight:700, color:today?C.main:C.text }}>{DAY_LABEL[r.day]}</span>
                    <span className="mono" style={{ fontSize:9, color:C.muted }}>{fmtD(d)}</span>
                  </div>
                  <div style={{ flex:1, padding:"9px 11px", minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2, flexWrap:"wrap" }}>
                      <span style={{ color:r.color, display:"inline-flex" }}>{r.icon}</span>
                      <span style={{ fontWeight:700, fontSize:12.5 }}>{r.t}</span>
                      {r.v && <span className="mono" style={{ fontSize:10.5, color:"#fff", background:r.color,
                        borderRadius:5, padding:"1px 6px" }}>{r.v}</span>}
                    </div>
                    <div style={{ fontSize:11.8, lineHeight:1.65 }}>{r.x}</div>
                    {r.extra && (
                      <div style={{ fontSize:11.3, lineHeight:1.6, color:C.iron, marginTop:4, display:"flex", gap:5 }}>
                        <Dumbbell size={12} style={{ flexShrink:0, marginTop:2 }}/><span>{r.extra}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 補給 */}
        {!isRace && (
          <div style={{ background:C.surface2, border:`1px solid ${C.line}`, borderRadius:10, padding:"9px 11px", marginTop:10, fontSize:11.5, lineHeight:1.65 }}>
            <b>🥤 本階段補給：{fuel.gph}</b>　<span style={{ color:C.muted }}>{fuel.why}</span>
            <div style={{ color:C.muted, marginTop:4 }}>
              2024 你跑 3:08 只吃 40-50g/hr。三小時約消耗 500-540g 醣類,庫存 500-600g,你補回約 25% ——
              崩在 35km 的位置和肝醣見底完全吻合。這是全案最便宜的進步:不用多練一步。
            </div>
          </div>
        )}

        {/* W7 決策點 */}
        {sel===7 && (
          <div style={{ background:C.surface, border:`1.5px solid ${C.red}`, borderRadius:12, padding:"12px 14px", marginTop:10 }}>
            <div style={{ display:"flex", gap:6, alignItems:"center", fontWeight:700, fontSize:13, color:C.red, marginBottom:5 }}>
              <AlertTriangle size={15}/> 週五那堂 16km @{pstr(GOAL_PACE)} 是決策點
            </div>
            <div style={{ fontSize:12.2, lineHeight:1.75 }}>
              <b>看心率,不要看感覺。</b> 2024 比賽你平均 150、終點 157,所以 Sub-3 的操作區是 151-157。
              <div style={{ marginTop:6, padding:"8px 10px", background:C.surface2, borderRadius:8 }}>
                <b>門檻已做溫度校正。</b> 本週台中晨溫約 17°C,比賽日 14-16°C ——
                同樣的心率,比賽日還能再快 3-5 秒/km。所以測出來的數字要這樣讀:
                <div style={{ marginTop:5 }}>
                  實測 <b className="mono">4:15-4:18</b>,心率 ≤158 → 比賽日等效 4:12-4:15　<b style={{color:C.green}}>Sub-3 射程內</b><br/>
                  實測 <b className="mono">4:19-4:23</b>,心率 ≤158 → 等效 4:16-4:20　<b>邊緣,看 W9 再決定</b><br/>
                  實測 <b className="mono">4:24 以上</b> 或心率 &gt;160 → 目標改 <b className="mono">3:02-3:05</b>,M配速改 4:18-4:22<br/>
                  跑不完 → 目標改 <b className="mono">3:05-3:08</b>
                </div>
              </div>
              <div style={{ marginTop:6, color:C.muted, fontSize:11.5 }}>
                參考:10/14 你跑 4:29 時心率就到 165(當時 23°C)。改目標不是放棄,是把剩下的 5 週用在拿得到的成績上。
                測驗當天如果氣溫超過 20°C,把實測配速再扣 6-8 秒才是真實力。
              </div>
            </div>
          </div>
        )}

        {/* 睡眠 */}
        {sel<=4 && (
          <div style={{ background:"rgba(43,110,150,0.07)", border:`1px solid ${C.sky}`, borderRadius:10, padding:"10px 12px", marginTop:10, fontSize:11.6, lineHeight:1.7 }}>
            <div style={{ fontWeight:700, color:C.sky, marginBottom:4, display:"flex", gap:5, alignItems:"center" }}>
              <BedDouble size={14}/> 這 12 週最高投報率的事,不在課表裡
            </div>
            9/21-10/18 平均睡 <b className="mono">6:20</b>,身體需求 <b className="mono">8:23</b> —— 56 天只有 1 天達標。
            同期跑量創全年新高、HRV 從 50 掉到 41。訓練不會讓你變強,<b>訓練後的修復才會</b>,
            而生長激素分泌、肌肉蛋白合成、肝醣再合成大多發生在深睡期。
            <div style={{ marginTop:5 }}>
              <b>一小時的睡眠,對 1/10 的成績大概比任何一堂 Q 課都有用。</b>
              最實際的做法是把晨跑從 04:00 往後移到 05:00-05:30,缺口立刻從 2 小時縮到 1 小時。
            </div>
          </div>
        )}

        {/* 體重時間軸 */}
        {sel>=8 && !isRace && (
          <div style={{ background:C.surface2, border:`1px solid ${C.line}`, borderRadius:10, padding:"9px 11px", marginTop:10, fontSize:11.5, lineHeight:1.65 }}>
            <b>⚖️ 賽前體重的時間軸</b>：減 2-3kg 對 64kg 的人約 5-8 秒/km,方向是對的 ——
            <b>但時機不能錯</b>。肌肉與肝臟裝滿肝醣時光水分就佔 1.5-2kg,賽前兩三週掉的體重有很大一部分是它。
            <div style={{ marginTop:4 }}>
              所以:<b>W9 之後體重就不再動</b>,最後一週因為碳水填充反而該增加 1-1.5kg。
              上場比訓練期重一點是正常的,那不是變胖 —— 那是你 35km 之後要燒的東西。
            </div>
          </div>
        )}

        <div style={{ marginTop:14, fontSize:11, color:C.muted, lineHeight:1.7 }}>
          跑量峰值 72km(+每週1-2次 Z2 騎車),自目前 51km 以每週 +4~10% 漸進、每四週減量。
          減量期 72 → 52 → 39 → 比賽週 25,總減幅 46%,落在 Mujika &amp; Padilla (2003) 的 41-60% 最佳區,強度全程維持。
          高強度佔比壓在 33-35%(理想 20-25%,馬拉松專項期可到 35%)—— 低跑量下每堂 Q 課都不能打折,也不能多加。
        </div>
      </div>
    </div>
  );
}

function Nav({dir,disabled,onClick}){
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width:30, height:30, borderRadius:8, border:`1px solid ${C.line}`, background:C.surface,
      color:disabled?C.line:C.text, cursor:disabled?"default":"pointer", display:"flex",
      alignItems:"center", justifyContent:"center", flexShrink:0 }}>
      {dir==="p" ? <ChevronLeft size={16}/> : <ChevronRight size={16}/>}
    </button>
  );
}

function RaceWeek({P}){
  const tasks=[
    ["一","全休。補給與裝備定案,之後不再試新東西"],
    ["二",`熱身2km;4x1000m T ${pstr(P.t)} 休2分;緩和2km — 本週最後一堂有量的課`],
    ["三",`E 35分 @${pstr(P.eLo)}-${pstr(P.eHi)} + 4x100m加速`],
    ["四",`熱身1km;3km @${pstr(GOAL_PACE)};緩和1km — 配速記憶,距賽3天;開始增加碳水`],
    ["五","E 20分 輕鬆;領物;早睡"],
    ["六","E 15分+3x60m加速;裝備確認;確認氣象;早睡"],
  ];
  const splits=[["10km","42:32","前段最常見的錯誤是快20秒。那20秒的代價在35km之後才收"],
                ["21.1km","1:29:45","2024你這裡是1:33:58。感覺「還行」才對,不該覺得輕鬆"],
                ["30km","2:07:37","真正的比賽從這裡開始"],
                ["35km","2:28:54","2024崩在這裡。補給有沒有做對,這段會告訴你"],
                ["42.195km","2:59:30","最後2km如果還有東西,就全部倒出來"]];
  return (
    <div>
      <div style={{ border:`1px solid ${C.line}`, borderRadius:12, overflow:"hidden", marginBottom:10, background:C.surface }}>
        {tasks.map(([d,t],i)=>(
          <div key={i} style={{ display:"flex", borderTop:i===0?"none":`1px solid ${C.line}` }}>
            <div style={{ width:46, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center",
              padding:"8px 0", borderRight:`1px solid ${C.line}` }}>
              <span className="osw" style={{ fontSize:14, fontWeight:700 }}>{d}</span>
            </div>
            <div style={{ flex:1, padding:"8px 11px", fontSize:12, lineHeight:1.55 }}>{t}</div>
          </div>
        ))}
      </div>
      <div style={{ border:`1.5px solid ${C.gold}`, borderRadius:12, padding:"13px 15px", background:"rgba(154,123,22,0.08)" }}>
        <div style={{ fontWeight:700, fontSize:14.5, marginBottom:8, display:"flex", gap:6, alignItems:"center" }}>
          <Flag size={16} color={C.gold}/>日 2027/01/10 — 渣打馬拉松
        </div>
        <div style={{ fontSize:12.5, lineHeight:1.7 }}>
          <div style={{ marginBottom:6 }}>
            配速 <b className="mono" style={{ fontSize:15, color:C.red }}>{pstr(GOAL_PACE)}/km</b> ·
            心率 <b className="mono">{HR_M[0]}-{HR_M[1]}</b> ·
            完賽 <b className="mono">2:59:30</b>(留30秒緩衝)
          </div>
          {splits.map(([k,t,n])=>(
            <div key={k} style={{ display:"flex", gap:9, padding:"4px 0", borderTop:"1px solid rgba(154,123,22,0.25)" }}>
              <span className="mono" style={{ fontWeight:700, minWidth:62 }}>{k}</span>
              <span className="mono" style={{ fontWeight:700, minWidth:56, color:C.red }}>{t}</span>
              <span style={{ fontSize:11.5, color:C.muted, flex:1 }}>{n}</span>
            </div>
          ))}
        </div>
        <div style={{ fontSize:11.5, color:C.muted, marginTop:8, lineHeight:1.65 }}>
          補給 <b>70-80g/hr</b>(2024 是 40-50)：每 40 分一包膠 + 每小時 500ml 運動飲料,第一包在 40 分而不是渴了才吃。
          整場均速跑,不要跟配速列車起伏 —— 你 2024 的分段是教科書級的,照那個方式跑就好,只是這次油箱要裝滿。
        </div>
      </div>
    </div>
  );
}
