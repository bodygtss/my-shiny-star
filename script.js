/* ---------- LYRICS (placeholder) ---------- */
const LYRICS = [
  {time: 38, text: "Where have you been?"},
  {time: 41, text: "Do you know if you're coming back?"},
  {time: 46, text: "We were too close to the stars"},
  {time: 50, text: "I never knew somebody like you, somebody"},
  {time: 56, text: "Falling just as hard"},
  {time: 59, text: "I'd rather lose somebody than use somebody"},
  {time: 65, text: "Maybe it's a blessing in disguise"},
  {time: 72, text: "I see myself in you"},
  {time: 75, text: "I see my reflection in your eyes"},
];
(function () {
  const toSec = v => typeof v === 'number' ? v : String(v).split(':').reduce((a,b)=>a*60+(parseFloat(b)||0),0);
  LYRICS.forEach(l => { l.time = toSec(l.time); l.text = String(l.text); });
  LYRICS.sort((a,b)=>a.time-b.time);
})();

const START_AT = 0;
const END_AT = 46;
const MESSAGE = `NASA called. They want their brightest star back.\nIf I had a star for every time you crossed my mind, I’d have a galaxy to give you. ✨.
Just ask—it’s yours!
i really love youu soooooooooooo much my little baby`;
const LINES_PER_PAGE = 2;

const audio = document.getElementById('audio');
const canvas = document.getElementById('sky');
const ctx = canvas.getContext('2d');
const layer = document.getElementById('stars');
const playBtn = document.getElementById('playBtn');
const fill = document.getElementById('fill');
const bar = document.getElementById('bar');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

// Lumn Layer (التوهج)
const lumnLayer = document.getElementById('lumn-layer');

const ICON_PLAY = '<svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
playBtn.innerHTML = ICON_PLAY;

let W=0,H=0,dpr=1, stars=[], currentIdx=-1;
let fallbackClock=0, fallbackPlaying=false, lastTs=0;
let audioOK=true, started=false;

function rng(seed){ let s=seed; for(let i=0;i<8;i++) s=(s*16807)%2147483647; return ()=>(s=(s*16807)%2147483647)/2147483647; }
let seed = Math.floor(Math.random()*1e6)+1;

function buildWords(){
  const lines = LYRICS.map(l=>({time:l.time, words:l.text.trim().split(/\s+/).filter(Boolean)})).filter(l=>l.words.length);
  const out = [];
  lines.forEach((l,li)=>{
    const page = Math.floor(li/LINES_PER_PAGE);
    const next = lines[li+1]? lines[li+1].time : l.time+3;
    const dur = Math.max(.6, next - l.time);
    l.words.forEach((w,wi)=> out.push({text:w, time:l.time+(wi/l.words.length)*dur*.85, page}));
  });
  return out;
}

function layout(){
  const rand = rng(seed);
  const yMin = 78;
  const yMaxBase = H - Math.max(150, H*0.06 + 112);
  const pages = {};
  stars.forEach(s => (pages[s.page]=pages[s.page]||[]).push(s));
  Object.values(pages).forEach(list=>{
    const placed = [];
    list.forEach(s=>{
      const bw = s.el.offsetWidth*1.9+18, bh = s.el.offsetHeight*1.9+12;
      const xMin = bw/2+12, xMax = Math.max(xMin+1, W-bw/2-12);
      const yMax = Math.max(yMin+1, yMaxBase-bh);
      let best=null, bestScore=Infinity;
      for(let k=0;k<250;k++){
        const x = xMin+rand()*(xMax-xMin), y = yMin+rand()*(yMax-yMin);
        let score=0;
        for(const q of placed){
          const ox = Math.min(x+bw/2, q.x+q.w/2) - Math.max(x-bw/2, q.x-q.w/2);
          const oy = Math.min(y+bh, q.y+q.h) - Math.max(y, q.y);
          if(ox>0 && oy>0) score += ox*oy;
        }
        if(score<bestScore){ bestScore=score; best={x,y}; if(score===0) break; }
      }
      s.bx=best.x; s.by=best.y;
      placed.push({x:best.x, y:best.y, w:bw, h:bh});
      s.ph = rand()*Math.PI*2;
      s.sp = 0.4+rand()*0.5;
    });
  });
}

function newPattern(){ seed = Math.floor(Math.random()*1e6)+1; layout(); stars.forEach(s=>s.a=0); }

function build(){
  layer.innerHTML='';
  stars = buildWords().map(wd=>{
    const el = document.createElement('div');
    el.className='star';
    el.innerHTML='<div class="dot"></div><div class="label"></div>';
    el.lastChild.textContent = wd.text;
    layer.appendChild(el);
    return {el, time:wd.time, page:wd.page, x:0,y:0,a:0,sc:1,bx:0,by:0,ph:0,sp:1, lastOpacity:-1, lastTransform:''};
  });
  layout();
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(layout);
}

let resizeRAF;
function resize(){
  dpr = Math.min(window.devicePixelRatio||1, 2);
  W = innerWidth; H = innerHeight;
  canvas.width = W*dpr; canvas.height = H*dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
  layout();
  if(phase==='finale') buildHeart();
}
addEventListener('resize', () => {
  if (resizeRAF) cancelAnimationFrame(resizeRAF);
  resizeRAF = requestAnimationFrame(resize);
});

const isSmallScreen = matchMedia('(max-width: 1024px)').matches;
const DUST_COUNT = isSmallScreen ? 100 : 120;
const dust = Array.from({length: DUST_COUNT}, (_, i) => {
  const r = rng(i + 7);
  return { x: r(), y: r(), s: r() * 0.6 + .3, p: r() * 6.28 };
});

function endTime(){ if(END_AT!==null) return END_AT; return Math.max(0,...LYRICS.map(l=>l.time))+6; }
function rangeEnd(){ return endTime(); }
function now(){ return audioOK && audio.readyState>0 ? audio.currentTime : fallbackClock; }

function frame(ts){ requestAnimationFrame(frame); try{ tick(ts); }catch(err){ console.error('Constellation error:',err); } }

function findCurrentIndex(t) {
  let lo = 0, hi = stars.length - 1, ans = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (stars[mid].time <= t) { ans = mid; lo = mid + 1; }
    else { hi = mid - 1; }
  }
  return ans;
}

function tick(ts){
  const dt = Math.min((ts-lastTs)/1000, .1); lastTs = ts;
  if(fallbackPlaying && !(audioOK && audio.readyState>0)) fallbackClock += dt;
  const t = now();
  const sec = ts/1000;

  ctx.clearRect(0,0,W,H);
  if (!reduceMotion) {
    ctx.beginPath();
    for (const d of dust) {
      const tw = .5 + .5 * Math.sin(sec * .8 + d.p);
      ctx.globalAlpha = .3 + tw * .5;
      ctx.moveTo(d.x * W + d.s, d.y * H);
      ctx.arc(d.x * W, d.y * H, d.s, 0, 6.283);
    }
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.globalAlpha = 1;
  } else {
    for (const d of dust) {
      ctx.fillStyle = `rgba(255,255,255,${.06 + .5 * .14})`;
      ctx.beginPath(); ctx.arc(d.x * W, d.y * H, d.s, 0, 6.283); ctx.fill();
    }
  }

  let cur = -1;
  if (started) cur = findCurrentIndex(t);
  if(cur!==currentIdx){
    if(currentIdx>=0 && stars[currentIdx]) stars[currentIdx].el.classList.remove('current');
    if(cur>=0) stars[cur].el.classList.add('current');
    currentIdx = cur;
  }

  const page = cur>=0 ? stars[cur].page : 0;
  const active = [];
  for(let i=0;i<stars.length;i++){
    const s = stars[i];
    const target = (started && t>=s.time && s.page===page) ? 1 : 0;
    s.a += (target - s.a) * Math.min(1, dt*3);
    const fx = reduceMotion ? 0 : Math.sin(sec*s.sp+s.ph)*7 + Math.sin(sec*.23+i)*4;
    const fy = reduceMotion ? 0 : Math.cos(sec*s.sp*.8+s.ph)*7;
    s.x = s.bx+fx; s.y = s.by+fy;
    const pulse = reduceMotion ? 1 : .85+.15*Math.sin(sec*2+s.ph);
    s.sc += ((i===cur?1.8:1)-s.sc)*Math.min(1, dt*7);
    const newOpacity = s.a * pulse;
    const newTransform = `translate(${s.x}px,${s.y}px) translate(-50%,-4px) scale(${s.sc.toFixed(3)})`;
    if (Math.abs(newOpacity - s.lastOpacity) > 0.01 || newTransform !== s.lastTransform) {
      s.el.style.opacity = newOpacity.toFixed(3);
      s.el.style.transform = newTransform;
      s.lastOpacity = newOpacity;
      s.lastTransform = newTransform;
    }
    if(s.a>.02) active.push(s);
  }

  ctx.globalAlpha = lyricsFade;
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.shadowColor = 'rgba(255,255,255,.8)';
  ctx.shadowBlur = 8;
  ctx.lineWidth = 1;
  for(let i=1;i<active.length;i++){
    const a=active[i-1], b=active[i];
    if(a.page!==b.page) continue;
    const alpha = Math.min(a.a, b.a);
    const shimmer = reduceMotion ? 1 : .8+.2*Math.sin(sec*1.3+a.ph);
    ctx.strokeStyle = `rgba(255,255,255,${.28*alpha*shimmer})`;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  finaleTick(sec,t);
  drawFinale(sec);

  const span = rangeEnd()-START_AT;
  const prog = span>0 ? Math.min(1, Math.max(0, (t-START_AT)/span)) : 0;
  const newWidth = (prog*100).toFixed(1) + '%';
  if (fill.style.width !== newWidth) fill.style.width = newWidth;
}

/* Finale */
let phase='lyrics';
let lyricsFade=1;
let fin=null;
let samples=[], heartScale=1, meteors=[], cstars=[], field=[];
const bannerEl = document.getElementById('banner');
const msgEl = document.getElementById('msg');
const playerEl = document.querySelector('.player');
const edgeEl = document.getElementById('edge');
const N_STARS = 18;
const T = { fade:1.4, meteors:0.9, stars:3.0, starSpan:1.6, lines:5.0, segDur:0.18 };
T.banner = T.lines + N_STARS*T.segDur + 0.6;

function buildHeart(){
  heartScale = Math.min(W*0.78/34, H*0.46/29);
  const cx=W/2, cy=H*0.36, M=360;
  samples=[];
  for(let i=0;i<=M;i++){
    const t = Math.PI + (i/M)*Math.PI*2;
    const x = 16*Math.pow(Math.sin(t),3);
    const y = 13*Math.cos(t)-5*Math.cos(2*t)-2*Math.cos(3*t)-Math.cos(4*t)+2.5;
    samples.push({x:cx+x*heartScale, y:cy-y*heartScale});
  }
}

function startFinale(){
  if(phase!=='lyrics') return;
  phase='finale';
  fallbackPlaying=false;
  buildHeart();
  const rand = rng(Math.floor(Math.random()*1e6)+1);
  lumnLayer.style.opacity = 0;



  meteors=[];
  for(let k=0;k<7;k++){
    const fromTop = rand()<.6;
    let dx = -(.65+.35*rand()), dy = .35+.35*rand();
    const l = Math.hypot(dx,dy); dx/=l; dy/=l;
    meteors.push({ t:T.meteors+k*.42+rand()*.2, dur:.9+rand()*.5,
                   sx: fromTop? W*(.3+.8*rand()) : W+40, sy: fromTop? -40 : H*.5*rand(),
                   dx, dy, len:150+rand()*130, dist:Math.hypot(W,H)*1.15 });
  }

  cstars=[];
  const M = samples.length-1, step = M/N_STARS;
  for(let i=0;i<N_STARS;i++){
    const keep = (i===0 || i===N_STARS/2);
    const jitter = keep ? 0 : (rand()-.5)*step*.5;
    cstars.push({ idx:Math.max(0,Math.min(M,Math.round(i*step+jitter))),
                  jx: i===0?0:(rand()-.5)*.8, jy: i===0?0:(rand()-.5)*.8,
                  major: i%6===0, r: i%6===0?3.2:1.5+rand()*1.3,
                  ph:rand()*6.28, at:T.stars+rand()*T.starSpan });
  }

  field=[];
  for(let i=0;i<30;i++){
    field.push({ x:W*(.08+.84*rand()), y:H*(.08+.54*rand()), r:.5+rand()*.9,
                 ph:rand()*6.28, at:T.stars+rand()*(T.starSpan+1.2) });
  }

  fin = { t0:performance.now()/1000, banner:false };
  playerEl.classList.add('hide');

}

function resetFinale(){
  phase='lyrics'; fin=null; lyricsFade=1; meteors=[]; cstars=[]; field=[];
  layer.style.opacity=1;
  bannerEl.classList.remove('show'); msgEl.textContent='';
  playerEl.classList.remove('hide');
  edgeEl.classList.remove('love');
  audio.volume=1; started=false; currentIdx=-1;
  stars.forEach(s=>{ s.a=0; s.el.classList.remove('current'); });
}
document.getElementById('replay').addEventListener('click', resetFinale);
addEventListener('keydown', e=>{ if(e.key==='f'||e.key==='F') startFinale(); });

function showBanner(){
  const me=fin, chars=Array.from(MESSAGE);
  const delay = Math.max(18, Math.min(60, 4000/Math.max(1,chars.length)));
  msgEl.textContent='';
  bannerEl.classList.add('show');
  let i=0;
  const step = ()=>{ if(fin!==me) return; msgEl.textContent = chars.slice(0,++i).join(''); if(i<chars.length) setTimeout(step,delay); };
  setTimeout(step, 800);
}

function finaleTick(sec,t){
  if(phase==='lyrics'){ if(started && t>=endTime()) startFinale(); return; }
  const e = sec-fin.t0;
  lyricsFade = Math.max(0, 1-e/T.fade);
  layer.style.opacity = lyricsFade;
  if(!audio.paused){ audio.volume = Math.max(0, 1-e/2); if(e>=2) audio.pause(); }
  if(!fin.banner && e>=T.banner){ fin.banner=true; showBanner(); }
}

function drawStar(x,y,r,a,sec,ph,flare,major,halo){
  const tw = reduceMotion?1:.7+.3*Math.sin(sec*2.4+ph);
  ctx.save();
  if(halo){
    const R = r*(major?12:8);
    const g = ctx.createRadialGradient(x,y,0,x,y,R);
    g.addColorStop(0,'rgba(255,225,240,.4)'); g.addColorStop(1,'rgba(255,200,230,0)');
    ctx.globalAlpha = a*tw; ctx.fillStyle=g;
    ctx.beginPath(); ctx.arc(x,y,R,0,6.283); ctx.fill();
  }
  ctx.globalAlpha = a*tw; ctx.fillStyle='#fff';
  ctx.shadowColor = halo?'rgba(255,190,225,1)':'rgba(255,255,255,.95)';
  ctx.shadowBlur = (halo?22:10)+16*flare+(major?8:0);
  ctx.beginPath(); ctx.arc(x,y,r*(1+flare*.8),0,6.283); ctx.fill();
  if(major||flare>.2){
    const L = (major?14:8)*(.6+flare)+(major&&!reduceMotion?4*Math.sin(sec*1.7+ph):0);
    ctx.lineWidth=1; ctx.strokeStyle='rgba(255,255,255,.7)'; ctx.shadowBlur=6;
    ctx.beginPath(); ctx.moveTo(x-L,y); ctx.lineTo(x+L,y); ctx.moveTo(x,y-L); ctx.lineTo(x,y+L); ctx.stroke();
  }
  ctx.restore();
}

function drawFinale(sec){
  if(phase!=='finale') return;
  const e = sec-fin.t0;

  for(const m of meteors){
    const p = (e-m.t)/m.dur;
    if(p<0||p>1) continue;
    const hx=m.sx+m.dx*m.dist*p, hy=m.sy+m.dy*m.dist*p;
    const tx=hx-m.dx*m.len, ty=hy-m.dy*m.len;
    const g = ctx.createLinearGradient(tx,ty,hx,hy);
    g.addColorStop(0,'rgba(255,255,255,0)'); g.addColorStop(1,'rgba(255,255,255,.95)');
    ctx.save();
    ctx.strokeStyle=g; ctx.lineWidth=1.8; ctx.lineCap='round';
    ctx.shadowColor='rgba(170,200,255,.9)'; ctx.shadowBlur=12;
    ctx.beginPath(); ctx.moveTo(tx,ty); ctx.lineTo(hx,hy); ctx.stroke();
    ctx.fillStyle='#fff'; ctx.shadowBlur=20;
    ctx.beginPath(); ctx.arc(hx,hy,2,0,6.283); ctx.fill();
    ctx.restore();
  }

  for(const f of field){
    if(e<f.at) continue;
    const age = e-f.at;
    drawStar(f.x,f.y,f.r,Math.min(1,age*2)*.8,sec,f.ph,Math.max(0,1-age*2),false);
  }

  const hp = Math.max(0,Math.min(1,(e-T.lines)/(N_STARS*T.segDur)));
  if(hp>0){
    const breathe = reduceMotion?1:.85+.15*Math.sin(sec*1.6);
    const R = heartScale*22, hx0=W/2, hy0=H*0.36;
    const g = ctx.createRadialGradient(hx0,hy0,0,hx0,hy0,R);
    g.addColorStop(0,`rgba(255,150,200,${.24*hp*breathe})`);
    g.addColorStop(.6,`rgba(255,120,190,${.10*hp*breathe})`);
    g.addColorStop(1,'rgba(255,120,190,0)');
    ctx.fillStyle=g; ctx.fillRect(hx0-R,hy0-R,R*2,R*2);
  }

  const pts = cstars.map(s=>({x:samples[s.idx].x+s.jx*heartScale, y:samples[s.idx].y+s.jy*heartScale}));
  for(let i=0;i<N_STARS;i++){
    const q = Math.max(0,Math.min(1,(e-(T.lines+i*T.segDur))/T.segDur));
    if(q<=0) break;
    const a=pts[i], b=pts[(i+1)%N_STARS];
    const dx=b.x-a.x, dy=b.y-a.y, d=Math.hypot(dx,dy)||1, ux=dx/d, uy=dy/d;
    const g0=cstars[i].r+7, g1=cstars[(i+1)%N_STARS].r+7;
    if(d<=g0+g1) continue;
    const x0=a.x+ux*g0, y0=a.y+uy*g0, x1=b.x-ux*g1, y1=b.y-uy*g1;
    const ex=x0+(x1-x0)*q, ey=y0+(y1-y0)*q;
    ctx.save();
    ctx.lineCap='round';
    ctx.strokeStyle='rgba(255,200,230,.18)'; ctx.lineWidth=6;
    ctx.shadowColor='rgba(255,170,220,.95)'; ctx.shadowBlur=26;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(ex,ey); ctx.stroke();
    ctx.strokeStyle='rgba(255,255,255,.85)'; ctx.lineWidth=1.3;
    ctx.shadowColor='#fff'; ctx.shadowBlur=14;
    ctx.beginPath(); ctx.moveTo(x0,y0); ctx.lineTo(ex,ey); ctx.stroke();
    if(q<1){ ctx.fillStyle='#fff'; ctx.shadowBlur=22; ctx.beginPath(); ctx.arc(ex,ey,2.2,0,6.283); ctx.fill(); }
    ctx.restore();
  }

  cstars.forEach((s,i)=>{
    if(e<s.at) return;
    const age = e-s.at;
    drawStar(pts[i].x, pts[i].y, s.r, Math.min(1,age*2.5), sec, s.ph, Math.max(0,1-age/.7), s.major, true);
  });
}

/* Controls */
function setIcon(playing){
  playBtn.innerHTML = playing?ICON_PAUSE:ICON_PLAY;
  playBtn.setAttribute('aria-label', playing?'Pause':'Play');
}

// ====== تشغيل الصوت بدون مشاكل ======
playBtn.addEventListener('click', async ()=>{
  if(!started){
    newPattern();
    audio.volume=1;
    fallbackClock = START_AT;
    try { audio.currentTime = START_AT; } catch(e){}
  }
  started = true;
  
  if(fallbackPlaying || (!audio.paused && audioOK)){
    audio.pause(); fallbackPlaying=false; setIcon(false); return;
  }
  
  try{
    await audio.play();
    audioOK=true; fallbackPlaying=false;
    
    // تأثير بسيط للـ Lumn إنه يبدأ ينبض لما الصوت يشتغل (بدون Audio API)
    if(lumnLayer) lumnLayer.classList.add('beat');
    setTimeout(() => { if(lumnLayer) lumnLayer.classList.remove('beat'); }, 1000);

  }catch(e){
    audioOK=false; fallbackPlaying=true;
  }
  setIcon(true);
});

audio.addEventListener('pause', ()=>{ if(!fallbackPlaying) setIcon(false); });
audio.addEventListener('play', ()=>{ started=true; setIcon(true); });
audio.addEventListener('ended', ()=>{ fallbackPlaying=false; setIcon(false); startFinale(); });
audio.addEventListener('error', ()=>{ audioOK=false; });

bar.addEventListener('click', e=>{
  const r = bar.getBoundingClientRect();
  const p = Math.min(1, Math.max(0, (e.clientX-r.left)/r.width));
  const span = rangeEnd()-START_AT;
  if(span>0 && audio.readyState>0) audio.currentTime = START_AT + p*span;
});

build(); resize();
requestAnimationFrame(t=>{ lastTs=t; frame(t); });
