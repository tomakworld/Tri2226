import React, { useEffect, useMemo, useState } from "react";
import { Waves, Bike as BikeIcon, Footprints, Dumbbell, Moon, Settings2, ChevronLeft, ChevronRight, Flag, Sun, ChevronDown, Link2 } from "lucide-react";

/* ============ Ironman Advanced V5 · 113/226 進階選手個人化 ============ */
const C={
  bg:"#F7F5F0",surface:"#FFFFFF",surface2:"#EFECE3",line:"#DDD7C9",
  water:"#0E8C9C",power:"#C07A14",red:"#C6452F",green:"#2E8B62",gold:"#A87F00",iron:"#6B5AA8",text:"#22303A",muted:"#8A8F8C"
};
const PHASES={
  base:{label:"基礎期",color:C.water,note:"有氧量能＋技術；單車先建立可重複輸出"},
  build1:{label:"強化期一",color:C.power,note:"FTP/TTE＋跑步閾值"},
  build2:{label:"強化期二",color:C.power,note:"FTP/TTE轉專項耐久；長課逼近比賽需求"},
  peak:{label:"巔峰期",color:C.red,note:"維持天花板，把能力轉成Race Power durability"},
  taper:{label:"減量期",color:C.green,note:"降量保強度"},
  race:{label:"比賽週",color:C.gold,note:"執行已驗證的節奏與補給"},
};
const DAY_OFFSET={mon:0,tue:1,wed:2,thu:3,fri:4,sat:5,sun:6};
const DAY_LABEL={mon:"一",tue:"二",wed:"三",thu:"四",fri:"五",sat:"六",sun:"日"};
const DISTS={
  "226":{sw:3.8,bk:180,rn:42.2,k:1,imOff:[35,55]},
  "113":{sw:1.9,bk:90,rn:21.1,k:0.72,imOff:[15,30]},
};
function clamp(v,lo,hi){return Math.max(lo,Math.min(hi,v));}
function round5(v){return Math.round(v/5)*5;}
function round50(v){return Math.round(v/50)*50;}
function mondayOfThisWeek(){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()-((d.getDay()+6)%7));return d;}
function isoOfMonday(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
function fmtDate(d){return `${d.getMonth()+1}/${d.getDate()}`;}
function parseMS(s){const m=/^(\d+):(\d{1,2})$/.exec((s||"").trim());return m?(+m[1])*60+(+m[2]):null;}
function parseHMM(s){const m=/^(\d+):(\d{1,2})$/.exec((s||"").trim());return m?(+m[1])*3600+(+m[2])*60:null;}
function paceStr(sec){if(!Number.isFinite(sec))return "--";const m=Math.floor(sec/60),r=Math.round(sec%60);return `${m}:${String(r).padStart(2,"0")}`;}
function fmtHM(sec){if(!Number.isFinite(sec))return "--";const h=Math.floor(sec/3600),m=Math.round((sec%3600)/60);return `${h}:${String(m).padStart(2,"0")}`;}
function tssCalc(segs){return Math.round(segs.reduce((a,[m,i])=>a+m*i*i,0)/60*100);}
function trainerLong(mins){return `室內${round5(mins*0.85)}分／戶外${mins}分`;}
function encodeProfile(p){try{return btoa(encodeURIComponent(JSON.stringify(p))).replace(/=+$/g,"");}catch(e){return "";}}
function decodeProfile(s){try{return JSON.parse(decodeURIComponent(atob(s)));}catch(e){return null;}}
function climateNote(m){return m>=6&&m<=9?"高溫期：清晨/室內＋積極散熱":(m===5||m===10?"過渡季：長課盡量清晨":"涼爽季：品質課可貼近目標");}

/* ---------- persistence ---------- */
const PROFILE_KEY="athlete:profile:advanced:v5";
async function loadSavedProfile(){
  try{const q=new URLSearchParams(window.location.search).get("d");const p=q?decodeProfile(q):null;if(p)return p;}catch(e){}
  try{if(window.storage){for(const k of [PROFILE_KEY,"athlete:profile:v4","athlete:profile"]){const r=await window.storage.get(k,false);if(r?.value)return JSON.parse(r.value);}}}catch(e){}
  try{for(const k of [PROFILE_KEY,"athlete:profile:v4","athlete:profile"]){const r=localStorage.getItem(k);if(r)return JSON.parse(r);}}catch(e){}
  return null;
}
async function persistProfile(p){
  const raw=JSON.stringify(p);
  try{if(window.storage)await window.storage.set(PROFILE_KEY,raw,false);}catch(e){}
  try{localStorage.setItem(PROFILE_KEY,raw);}catch(e){}
  try{const e=encodeProfile(p);if(e)window.history.replaceState(null,"",`${window.location.pathname}?d=${e}${window.location.hash}`);}catch(e){}
}

/* ---------- intensity ---------- */
function runPaces(hmStr,dist){
  const t=parseHMM(hmStr);if(!t)return null;
  const hp=t/21.0975,mp=hp*1.055,off=dist.imOff;
  return {easy:[mp*1.15,mp*1.28],long:[mp*1.08,mp*1.18],mp,thr:hp,itv:[hp*0.93,hp*0.96],im:[mp+off[0],mp+off[1]]};
}
function renderBike(text,ftp){
  return text.replace(/\{P:([\d.]+)-([\d.]+)\}/g,(_,a,b)=>`${Math.round(ftp*(+a))}-${Math.round(ftp*(+b))}W(${Math.round(+a*100)}-${Math.round(+b*100)}%FTP)`);
}
const SWIM_OFFSET={EN1:25,EN2:12,THR:0,VO2:-6};
function renderSwim(text,tp){return text.replace(/\{(EN1|EN2|THR|VO2)\}/g,(_,k)=>tp?`${k} ${paceStr(tp+SWIM_OFFSET[k])}/100m`:k);}

/* ---------- advanced athlete model: 少量、直接、可解釋 ---------- */
function bikeRunModel(profile,dist){
  const ftp=Math.max(1,+profile.ftp||1),kg=Math.max(1,+profile.weight||1),wkg=ftp/kg;
  const hm=parseHMM(profile.hm),hmPace=hm?hm/21.0975:null;
  const bikeH=Math.max(0,+profile.curBikeHours||0),runKm=Math.max(0,+profile.curRunKm||0);
  const longBike=Math.max(0,+profile.longBikeKm||0),longRun=Math.max(0,+profile.longRunKm||0);
  const bikeWeeklyRef=dist.id==="226"?6:4.5,runWeeklyRef=dist.id==="226"?45:35;
  const bikeLongRef=dist.id==="226"?140:75,runLongRef=dist.id==="226"?28:18;
  const bikeDur=clamp((bikeH/bikeWeeklyRef)*0.55+(longBike/bikeLongRef)*0.45,0,1.15);
  const runDur=clamp((runKm/runWeeklyRef)*0.55+(longRun/runLongRef)*0.45,0,1.15);
  const bikeAbility=clamp((wkg-2.4)/2.0,0,1);
  const runAbility=hmPace?clamp((330-hmPace)/95,0,1):0.5;
  const bikeScore=bikeAbility*0.60+clamp(bikeDur,0,1)*0.40;
  const runScore=runAbility*0.60+clamp(runDur,0,1)*0.40;
  const delta=bikeScore-runScore;
  let bikeFactor=1,runFactor=1,label="騎跑均衡";
  if(delta>=0.18){bikeFactor=0.97;runFactor=1.06;label="單車相對強・跑步耐久優先";}
  else if(delta<=-0.18){bikeFactor=1.06;runFactor=0.97;label="跑步相對強・單車優先";}
  else if(delta>=0.08){bikeFactor=0.99;runFactor=1.03;label="單車略強";}
  else if(delta<=-0.08){bikeFactor=1.03;runFactor=0.99;label="跑步略強";}
  return {wkg,hmPace,bikeH,runKm,longBike,longRun,bikeDur,runDur,bikeAbility,runAbility,bikeScore,runScore,delta,bikeFactor,runFactor,label};
}
function raceIFFor(dist,br){
  if(dist.id==="226"){
    let c=0.685+0.025*clamp(br.bikeDur,0,1)+0.010*clamp(br.runDur,0,1);
    if(br.runDur<0.65)c-=0.008;
    c=clamp(c,0.69,0.725);return [clamp(c-0.015,0.675,0.72),clamp(c+0.015,0.70,0.74)];
  }
  let c=0.765+0.035*clamp(br.bikeDur,0,1)+0.015*clamp(br.runDur,0,1);
  if(br.runDur<0.65)c-=0.008;
  c=clamp(c,0.785,0.815);return [clamp(c-0.02,0.76,0.81),clamp(c+0.02,0.79,0.835)];
}
function athleteModel(profile,dist){
  const br=bikeRunModel(profile,dist);
  const readiness=(clamp(br.bikeDur,0,1)+clamp(br.runDur,0,1))/2;
  const volumeFactor=clamp(0.82+(readiness-0.65)*0.35,0.78,1.12);
  const raceIF=raceIFFor(dist,br);
  const hrs=Math.max(0,+profile.weekHours||0);
  return {...br,volumeFactor,raceIF,hrs};
}

/* ---------- strength: 預設已有訓練基礎 ---------- */
const STRENGTH={
  base:{t:"肌力基礎",x:"主項3x6-8：深蹲/六角槓、單腿蹲或單腳RDL、提踵＋抗旋轉核心；保留2下餘裕",mins:40},
  build1:{t:"最大肌力",x:"主項3-4x4-6，單腿動作3x5-6/腿；組間2-3分，不做到力竭",mins:45},
  build2:{t:"最大肌力＋低量爆發",x:"主項3x4-5＋低量跳箱/藥球2x4-5；維持神經輸出，不追疲勞",mins:40},
  peak:{t:"肌力維持",x:"主項2x3-5(約80-85%1RM)＋低量神經刺激；關鍵長騎週可取消下肢",mins:25},
  taper:{t:"神經活化",x:"10-15分鐘：動態啟動＋極低量快速動作",mins:12},
};

function bikeObj(t,x,mins,tss){return {t,x,v:`${mins}分`,mins,tss};}
function swimObj(t,x,m){return {t,x,v:`${m}m`,meters:m};}
function runObj(t,x,v,mins){return {t,x,v,mins};}

/* ---------- swim + bike ---------- */
function genSwimBike(phase,wiRaw,rec,dist,A){
  const wi=Math.min(wiRaw,6),f=(rec?0.72:1)*dist.k*A.volumeFactor,bf=A.bikeFactor;
  const rif=A.raceIF,rifText=`${Math.round(rif[0]*100)}-${Math.round(rif[1]*100)}%FTP`;
  const rp=(lo=rif[0],hi=rif[1])=>`{P:${lo.toFixed(3)}-${hi.toFixed(3)}}`;
  if(phase==="base"){
    const s1=Math.max(1500,round50((2200+(wi-1)*180)*f)),s2=Math.max(1400,round50((1900+(wi-1)*160)*f)),s3=Math.max(1800,round50((2600+(wi-1)*220)*f));
    const bw=Math.max(60,round5((80+(wi-1)*5)*f*bf)),bs=Math.max(135,round5((190+(wi-1)*20)*f*bf));
    return {swim:{
      tue:swimObj("技術＋EN2",`熱身400m；技術8x50m；主課以{EN2}完成，動作品質優先；緩和200m`,s1),
      fri:swimObj("閾值",`熱身400m；100-300m分段累積門檻量，{THR}；緩和200m`,s2),
      sun:swimObj("長泳耐力",`連續有氧{EN1}；後段維持划水效率`,s3)},bike:{
      wed:bikeObj("Z2＋Tempo",`${bw}分 {P:0.62-0.72}，末15分{P:0.78-0.83}`,bw,tssCalc([[bw-15,0.66],[15,0.81]])),
      thu:bikeObj("閾值建立",`熱身15分；4x${10+Math.min(wi,3)*2}分 {P:0.88-0.92}，組休4分；緩和10分`,65+Math.min(wi,3)*8,tssCalc([[45,0.9],[30,0.6]])),
      sat:bikeObj("長騎有氧",`全程{P:0.64-0.70}，${trainerLong(bs)}；最後20分可至{P:0.72-0.78}；練空力姿勢與補給`,bs,tssCalc([[bs,0.67]]))}};
  }
  if(phase==="build1"){
    const vo2=!rec&&wi===2;
    const s1=Math.max(1700,round50((2500+(wi-1)*180)*f)),s2=Math.max(1600,round50((2200+(wi-1)*180)*f)),s3=Math.max(2200,round50((3200+(wi-1)*200)*f));
    const bw=Math.max(70,round5((90+(wi-1)*5)*f*bf)),bs=Math.max(165,round5((240+(wi-1)*20)*f*bf));
    return {swim:{tue:swimObj("EN2量能",`技術後累積200m分段{EN2}`,s1),fri:swimObj("長閾值",`200-400m分段累積{THR}`,s2),sun:swimObj("開放水域／長泳",`連續{EN1}，後段加入比賽節奏與定位`,s3)},bike:{
      wed:vo2?bikeObj("VO2max主品質",`熱身20分；4x4分 {P:1.05-1.10}，組休4分；緩和15分`,70,78):bikeObj("Z2＋Sweet Spot",`${bw}分{P:0.62-0.72}，中段2x15分{P:0.90-0.93}`,bw,tssCalc([[bw-30,0.66],[30,0.915]])),
      thu:vo2?bikeObj("VO2隔日恢復",`昨日VO2為本週主品質；今天50-60分{P:0.50-0.65}，不再疊FTP`,55,35):bikeObj("FTP/TTE",`熱身15分；${rec?"2x12":(wi===1?"3x12":wi===2?"3x15":"3x18")} @ {P:0.93-0.95}，組休5分；品質下降就停`,rec?60:(wi===1?72:wi===2?82:90),rec?58:(wi===1?74:84)),
      sat:bikeObj("長距耐力",`{P:0.65-0.71}，${trainerLong(bs)}；最後45分累積30分${rp()}(${rifText})`,bs,tssCalc([[bs-30,0.67],[30,(rif[0]+rif[1])/2]]))}};
  }
  if(phase==="build2"){
    const vo2=!rec&&wi===2;
    const s1=Math.max(1900,round50((2800+(wi-1)*160)*f)),s2=Math.max(1800,round50((2500+(wi-1)*160)*f)),s3=Math.max(2500,round50((3600+(wi-1)*180)*f));
    const bw=Math.max(75,round5((95+(wi-1)*5)*f*bf)),bs=Math.max(195,round5((285+(wi-1)*15)*f*bf));
    return {swim:{tue:swimObj("EN2維持",`技術後累積{EN2}，保持效率`,s1),fri:swimObj("閾值",`長組{THR}，不游爆`,s2),sun:swimObj("長泳專項",`連續{EN1}＋比賽節奏，演練補給/防寒衣`,s3)},bike:{
      wed:vo2?bikeObj("VO2max主品質",`熱身20分；5x3分{P:1.10-1.15}，組休3分；緩和15分`,70,80):bikeObj("Z2＋Sweet Spot",`${bw}分{P:0.62-0.72}，中段2x18分{P:0.90-0.93}`,bw,tssCalc([[bw-36,0.66],[36,0.915]])),
      thu:vo2?bikeObj("VO2隔日恢復",`50-60分{P:0.50-0.65}；不做FTP/TTE，讓VO2品質真正被吸收`,55,35):bikeObj("FTP/TTE高峰",`熱身15分；${rec?"2x12":(wi===1?"2x25":wi===2?"3x18":"3x20")} @ {P:0.93-0.95}；組休6分`,rec?60:(wi===1?88:wi===2?92:98),rec?58:(wi===1?90:96)),
      sat:bikeObj("長距＋Race Power",`{P:0.66-0.72}，${trainerLong(bs)}；最後60分累積40分${rp()}(${rifText})；戶外優先，練補給與空力姿勢`,bs,tssCalc([[bs-40,0.68],[40,(rif[0]+rif[1])/2]]))}};
  }
  if(phase==="peak"){
    if(dist.id==="113"){
      const T=[
        {swim:{tue:swimObj("EN2維持","低疲勞EN2",1500),fri:swimObj("閾值維持","短門檻組",1500),sun:swimObj("長泳配速","1800-2000m含比賽節奏",2000)},bike:{wed:bikeObj("Z2＋短SS","65分Z2，中段2x10分{P:0.88-0.92}",65,55),thu:bikeObj("FTP維持","2x15分{P:0.92-0.95}，不追進步",60,58),sat:bikeObj("Race Power前哨",`150-165分${rp()}(${rifText})；下車20分Brick`,160,155)}},
        {key:true,swim:{tue:swimObj("量能維持","EN2維持",1400),fri:swimObj("閾值維持","低量THR",1400),sun:swimObj("關鍵長泳","2200-2400m比賽節奏",2300)},bike:{wed:bikeObj("恢復迴轉","45分{P:0.50-0.62}",45,25),thu:bikeObj("關鍵週FTP維持","2x10分{P:0.90-0.95}，只維持感覺",50,42),sat:bikeObj("🔑90K關鍵模擬",`戶外165-180分${rp()}(${rifText})；完整補給；下車25-30分Brick`,175,185)}},
        {swim:{tue:swimObj("收量","EN2低量",1200),fri:swimObj("閾值維持","短THR",1200),sun:swimObj("中距收量","輕鬆連續",1700)},bike:{wed:bikeObj("恢復迴轉","40分{P:0.50-0.62}",40,22),thu:bikeObj("FTP維持","3x8分{P:0.90-0.95}",55,50),sat:bikeObj("長騎收斂",`105-120分{P:0.64-0.70}，含20分${rp()}`,115,88)}}
      ];return T[Math.min(wi-1,2)];
    }
    const T=[
      {swim:{tue:swimObj("EN2維持","低疲勞EN2＋技術",2100),fri:swimObj("閾值維持","低量長THR",2200),sun:swimObj("長泳配速","3200-3400m，後段比賽節奏",3300)},bike:{wed:bikeObj("Z2＋Race Power","75分Z2，中段20分Race Power",75,62),thu:bikeObj("FTP維持","2x15分{P:0.92-0.95}；Peak不再追FTP",60,58),sat:bikeObj("Race Power前哨",`戶外270-300分${rp()}(${rifText})；完整補給＋空力姿勢；下車30分Brick`,285,280)}},
      {key:true,swim:{tue:swimObj("量能維持","低疲勞EN2",1900),fri:swimObj("閾值維持","短THR",1900),sun:swimObj("關鍵長泳","3400-3800m比賽節奏，演練裝備與補給",3600)},bike:{wed:bikeObj("恢復迴轉","50分{P:0.50-0.62}",50,28),thu:bikeObj("關鍵週FTP維持","2x10分{P:0.90-0.95}；不得留下疲勞",50,42),sat:bikeObj("🔑關鍵長騎＋Brick",`戶外300-330分${rp()}(${rifText})；以150-170km為正常專項範圍，狀態/路線/補給都完美才選擇做到180km；下車30-40分Brick`,315,315)}},
      {swim:{tue:swimObj("量能收斂","EN2低量",1700),fri:swimObj("閾值維持","短THR",1600),sun:swimObj("中距收量","2300-2600m輕鬆",2450)},bike:{wed:bikeObj("恢復迴轉","45分{P:0.50-0.62}",45,24),thu:bikeObj("FTP維持","3x10分{P:0.90-0.95}",60,55),sat:bikeObj("長騎收斂",`150-180分{P:0.64-0.70}，含30分${rp()}`,165,132)}}
    ];return T[Math.min(wi-1,2)];
  }
  const T=[
    {swim:{tue:swimObj("減量EN2","短EN2",1100),fri:swimObj("減量THR","短THR",1000),sun:swimObj("輕鬆游","1500-1700m輕鬆",1600)},bike:{wed:bikeObj("恢復","30分{P:0.45-0.55}",30,15),thu:bikeObj("神經敏銳","3x5分{P:0.95-1.00}",40,40),sat:bikeObj("減量長騎","75-90分{P:0.62-0.70}",85,58)}},
    {swim:{tue:swimObj("賽前喚醒","短加速",700),fri:swimObj("賽前開合","比賽節奏短組",700),sun:swimObj("熟悉裝備","800-1000m輕鬆",900)},bike:{wed:bikeObj("極輕量","20分{P:0.45-0.55}",20,10),thu:bikeObj("賽前開合","20分輕鬆＋5分{P:0.78-0.85}",25,18),sat:bikeObj("裝備確認","40-45分{P:0.60-0.68}",42,28)}}
  ];return T[Math.min(wi-1,1)];
}

/* ---------- run: 進階選手，HM定強度；量由現有跑量/長跑決定 ---------- */
function genRun(phase,wiRaw,rec,rp,key,dist,A){
  const wi=Math.min(wiRaw,5),rf=A.runFactor,vf=A.volumeFactor;
  const easy=rp?`${paceStr(rp.easy[0])}-${paceStr(rp.easy[1])}/km`:"E",lng=rp?`${paceStr(rp.long[0])}-${paceStr(rp.long[1])}/km`:"長跑E",thr=rp?`${paceStr(rp.thr)}/km`:"T",itv=rp?`${paceStr(rp.itv[0])}-${paceStr(rp.itv[1])}/km`:"I",im=rp?`${paceStr(rp.im[0])}-${paceStr(rp.im[1])}/km`:"三鐵跑配速";
  const cap=dist.id==="226"?32:22,baseLong=Math.max(dist.id==="226"?20:14,A.longRun||0);
  const lk=(inc)=>Math.min(cap,Math.max(dist.id==="226"?18:12,Math.round((baseLong+inc)*vf*rf*(rec?0.78:1))));
  const easyRun=(mins=35)=>runObj("輕鬆跑",`${mins}分 @${easy}，完全對話配速`,`${mins}分`,mins);
  if(phase==="base")return {
    wed:runObj("巡航/速度經濟性",`熱身15分；8-10x400m @${itv}，200m慢跑；緩和10分`,`50-60分`,55),
    thu:easyRun(35),fri:runObj("穩態＋步幅",`40-50分E，末6x20秒步幅；不做第二堂力竭品質`,`45分`,45),
    sat:runObj("Brick",`長騎後20分 @${easy}，只練轉換`,`20分`,20),sun:runObj("長跑",`${lk(wi)}km @${lng}，最後15-20分可進入三鐵跑節奏`,`${lk(wi)}km`,Math.round(lk(wi)*(rp?rp.long[0]:330)/60))};
  if(phase==="build1")return {
    wed:runObj("閾值主品質",`熱身15分；4-5x1km @${thr}，休2分；緩和10分`,`60-70分`,65),
    thu:easyRun(35),fri:runObj("T/穩態",`熱身15分；20-30分 @${thr}；緩和10分。若單車VO2週則改45分E`,`50-60分`,55),
    sat:runObj("Brick",`長騎後20-25分 @${im}下緣，前10分刻意保守`,`25分`,25),sun:runObj("長跑",`${lk(wi+1)}km @${lng}，中段可含2x3km穩態；每40分補給`,`${lk(wi+1)}km`,Math.round(lk(wi+1)*(rp?rp.long[0]:330)/60))};
  if(phase==="build2")return {
    wed:runObj("巡航間歇",`熱身15分；3x2km @${thr}，休90秒；緩和10分`,`65-75分`,70),
    thu:easyRun(35),fri:runObj("三鐵配速",`熱身15分；${dist.id==="226"?8:6}-10km @${im}；緩和10分`,`55-70分`,62),
    sat:runObj("Brick",`長騎後25-30分 @${im}，只求穩定跑姿`,`30分`,30),sun:runObj("長跑",`${lk(wi+2)}km @${lng}，末20-30分 @${im}；演練補給`,`${lk(wi+2)}km`,Math.round(lk(wi+2)*(rp?rp.long[0]:330)/60))};
  if(phase==="peak"){
    if(key)return {wed:runObj("配速維持","2x3km全馬/三鐵穩態，保留餘裕","50分",50),thu:easyRun(30),fri:runObj("輕鬆＋步幅","35-40分E＋4x20秒步幅；不再做第二品質","40分",40),sat:runObj("關鍵Brick",`關鍵長騎後${dist.id==="226"?35:25}分 @${im}下緣`,`${dist.id==="226"?35:25}分`,dist.id==="226"?35:25),sun:runObj("短長跑",`${dist.id==="226"?14:10}km @${easy}，昨日負荷大`,`${dist.id==="226"?14:10}km`,dist.id==="226"?78:55)};
    return {wed:runObj("配速維持","2x3km穩態＋短步幅，保留餘裕","50分",50),thu:easyRun(30),fri:runObj("三鐵配速維持",`5-8km @${im}，不追速度`,`45-55分`,50),sat:runObj("Brick",`長騎後20-30分 @${im}`,`25分`,25),sun:runObj("長跑",`${wi===1?(dist.id==="226"?24:18):(dist.id==="226"?18:14)}km @${lng}`,`${wi===1?(dist.id==="226"?24:18):(dist.id==="226"?18:14)}km`,wi===1?(dist.id==="226"?135:95):(dist.id==="226"?100:75))};
  }
  const last=wi>=2;return {wed:runObj("神經喚醒",`${last?4:6}x200m輕快，完整恢復`,`35-45分`,last?35:45),thu:easyRun(last?20:30),fri:runObj("開合",`${last?3:4}km @${im}，前後輕鬆`,`35-45分`,last?35:45),sat:runObj("短Brick","15-20分很輕鬆＋4x20秒步幅","20分",20),sun:runObj("中短長跑",`${last?(dist.id==="226"?8:6):(dist.id==="226"?12:9)}km E`,`E`,last?45:65)};
}

/* ---------- plan ---------- */
function buildPlan(raceDateStr,dist,startStr,A){
  const race=new Date(raceDateStr+"T00:00:00");if(isNaN(race))return null;
  let start;if(startStr){const d=new Date(startStr+"T00:00:00");if(!isNaN(d)){d.setDate(d.getDate()-((d.getDay()+6)%7));start=d;}}if(!start)start=mondayOfThisWeek();
  const days=Math.round((race-start)/864e5);if(days<21)return {error:"距比賽不足3週，請直接進入減量/維持，不適合再建完整週期。"};
  const n=Math.min(40,Math.floor(days/7)+1),taper=n>=12?2:1,peak=n>=16?3:(n>=12?2:1),train=n-1-taper-peak;
  const base=Math.max(1,Math.round(train*0.38)),build1=Math.max(1,Math.round(train*0.30)),build2=Math.max(0,train-base-build1);
  const weeks=[];let idx=1;const push=(phase,count)=>{for(let wi=1;wi<=count;wi++){const rec=["base","build1","build2"].includes(phase)&&count>=3&&(wi===count||(wi%4===0&&wi!==count));const sb=genSwimBike(phase,wi,rec,dist,A);weeks.push({n:idx++,phase,wi,rest:rec,key:!!sb.key,swim:sb.swim,bike:sb.bike});}};
  push("base",base);push("build1",build1);if(build2>0)push("build2",build2);push("peak",peak);push("taper",taper);weeks.push({n:idx,phase:"race",race:true});return {weeks,n,start};
}

/* ---------- time budget: weekHours只作硬上限，不參與能力判斷 ---------- */
function swimMins(item,tp){const m=item?.meters||0;if(!m)return 0;const p=tp||105;return Math.round((m/100)*(p+12)/60);}
function applyTimeBudget(rows,capHours){
  const cap=+capHours||0;const cloned=rows.map(r=>({...r,items:r.items.map(i=>({...i}))}));
  const items=cloned.flatMap(r=>r.items).filter(i=>!i.rest);
  const original=Math.round(items.reduce((a,i)=>a+(i.estMin||0),0));
  if(cap<=0)return {rows:cloned,original,final:original,changed:false,cap:0};
  const budget=Math.round(cap*60);let total=original;let changed=false;
  const trim=(it,to)=>{to=Math.max(0,Math.round(to));if(to>=it.estMin)return;const old=it.estMin;it.estMin=to;it.vol=`約${to}分·時間上限`;it.detail=`【時間上限】原估${old}分，本週縮至約${to}分。`+it.detail;total-=old-to;changed=true;};
  const drop=(it)=>{if(it.estMin<=0)return;const old=it.estMin;it.estMin=0;it.vol="0分";it.detail=`【時間上限】本堂為次要負荷，優先略過（原估${old}分）。`+it.detail;it.title=`略過·${it.title}`;total-=old;changed=true;};
  // 先縮恢復/次要課到最低有效量
  [...items].sort((a,b)=>(a.priority||3)-(b.priority||3)).forEach(it=>{if(total>budget&&it.minMin!=null&&it.estMin>it.minMin)trim(it,it.minMin);});
  // 再移除低優先且可略過的課
  [...items].filter(i=>i.droppable).sort((a,b)=>(a.priority||3)-(b.priority||3)).forEach(it=>{if(total>budget)drop(it);});
  // 仍超時，再縮中高優先；長騎/長跑/主品質最後才動
  [...items].filter(i=>i.estMin>0).sort((a,b)=>(a.priority||3)-(b.priority||3)).forEach(it=>{if(total>budget){const floor=Math.max(15,it.hardMin||it.minMin||20);trim(it,Math.max(floor,it.estMin-(total-budget)));}});
  // 極端低時數：最後等比例壓縮，確保不超過硬上限
  if(total>budget){const active=items.filter(i=>i.estMin>0),ratio=budget/Math.max(1,total);active.forEach(it=>trim(it,Math.max(5,Math.floor(it.estMin*ratio))));}
  total=Math.round(items.reduce((a,i)=>a+(i.estMin||0),0));
  // 極端低時數仍必須遵守硬上限：從最低優先開始繼續縮/略過。
  if(total>budget){[...items].filter(i=>i.estMin>0).sort((a,b)=>(a.priority||3)-(b.priority||3)).forEach(it=>{if(total>budget){const cut=Math.min(it.estMin,total-budget);trim(it,it.estMin-cut);}});}
  total=Math.round(items.reduce((a,i)=>a+(i.estMin||0),0));
  return {rows:cloned,original,final:total,changed,cap:budget};
}

/* ---------- UI ---------- */
export default function IronmanAdvancedV5(){
  const defaults={dist:"226",raceDate:"2026-11-08",startDate:"",ftp:250,weight:68,tpace:"1:35",hm:"1:32",curBikeHours:6,curRunKm:45,longBikeKm:140,longRunKm:28,weekHours:"",lastSwim:"",lastBike:"",lastRun:"",goal:""};
  const [profile,setProfile]=useState(defaults),[editing,setEditing]=useState(true),[selected,setSelected]=useState(1),[expanded,setExpanded]=useState(null),[copied,setCopied]=useState(false);
  useEffect(()=>{(async()=>{const s=await loadSavedProfile();const p=s?{...defaults,...s}:{...defaults,startDate:isoOfMonday(mondayOfThisWeek())};if(!p.startDate)p.startDate=isoOfMonday(mondayOfThisWeek());setProfile(p);if(s)setEditing(false);await persistProfile(p);})();},[]);
  useEffect(()=>setExpanded(null),[selected]);
  async function saveProfile(p){setProfile(p);await persistProfile(p);}
  const dist={id:profile.dist||"226",...DISTS[profile.dist||"226"]},A=athleteModel(profile,dist),rp=runPaces(profile.hm,dist),tp=parseMS(profile.tpace);
  const plan=useMemo(()=>buildPlan(profile.raceDate,dist,profile.startDate,A),[profile.raceDate,profile.dist,profile.startDate,profile.ftp,profile.weight,profile.hm,profile.curBikeHours,profile.curRunKm,profile.longBikeKm,profile.longRunKm]);
  useEffect(()=>{if(!plan||plan.error)return;const cur=Math.floor((mondayOfThisWeek()-plan.start)/(7*864e5))+1;if(cur>=1&&cur<=plan.n)setSelected(cur);},[plan?.start?.getTime?.(),plan?.n]);
  if(!plan||plan.error)return <ShellBase profile={profile} editing={editing} setEditing={setEditing} saveProfile={saveProfile} copied={copied} setCopied={setCopied}><div style={{padding:18,color:C.red}}>{plan?.error||"請輸入有效比賽日期"}</div></ShellBase>;
  const {weeks,n:N,start}=plan,sel=Math.min(selected,N),week=weeks.find(w=>w.n===sel),phase=PHASES[week.phase];
  const dateFor=(wn,d)=>{const x=new Date(start);x.setDate(x.getDate()+(wn-1)*7+DAY_OFFSET[d]);return x;};
  const now=new Date(),run=week.race?null:genRun(week.phase,week.wi,week.rest,rp,week.key,dist,A),month=dateFor(week.n,"mon").getMonth()+1;
  const mkRun=(d)=>({id:`${d}-r`,color:C.red,icon:<Footprints size={13}/>,title:`跑·${run[d].t}`,vol:run[d].v,detail:run[d].x,estMin:run[d].mins,priority:d==="sun"||d==="wed"?5:(d==="sat"?4:(d==="fri"?3:2)),minMin:d==="thu"?20:(d==="fri"?30:(d==="sat"?15:run[d].mins)),hardMin:d==="sun"?45:(d==="wed"?35:15),droppable:d==="thu"||d==="fri"});
  const mkBike=(d)=>{const b=week.bike[d],main=(b.t.includes("VO2")||b.t.includes("FTP")||b.t.includes("TTE"));return {id:`${d}-b`,color:C.power,icon:<BikeIcon size={13}/>,title:`騎·${b.t}`,vol:`${b.v}·TSS${b.tss}`,detail:renderBike(b.x,profile.ftp),estMin:b.mins,priority:d==="sat"?5:(main?5:2),minMin:d==="sat"?Math.max(75,Math.round(b.mins*0.75)):30,hardMin:d==="sat"?60:25,droppable:d!=="sat"&&!main};};
  const mkSwim=(d)=>{const s=week.swim[d],m=swimMins(s,tp);return {id:`${d}-s`,color:C.water,icon:<Waves size={13}/>,title:`游·${s.t}`,vol:s.v,detail:renderSwim(s.x,tp),estMin:m,priority:d==="sun"?4:3,minMin:Math.max(20,Math.round(m*0.65)),hardMin:20,droppable:d==="fri"};};
  const str=STRENGTH[week.phase]||STRENGTH.taper;
  const baseRows=week.race?[]:[
    {day:"mon",items:[{rest:true}]},
    {day:"tue",items:[{id:"tue-str",color:C.iron,icon:<Dumbbell size={13}/>,title:`重訓·${str.t}`,detail:str.x,vol:`${str.mins}分`,estMin:str.mins,priority:3,minMin:15,hardMin:10,droppable:week.phase==="peak"||week.phase==="taper"},mkSwim("tue")]},
    {day:"wed",items:[mkRun("wed"),mkBike("wed")]},
    {day:"thu",items:[mkRun("thu"),mkBike("thu")]},
    {day:"fri",items:[mkRun("fri"),mkSwim("fri")]},
    {day:"sat",items:[mkBike("sat"),mkRun("sat")]},
    {day:"sun",items:[mkRun("sun"),mkSwim("sun")]},
  ];
  const budget=week.race?{rows:[],original:0,final:0,changed:false,cap:0}:applyTimeBudget(baseRows,profile.weekHours),rows=budget.rows;
  return <ShellBase profile={profile} editing={editing} setEditing={setEditing} saveProfile={saveProfile} copied={copied} setCopied={setCopied} A={A} rp={rp} raceInfo={`${profile.raceDate} · ${N}週 · 倒數 ${N-sel>0?`${N-sel}週`:"本週"}`}>
    <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}><Nav dir="p" disabled={sel===1} onClick={()=>setSelected(v=>Math.max(1,v-1))}/><div className="strip" style={{display:"flex",gap:5,overflowX:"auto",padding:"3px 2px",flex:1}}>{weeks.map(w=><button key={w.n} onClick={()=>setSelected(w.n)} className="osw" style={{flexShrink:0,minWidth:42,borderRadius:8,padding:"4px 3px",cursor:"pointer",background:w.n===sel?PHASES[w.phase].color:C.surface,color:w.n===sel?"#fff":C.text,border:`1px solid ${w.n===sel?PHASES[w.phase].color:C.line}`}}><div style={{fontSize:11,fontWeight:700}}>{w.race?"🏁":`W${w.n}`}</div><div className="mono" style={{fontSize:8.5}}>{fmtDate(dateFor(w.n,"mon"))}</div></button>)}</div><Nav dir="n" disabled={sel===N} onClick={()=>setSelected(v=>Math.min(N,v+1))}/></div>
    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10,flexWrap:"wrap",fontSize:11.5}}><span className="osw" style={{fontWeight:700,color:phase.color}}>{phase.label}{week.rest?"·減量":""}{week.key?"·🔑":""}</span><span style={{color:C.muted}}>{phase.note}</span><span style={{color:C.muted}}>|</span><span style={{color:C.muted,display:"flex",gap:4,alignItems:"center"}}><Sun size={11}/>{climateNote(month)}</span>{!week.race&&<span className="mono" style={{marginLeft:"auto",color:budget.changed?C.red:C.power}}>估算 {Math.round(budget.final/6)/10}h{budget.cap?` / 上限 ${profile.weekHours}h`:""}</span>}</div>
    {budget.changed&&<div style={{background:"rgba(198,69,47,.07)",border:`1px solid ${C.red}`,borderRadius:8,padding:"7px 9px",fontSize:11,color:C.red,marginBottom:8}}>時間上限已啟動：原始估算 {Math.round(budget.original/6)/10}h → 調整後 {Math.round(budget.final/6)/10}h。優先保留長騎、長跑與主品質課。</div>}
    {week.race?<RaceWeek profile={profile} A={A} rp={rp} dist={dist} raceDate={new Date(profile.raceDate+"T00:00:00")}/>:<div style={{border:`1px solid ${C.line}`,borderRadius:12,overflow:"hidden",background:C.surface}}>{rows.map((row,ri)=>{const d=dateFor(week.n,row.day),past=d<now&&d.toDateString()!==now.toDateString(),today=d.toDateString()===now.toDateString();return <div key={row.day} style={{display:"flex",borderTop:ri?`1px solid ${C.line}`:"none",opacity:past?.55:1,background:today?"rgba(14,140,156,.07)":"transparent"}}><div style={{width:44,flexShrink:0,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",borderRight:`1px solid ${C.line}`}}><b className="osw">{DAY_LABEL[row.day]}</b><span className="mono" style={{fontSize:9,color:C.muted}}>{fmtDate(d)}</span></div><div style={{flex:1,padding:"6px 8px"}}>{row.items.map((it,i)=>{if(it.rest)return <div key={i} style={{fontSize:12,color:C.muted,padding:4}}><Moon size={12} style={{verticalAlign:"middle"}}/> 全休</div>;const open=expanded===it.id;return <div key={it.id}><button className="rowbtn" onClick={()=>setExpanded(open?null:it.id)} style={{display:"flex",alignItems:"center",gap:6,width:"100%",background:"transparent",border:"none",padding:"4px 2px",cursor:"pointer",color:C.text,textAlign:"left"}}><span style={{color:it.color,display:"flex"}}>{it.icon}</span><b style={{fontSize:12.5}}>{it.title}</b><span className="mono" style={{fontSize:10.5,color:it.color,marginLeft:"auto"}}>{it.vol}</span><ChevronDown size={13} style={{transform:open?"rotate(180deg)":"none"}}/></button>{open&&<div style={{fontSize:12,lineHeight:1.6,padding:"2px 4px 7px 21px",borderLeft:`2px solid ${it.color}`,marginLeft:5}}>{it.detail}</div>}</div>})}</div></div>})}</div>}
  </ShellBase>;
}

function ShellBase({profile,editing,setEditing,saveProfile,copied,setCopied,A,rp,raceInfo,children}){
  const dist={id:profile.dist||"226",...DISTS[profile.dist||"226"]};
  return <div style={{minHeight:"100vh",background:C.bg,color:C.text,fontFamily:"Inter,sans-serif"}}><style>{`@import url('https://fonts.googleapis.com/css2?family=Oswald:wght@500;600;700&family=Inter:wght@400;500;600&family=Roboto+Mono:wght@500;600&display=swap');.osw{font-family:'Oswald',sans-serif}.mono{font-family:'Roboto Mono',monospace}input,select{background:#fff;border:1px solid ${C.line};color:${C.text};border-radius:8px;padding:8px 10px;font-family:'Roboto Mono',monospace;font-size:14px;width:100%;box-sizing:border-box}.rowbtn:hover{background:${C.surface2}}`}</style><div style={{maxWidth:780,margin:"0 auto",padding:"20px 16px 50px"}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}><div><h1 className="osw" style={{fontSize:21,margin:0}}>Ironman Advanced V5 · 113/226</h1><div style={{fontSize:11,color:C.muted}}>{raceInfo||"給已有訓練基礎的三鐵選手：少量輸入、直接處方"}</div></div><button onClick={()=>setEditing(v=>!v)} style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:9,padding:"7px 10px",cursor:"pointer"}}><Settings2 size={14}/> 我的數據</button></div>
    {editing&&<div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,padding:14,marginBottom:12}}>
      <div style={{fontSize:10.5,color:C.water,fontWeight:700,marginBottom:6}}>① 核心能力（決定強度）</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="賽事距離"><select value={profile.dist} onChange={e=>saveProfile({...profile,dist:e.target.value})}><option value="113">113</option><option value="226">226</option></select></Field>
        <Field label="比賽日期"><input type="date" value={profile.raceDate} onChange={e=>saveProfile({...profile,raceDate:e.target.value})}/></Field>
        <Field label="計畫起始日"><input type="date" value={profile.startDate||""} onChange={e=>saveProfile({...profile,startDate:e.target.value})}/></Field>
        <Field label="FTP W"><input type="number" value={profile.ftp} onChange={e=>saveProfile({...profile,ftp:+e.target.value})}/></Field>
        <Field label="體重 kg"><input type="number" value={profile.weight} onChange={e=>saveProfile({...profile,weight:+e.target.value})}/></Field>
        <Field label="游泳 T-pace mm:ss"><input value={profile.tpace} onChange={e=>saveProfile({...profile,tpace:e.target.value})}/></Field>
        <Field label="半馬 PB h:mm"><input value={profile.hm} onChange={e=>saveProfile({...profile,hm:e.target.value})}/></Field>
      </div>
      <div style={{fontSize:10.5,color:C.power,fontWeight:700,margin:"14px 0 6px"}}>② 目前負荷（決定量與耐久）</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="目前 Bike 小時/週"><input type="number" step="0.5" value={profile.curBikeHours} onChange={e=>saveProfile({...profile,curBikeHours:+e.target.value})}/></Field>
        <Field label="目前 Run km/週"><input type="number" value={profile.curRunKm} onChange={e=>saveProfile({...profile,curRunKm:+e.target.value})}/></Field>
        <Field label="最長 Bike km"><input type="number" value={profile.longBikeKm} onChange={e=>saveProfile({...profile,longBikeKm:+e.target.value})}/></Field>
        <Field label="最長 Run km"><input type="number" value={profile.longRunKm} onChange={e=>saveProfile({...profile,longRunKm:+e.target.value})}/></Field>
        <Field label="每週可訓練總時數（選填·硬上限）"><input type="number" step="0.5" placeholder="不填＝不限制" value={profile.weekHours||""} onChange={e=>saveProfile({...profile,weekHours:e.target.value===""?"":+e.target.value})}/></Field>
      </div><div style={{fontSize:10.5,color:C.muted,marginTop:5}}>時數只作硬上限，不會被拿來判斷能力或把品質課變快。</div>
      <div style={{fontSize:10.5,color:C.gold,fontWeight:700,margin:"14px 0 6px"}}>③ Race planning（全部選填，完全不影響訓練處方）</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <Field label="上次游 h:mm"><input value={profile.lastSwim||""} onChange={e=>saveProfile({...profile,lastSwim:e.target.value})}/></Field><Field label="上次騎 h:mm"><input value={profile.lastBike||""} onChange={e=>saveProfile({...profile,lastBike:e.target.value})}/></Field><Field label="上次跑 h:mm"><input value={profile.lastRun||""} onChange={e=>saveProfile({...profile,lastRun:e.target.value})}/></Field><Field label="目標完賽 h:mm"><input value={profile.goal||""} onChange={e=>saveProfile({...profile,goal:e.target.value})}/></Field>
      </div><div style={{marginTop:12}}><button onClick={()=>{const u=`${window.location.origin}${window.location.pathname}?d=${encodeProfile(profile)}${window.location.hash}`;navigator.clipboard?.writeText(u).then(()=>setCopied(true));setTimeout(()=>setCopied(false),2000);}} style={{background:C.water,color:"#fff",border:0,borderRadius:8,padding:"8px 12px",cursor:"pointer"}}><Link2 size={14}/> 備份專屬連結</button>{copied&&<span style={{fontSize:11,color:C.green,marginLeft:8}}>✓ 已複製</span>}</div>
    </div>}
    {A&&<AthleteSummary A={A} profile={profile}/>} {rp&&<div className="mono" style={{display:"flex",gap:6,flexWrap:"wrap",fontSize:10.5,marginBottom:10}}><Chip t={`E ${paceStr(rp.easy[0])}-${paceStr(rp.easy[1])}`}/><Chip t={`T ${paceStr(rp.thr)}`}/><Chip t={`三鐵跑 ${paceStr(rp.im[0])}-${paceStr(rp.im[1])}`}/></div>}
    {A&&<RacePlanning profile={profile} dist={dist} A={A}/>} {children}
  </div></div>;
}
function AthleteSummary({A,profile}){return <div style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:12,padding:"9px 11px",marginBottom:10,fontSize:11.5,lineHeight:1.55}}><b style={{color:C.power}}>Advanced Profile</b> · <span className="mono">FTP {profile.ftp}W / {A.wkg.toFixed(2)}Wkg</span><div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:5}}><span style={{border:`1px solid ${C.water}`,borderRadius:6,padding:"2px 6px",color:C.water}}>游泳：T-pace定強度，不做強弱排名</span><span style={{border:`1px solid ${C.power}`,borderRadius:6,padding:"2px 6px",color:C.power}}>Bike：{A.label} · 量×{A.bikeFactor.toFixed(2)}</span><span style={{border:`1px solid ${C.red}`,borderRadius:6,padding:"2px 6px",color:C.red}}>Run：HM {A.hmPace?paceStr(A.hmPace):"--"}/km · 量×{A.runFactor.toFixed(2)}</span><span style={{border:`1px solid ${C.gold}`,borderRadius:6,padding:"2px 6px",color:C.gold}}>Race IF {Math.round(A.raceIF[0]*100)}-{Math.round(A.raceIF[1]*100)}%</span></div><div style={{color:C.muted,marginTop:4}}>能力由FTP/Wkg與HM定錨；Bike/Run週量與最長課只調整耐久與訓練量。Goal time不參與強度計算。</div></div>}
function RacePlanning({profile,dist,A}){const g=parseHMM(profile.goal);if(!g)return null;let s=parseHMM(profile.lastSwim),b=parseHMM(profile.lastBike),r=parseHMM(profile.lastRun),src="上次比賽";if(!(s&&b&&r)){const tp=parseMS(profile.tpace),hm=parseHMM(profile.hm),ftp=+profile.ftp;if(!(tp&&hm&&ftp))return null;const mid=(A.raceIF[0]+A.raceIF[1])/2;s=tp*1.08*(dist.sw*10);const v=Math.pow((ftp*mid)/0.0061,1/3);b=dist.bk/v*3600;r=dist.id==="113"?hm+15*60:hm*2.085+40*60;src="能力粗估";}const ref=s+b+r+12*60,diff=Math.round((g-ref)/60);return <div style={{background:"rgba(168,127,0,.06)",border:`1px solid ${C.gold}`,borderRadius:10,padding:"8px 10px",marginBottom:10,fontSize:11.5}}><b>Race planning</b>（不影響訓練）· {src}：游{fmtHM(s)} / 騎{fmtHM(b)} / 跑{fmtHM(r)} / +轉換12分 ≈ {fmtHM(ref)}；目標 {fmtHM(g)}（差 {diff>=0?"+":""}{diff}分）</div>}
function RaceWeek({profile,A,rp,dist,raceDate}){return <div style={{border:`1.5px solid ${C.gold}`,borderRadius:12,padding:"12px 14px",background:"rgba(168,127,0,.07)"}}><div style={{fontWeight:700,display:"flex",gap:6,alignItems:"center"}}><Flag size={15}/> {fmtDate(raceDate)} · {dist.id} Race</div><div style={{fontSize:12.5,lineHeight:1.7,marginTop:6}}><div><b style={{color:C.water}}>Swim {dist.sw}k</b>：前段保守，善用跟游與定位</div><div><b style={{color:C.power}}>Bike {dist.bk}k</b>：{Math.round(A.raceIF[0]*100)}-{Math.round(A.raceIF[1]*100)}%FTP（{Math.round(profile.ftp*A.raceIF[0])}-{Math.round(profile.ftp*A.raceIF[1])}W），用已驗證補給</div><div><b style={{color:C.red}}>Run {dist.rn}k</b>：{rp?`${paceStr(rp.im[0])}-${paceStr(rp.im[1])}/km`:"保守起跑"}，前段刻意壓住</div></div></div>}
function Field({label,children}){return <label><div style={{fontSize:10.5,color:C.muted,marginBottom:3}}>{label}</div>{children}</label>}
function Chip({t}){return <span style={{background:C.surface,border:`1px solid ${C.line}`,borderRadius:6,padding:"2px 7px"}}>{t}</span>}
function Nav({dir,onClick,disabled}){return <button onClick={onClick} disabled={disabled} style={{width:28,height:28,borderRadius:"50%",background:C.surface,border:`1px solid ${C.line}`,cursor:disabled?"not-allowed":"pointer",opacity:disabled?.4:1}}>{dir==="p"?<ChevronLeft size={15}/>:<ChevronRight size={15}/>}</button>}
