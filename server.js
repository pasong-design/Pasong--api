<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Player - PASONG</title>
<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0F0F14;color:#fff;font-family:sans-serif}
header{padding:16px 5%;display:flex;justify-content:space-between;align-items:center;background:#0F0F14;border-bottom:1px solid #23233A;position:sticky;top:0;z-index:10}
.hbtn{width:44px;height:44px;border-radius:12px;background:#1A1A28;border:1px solid #2A2A42;display:grid;place-items:center;cursor:pointer;font-size:22px;color:#fff}
.main{padding:14px 5%}
.cover{width:100%;max-width:380px;aspect-ratio:1/1;border-radius:20px;object-fit:cover;display:block;margin:0 auto;background:#1A1A28;border:1px solid #2A2A42}
.title{font-size:28px;font-weight:900;margin-top:18px}
.artist{font-size:17px;color:#A78BFA;margin-top:8px;font-weight:700}
.meta{font-size:15px;color:#9CA3AF;margin-top:8px}
.bar{height:8px;background:#1A1A28;border-radius:10px;margin-top:20px;border:1px solid #2A2A42;position:relative;cursor:pointer;overflow:visible}
.fill{height:100%;background:linear-gradient(90deg,#7C4DFF,#8B5CF6);width:0%;border-radius:10px;position:relative}
.dot{position:absolute;right:-6px;top:50%;transform:translateY(-50%);width:14px;height:14px;background:#fff;border-radius:50%;display:none;box-shadow:0 0 8px rgba(124,77,255,.8)}
.bar:hover .dot{display:block}
.time{display:flex;justify-content:space-between;font-size:14px;color:#9CA3AF;margin-top:8px;font-weight:600}
.controls{display:flex;justify-content:center;gap:16px;margin-top:22px;align-items:center}
.c{width:50px;height:50px;border-radius:16px;background:#1A1A28;border:1px solid #2A2A42;display:grid;place-items:center;cursor:pointer;color:#fff;font-size:18px}
.c.play{width:74px;height:74px;background:#7C4DFF;color:#fff;font-size:32px;border:none;box-shadow:0 8px 24px rgba(124,77,255,.4)}
.c.active{background:#7C4DFF;border-color:#7C4DFF;color:#fff}
.actions{display:flex;gap:12px;margin-top:20px}
.btn{flex:1;height:52px;border-radius:14px;background:#1A1A28;border:1px solid #2A2A42;display:grid;place-items:center;cursor:pointer;font-weight:800;color:#fff;font-size:15px}
.btn.buy{background:#7C4DFF;border:none}
.btn.active{background:#FF2D55}
.share-row{display:flex;gap:10px;margin-top:14px}
.share-btn{flex:1;height:44px;border-radius:12px;background:#1A1A28;border:1px solid #2A2A42;color:#fff;font-weight:700;font-size:13px;display:grid;place-items:center;cursor:pointer}
.artist-box{margin:24px 5%;background:#1A1A28;border:1px solid #2A2A42;border-radius:20px;padding:18px;display:flex;gap:16px;align-items:center}
.artist-box img{width:84px;height:84px;border-radius:50%;object-fit:cover;border:3px solid #7C4DFF;background:#23233A}
.artist-box .name{font-size:20px;font-weight:900}
.artist-box .sub{font-size:14px;color:#A0A0B8;margin-top:6px}
.card-box{margin:16px 5%;background:#1A1A28;border:1px solid #2A2A42;border-radius:20px;padding:18px}
.card-box h3{font-size:16px;font-weight:900;margin-bottom:12px}
.lyrics{white-space:pre-wrap;font-size:15px;line-height:1.7;color:#D1D5DB}
.section{margin-top:30px}
.head{padding:0 5%;margin-bottom:14px}
.head h2{font-size:19px;font-weight:800}
.list{padding:0 5%;display:flex;flex-direction:column;gap:12px}
.row{display:flex;align-items:center;gap:12px;background:#1A1A28;border:1px solid #2A2A42;border-radius:16px;padding:14px;cursor:pointer}
.row .num{color:#7C4DFF;font-weight:900;width:22px}
.row img{width:56px;height:56px;border-radius:10px;object-fit:cover}
.row .rt{font-size:16px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.row .ra{font-size:13px;color:#9CA3AF;margin-top:3px}
.grid{display:flex;gap:14px;overflow-x:auto;padding:0 5% 12px;scrollbar-width:none}
.grid::-webkit-scrollbar{display:none}
.card{flex:0 0 180px;background:#1A1A28;border:1px solid #2A2A42;border-radius:16px;overflow:hidden;cursor:pointer}
.card img{width:100%;aspect-ratio:1/1;object-fit:cover;display:block}
.card-info{padding:10px 12px}
.card .t{font-size:15px;font-weight:800;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.card .a{font-size:13px;color:#9CA3AF;margin-top:2px}
.comment-input{width:100%;height:48px;background:#0F0F14;border:1px solid #2A2A42;border-radius:12px;padding:0 14px;color:#fff;font-size:14px;margin-top:10px}
.comment-row{padding:12px 0;border-bottom:1px solid #23233A;display:flex;gap:10px}
.like-btn{font-size:12px;color:#9CA3AF;cursor:pointer;margin-top:6px;font-weight:700;display:flex;gap:12px}
.like-btn span.liked{color:#FF2D55}
.buy-modal{position:fixed;inset:0;background:rgba(0,0,0,.85);display:none;place-items:center;z-index:100;padding:20px}
.buy-modal.open{display:grid}
.buy-card{width:100%;max-width:400px;background:#1A1A28;border:1px solid #2A2A42;border-radius:20px;padding:20px}
.license{padding:14px;border:1px solid #2A2A42;border-radius:12px;margin-top:12px;cursor:pointer;display:flex;justify-content:space-between;align-items:center}
.license:hover{border-color:#7C4DFF}
.license.active{border-color:#7C4DFF;background:rgba(124,77,255,.15)}
.emoji-bar{display:flex;gap:8px;margin-top:10px;overflow-x:auto}
.emoji-bar span{cursor:pointer;font-size:20px;background:#0F0F14;border:1px solid #2A2A42;width:36px;height:36px;display:grid;place-items:center;border-radius:8px;flex-shrink:0}
.time-ago{font-size:11px;color:#666;margin-left:8px}
@media(max-width:700px){
footer div[style*="grid-template-columns:repeat(4,1fr)"]{grid-template-columns:repeat(2,1fr)!important}
}
</style>
</head>
<body>
<header>
<div class="hbtn" onclick="history.back()">‹</div>
<div style="font-size:13px;color:#9CA3AF;font-weight:800">PASONG</div>
<div class="hbtn" onclick="shareLink()">↗</div>
</header>
<div class="main">
<img id="cover" class="cover" alt="Song cover">
<div id="title" class="title">Loading...</div>
<div id="artistName" class="artist"></div>
<div id="meta" class="meta">Loading plays...</div>
<div class="bar" id="progressBar"><div id="fill" class="fill"><div class="dot"></div></div></div>
<div class="time"><span id="cur">0:00</span><span id="dur">0:00</span></div>
<div class="controls">
<div class="c" id="shuffleBtn" onclick="toggleShuffle()" title="Shuffle">🔀</div>
<div class="c" onclick="prev()">⏮</div>
<div id="playBtn" class="c play" onclick="toggle()">▶</div>
<div class="c" onclick="next()">⏭</div>
<div class="c" id="repeatBtn" onclick="toggleRepeat()" title="Repeat">🔁</div>
</div>
<div class="actions">
<div id="heart" class="btn" onclick="toggleFav()">♡ Favorite</div>
<div class="btn buy" onclick="checkout()">+ Buy</div>
</div>
<div class="share-row">
<div class="share-btn" onclick="shareWA()">WhatsApp</div>
<div class="share-btn" onclick="shareLink()">Copy Link</div>
</div>
<audio id="audio"></audio>
<div id="nextUp" style="margin-top:16px;text-align:center;font-size:13px;color:#9CA3AF;display:none">Next: <b id="nextTitle" style="color:#fff"></b></div>
</div>
<div class="artist-box">
<img id="artistImg" alt="Artist">
<div><div id="artistBoxName" class="name"></div><div id="artistBoxMeta" class="sub"></div></div>
</div>
<div class="card-box"><h3>Lyrics</h3><div id="lyrics" class="lyrics">Lyrics not available yet.</div></div>
<div class="section"><div class="head"><h2 id="popTitle">Popular</h2></div><div class="list" id="popularList"></div></div>
<div class="section"><div class="head"><h2>Popular releases</h2></div><div class="grid" id="releaseGrid"></div></div>
<div class="section"><div class="head"><h2>Recommended for you</h2></div><div class="grid" id="recommendedGrid"></div></div>
<div class="section"><div class="head"><h2>Albums & EPs</h2></div><div class="grid" id="albumGrid"></div></div>
<div class="section"><div class="head"><h2 id="fansTitle">Fans also like</h2></div><div class="grid" id="fansGrid"></div></div>
<div class="card-box">
<h3>Comments <span id="commentCount" style="color:#7C4DFF;font-size:13px"></span></h3>
<input id="commentText" class="comment-input" placeholder="Add a comment and press Enter...">
<div class="emoji-bar">
<span onclick="addEmoji('🔥')">🔥</span><span onclick="addEmoji('❤️')">❤️</span><span onclick="addEmoji('😍')">😍</span><span onclick="addEmoji('👏')">👏</span><span onclick="addEmoji('💯')">💯</span><span onclick="addEmoji('🎧')">🎧</span><span onclick="addEmoji('🎶')">🎶</span><span onclick="addEmoji('🙌')">🙌</span>
</div>
<div id="commentsList"></div>
</div>
<div id="buyModal" class="buy-modal" onclick="if(event.target===this)closeBuy()">
<div class="buy-card">
<div style="display:flex;justify-content:space-between;align-items:center"><h3 id="buyModalTitle" style="font-weight:900">Buy Song</h3><div onclick="closeBuy()" style="cursor:pointer;font-size:20px">✕</div></div>
<div style="margin-top:12px;display:flex;gap:12px">
<img id="buyCover" src="" alt="" style="width:70px;height:70px;border-radius:12px;object-fit:cover">
<div><div id="buyTitle" style="font-weight:800"></div><div id="buyArtist" style="font-size:13px;color:#9CA3AF;margin-top:4px"></div></div>
</div>
<div class="license active" data-price="10" onclick="selectLicense(this)"><div><b>MP3 License</b><div style="font-size:12px;color:#9CA3AF">MP3 + Social rights</div></div><b>$10</b></div>
<div class="license" data-price="30" onclick="selectLicense(this)"><div><b>WAV License</b><div style="font-size:12px;color:#9CA3AF">MP3 + WAV + Unlimited</div></div><b>$30</b></div>
<div class="license" data-price="80" onclick="selectLicense(this)"><div><b>Stems / Trackout</b><div style="font-size:12px;color:#9CA3AF">All files + Stems</div></div><b>$80</b></div>
<button onclick="checkout()" style="width:100%;height:52px;background:#7C4DFF;border:none;border-radius:14px;color:#fff;font-weight:900;margin-top:16px;font-size:16px;cursor:pointer">Buy Now • <span id="buyPrice">$10</span></button>
<div style="text-align:center;font-size:12px;color:#666;margin-top:10px">Secure payment via Mobile Money / Card</div>
</div></div>
<footer style="background:#080810;border-top:1px solid #23233A;padding:32px 5% 90px;font-family:Arial;margin-top:30px">
<div style="display:grid;grid-template-columns:repeat(4,1fr);gap:28px;max-width:1200px;margin:0 auto">
<div><div style="font-weight:900;font-size:22px;margin-bottom:18px">◈ <span style="color:#c084fc">PASONG</span></div><div style="font-weight:800;font-size:14px;color:#fff;margin-bottom:12px">Company</div>
<a href="about.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">About</a><a href="jobs.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Jobs</a><a href="for-the-record.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">For the Record</a></div>
<div><div style="font-weight:800;font-size:14px;color:#fff;margin-bottom:12px">Communities</div>
<a href="for-artists.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">For Artists</a><a href="for-creators.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">For Creators</a><a href="for-authors.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">For Authors</a><a href="developers.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Developers</a><a href="advertising.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Advertising</a><a href="investors.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Investors</a><a href="vendors.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Vendors</a></div>
<div><div style="font-weight:800;font-size:14px;color:#fff;margin-bottom:12px">Useful links</div>
<a href="support.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Support</a><a href="free-mobile-app.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Free Mobile App</a><a href="popular-by-country.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Popular by Country</a><a href="top-song-lyrics.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Top Song Lyrics</a><a href="import-your-music.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Import your music</a></div>
<div><div style="font-weight:800;font-size:14px;color:#fff;margin-bottom:12px">PASONG Plans</div><a href="store.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Music Store</a><a href="charts.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Charts</a><a href="beats.html" style="display:block;color:#9CA3AF;font-size:14px;padding:6px 0;text-decoration:none">Beats</a></div>
</div><div style="max-width:1200px;margin:40px auto 0;padding-top:24px;border-top:1px solid #1A1A2E;display:flex;justify-content:center;color:#666;font-size:12px"><span>© 2026 PASONG</span></div>
</footer>
<script>
const SUPABASE_URL="https://mtufczmjlkvycarxylgh.supabase.co";
const SUPABASE_KEY="sb_publishable_XDIZ0_nd4PAYJy2Oz4VaxQ_R4Trs3VP";
const PASONG_API="https://pasong-api.onrender.com";
const db=supabase.createClient(SUPABASE_URL,SUPABASE_KEY);
let list=[],idx=0,current=null,isShuffle=false,isRepeat=false,selectedPrice=10,playCounted=false,playedSeconds=0,lastPlaybackTime=null,playRecordInFlight=false;
let streamSessionId=null,streamSessionSongId=null,streamHeartbeatTimer=null,streamSessionStarting=false,streamSessionGeneration=0;
const audio=document.getElementById("audio");

/* Protected audio URL renewal state. */
let audioRefreshTimer=null;
let audioSourceGeneration=0;
let audioSourceError="";

function clearAudioRefresh(){
  if(audioRefreshTimer){clearTimeout(audioRefreshTimer);audioRefreshTimer=null;}
}
function qs(k){return new URLSearchParams(location.search).get(k);}
function formatTime(t){if(!t||isNaN(t))return "0:00";return Math.floor(t/60)+":"+String(Math.floor(t%60)).padStart(2,"0");}
function timeAgo(d){let diff=Math.floor((Date.now()-new Date(d))/1000);if(diff<60)return diff+"s ago";if(diff<3600)return Math.floor(diff/60)+"m ago";if(diff<86400)return Math.floor(diff/3600)+"h ago";return Math.floor(diff/86400)+"d ago";}

async function getProtectedSongUrl(songId){
  const response=await fetch(PASONG_API+"/api/songs/"+encodeURIComponent(songId)+"/playback-url",{method:"GET",cache:"no-store"});
  const result=await response.json().catch(()=>({}));
  if(!response.ok||!result.success||!result.url){
    throw new Error(result.message||result.error||("Protected playback unavailable (HTTP "+response.status+")."));
  }
  return result.url;
}
function scheduleAudioRefresh(songId,generation){
  clearAudioRefresh();
  audioRefreshTimer=setTimeout(async()=>{
    if(generation!==audioSourceGeneration||!current||String(current.id)!==String(songId)||current._pasong_type!=="song")return;
    const wasPlaying=!audio.paused;
    const position=audio.currentTime||0;
    const sessionId=streamSessionId;
    try{
      const freshUrl=await getProtectedSongUrl(songId);
      if(generation!==audioSourceGeneration||!current||String(current.id)!==String(songId))return;
      audio.pause();
      audio.src=freshUrl;
      audio.load();
      await new Promise((resolve,reject)=>{
        const onReady=()=>{cleanup();resolve();};
        const onError=()=>{cleanup();reject(new Error("Could not refresh protected audio."));};
        const cleanup=()=>{audio.removeEventListener("loadedmetadata",onReady);audio.removeEventListener("error",onError);};
        audio.addEventListener("loadedmetadata",onReady,{once:true});
        audio.addEventListener("error",onError,{once:true});
      });
      if(generation!==audioSourceGeneration||!current||String(current.id)!==String(songId))return;
      if(Number.isFinite(audio.duration)&&position>0)audio.currentTime=Math.min(position,Math.max(0,audio.duration-0.25));
      if(wasPlaying){
        await audio.play();
        if(sessionId)await sendPasongHeartbeat(true,sessionId);
      }
      scheduleAudioRefresh(songId,generation);
    }catch(error){
      console.warn("PASONG protected audio refresh failed:",error);
      const meta=document.getElementById("meta");
      if(meta&&!meta.textContent.includes("Audio link refresh failed"))meta.textContent+=" • Audio link refresh failed";
    }
  },10*60*1000);
}

/* PREMIUM STREAMING SESSION */
async function getStreamAuthHeaders(){
  const result=await db.auth.getSession();
  const token=result.data?.session?.access_token;
  return {"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})};
}
async function sendPasongHeartbeat(isPlaying,sessionId){
  const id=sessionId||streamSessionId;if(!id)return;
  try{
    const headers=await getStreamAuthHeaders();
    const response=await fetch(PASONG_API+"/api/streaming/session/heartbeat",{method:"POST",headers,body:JSON.stringify({session_id:id,media_position_seconds:Number(audio.currentTime||0),is_playing:Boolean(isPlaying&&!audio.paused)})});
    if(!response.ok){const message=await response.text().catch(()=>"");console.warn("PASONG heartbeat rejected:",response.status,message);}
  }catch(error){console.warn("PASONG heartbeat failed:",error);}
}
async function startPasongStreamSession(song){
  if(!song||song._pasong_type!=="song")return;
  if(!current||String(current.id)!==String(song.id))return;
  if(streamSessionId&&String(streamSessionSongId)===String(song.id))return;
  if(streamSessionStarting)return;
  streamSessionStarting=true;const generation=++streamSessionGeneration;
  try{
    const headers=await getStreamAuthHeaders();
    const response=await fetch(PASONG_API+"/api/streaming/session/start",{method:"POST",headers,body:JSON.stringify({song_id:song.id,source_type:"song"})});
    const result=await response.json().catch(()=>({}));
    if(!response.ok||!result.success||!result.session?.id)throw new Error(result.message||"Could not start Premium streaming session");
    const newSessionId=result.session.id;
    if(generation!==streamSessionGeneration||!current||String(current.id)!==String(song.id)||audio.paused){await sendPasongHeartbeat(false,newSessionId);return;}
    streamSessionId=newSessionId;streamSessionSongId=song.id;clearInterval(streamHeartbeatTimer);
    streamHeartbeatTimer=setInterval(()=>{if(streamSessionId)sendPasongHeartbeat(!audio.paused);},15000);
    await sendPasongHeartbeat(true,streamSessionId);
    console.log("PASONG streaming session started:",streamSessionId,"Premium eligible:",!!result.premium_eligible_at_start);
  }catch(error){console.warn("PASONG streaming session:",error.message);}
  finally{if(generation===streamSessionGeneration)streamSessionStarting=false;}
}
async function stopPasongStreamSession(){
  const oldSessionId=streamSessionId;streamSessionGeneration++;clearInterval(streamHeartbeatTimer);streamHeartbeatTimer=null;streamSessionId=null;streamSessionSongId=null;streamSessionStarting=false;
  if(oldSessionId)await sendPasongHeartbeat(false,oldSessionId);
}
audio.addEventListener("play",()=>{if(current&&current._pasong_type==="song")startPasongStreamSession(current);});
audio.addEventListener("pause",()=>{if(streamSessionId)sendPasongHeartbeat(false);});

async function init(){
  const id=qs("id"),type=qs("type");
  const [b,s]=await Promise.all([db.from("beats").select("*").order("created_at",{ascending:false}).limit(80),db.from("songs").select("*").order("created_at",{ascending:false}).limit(80)]);
  if(b.error)console.error("Could not load beats:",b.error);if(s.error)console.error("Could not load songs:",s.error);
  list=[...(b.data||[]).map(x=>({...x,_pasong_type:"beat"})),...(s.data||[]).map(x=>({...x,_pasong_type:"song"}))];
  if(id){
    let f=list.findIndex(x=>String(x.id)===String(id)&&(type==="beat"?x._pasong_type==="beat":type==="song"?x._pasong_type==="song":true));
    if(f<0&&type!=="song"){const one=await db.from("beats").select("*").eq("id",id).maybeSingle();if(one.data){list.unshift({...one.data,_pasong_type:"beat"});f=0;}}
    if(f<0&&type!=="beat"){const one=await db.from("songs").select("*").eq("id",id).maybeSingle();if(one.data){list.unshift({...one.data,_pasong_type:"song"});f=0;}}
    if(f>=0)idx=f;
  }
  if(list.length)await load(idx);else document.getElementById("title").textContent="No music found";
}
async function getRealPlays(id){
  try{const {data,error}=await db.rpc("get_song_play_count",{p_song_id:id});if(error)throw error;return Number(data||0);}
  catch(error){console.error("Could not fetch live song plays:",error);return null;}
}
async function refreshPlayCount(id){
  const count=await getRealPlays(id);if(count===null)return;
  const item=list.find(x=>String(x.id)===String(id)&&x._pasong_type==="song");if(item)item.plays=count;
  if(current&&String(current.id)===String(id)&&current._pasong_type==="song")document.getElementById("meta").textContent=count.toLocaleString()+" plays"+(current.genre?" • "+current.genre:"");
  return count;
}

async function load(i){
  await stopPasongStreamSession();
  clearAudioRefresh();
  const generation=++audioSourceGeneration;
  idx=i;current=list[i];if(!current)return;
  playCounted=false;playedSeconds=0;lastPlaybackTime=null;playRecordInFlight=false;audioSourceError="";
  const isBeat=current._pasong_type==="beat";
  document.getElementById("cover").src=current.cover_url||"";
  document.getElementById("title").textContent=current.title||"Untitled";
  audio.pause();audio.removeAttribute("src");audio.load();
  document.getElementById("fill").style.width="0%";document.getElementById("cur").textContent="0:00";document.getElementById("dur").textContent="0:00";document.getElementById("playBtn").textContent="▶";

  /* Songs MUST use the protected backend URL. Never fall back to public audio_url. Beats retain their existing playback source. */
  try{
    if(isBeat){
      const beatUrl=current.audio_url||current.preview_url||current.stream_url||"";
      if(!beatUrl)throw new Error("Beat audio is not available.");
      audio.src=beatUrl;
    }else{
      const protectedUrl=await getProtectedSongUrl(current.id);
      if(generation!==audioSourceGeneration)return;
      audio.src=protectedUrl;
      scheduleAudioRefresh(current.id,generation);
    }
    audio.load();
  }catch(error){
    if(generation!==audioSourceGeneration)return;
    audioSourceError=error.message||"Protected playback unavailable.";
    console.error("PASONG audio source error:",audioSourceError);
  }

  let name="PASONG",img=current.cover_url||"",bio="",verified=false,genre=current.genre||"",realPlays=0;
  if(!isBeat){const count=await getRealPlays(current.id);realPlays=count===null?Number(current.plays||0):count;}
  else realPlays=Number(current.plays||0);

  if(isBeat&&current.producer_id){
    const [p,ap]=await Promise.all([db.from("profiles").select("*").eq("id",current.producer_id).maybeSingle(),db.from("artist_profiles").select("*").eq("user_id",current.producer_id).maybeSingle()]);
    if(p.data){name=p.data.full_name||p.data.username||name;bio=p.data.bio||"";img=p.data.avatar_url||img;}
    if(ap.data){name=ap.data.artist_name||ap.data.stage_name||name;bio=ap.data.bio||bio;verified=!!ap.data.verified;img=ap.data.profile_image_url||ap.data.profile_photo_url||img;}
  }else if(current.artist_id){
    const ap=await db.from("artist_profiles").select("*").eq("id",current.artist_id).maybeSingle();
    if(ap.data){name=ap.data.artist_name||ap.data.stage_name||name;bio=ap.data.bio||"";verified=!!ap.data.verified;img=ap.data.profile_image_url||ap.data.profile_photo_url||img;}
  }
  document.getElementById("meta").textContent=realPlays.toLocaleString()+" plays"+(genre?" • "+genre:"")+(audioSourceError?" • "+audioSourceError:"");
  document.getElementById("artistName").textContent=name;
  document.getElementById("artistBoxName").textContent=name+(verified?" ✓":"");
  document.getElementById("artistImg").src=img||"";
  document.getElementById("artistBoxMeta").textContent=(bio||genre).slice(0,120);
  document.getElementById("lyrics").textContent=current.lyrics||"Lyrics not available yet.";
  document.getElementById("popTitle").textContent="Popular by "+name;
  document.getElementById("fansTitle").textContent="Fans of "+name+" also like";

  let same=isBeat?list.filter(x=>x.producer_id===current.producer_id):list.filter(x=>x.artist_id===current.artist_id);
  if(same.length<2)same=list;
  let pop="";
  for(let j=0;j<Math.min(6,same.length);j++){
    const x=same[j];let rp=Number(x.plays||0);
    if(x._pasong_type==="song"){const fresh=await getRealPlays(x.id);if(fresh!==null)rp=fresh;}
    pop+=`<div class="row" onclick="openPlayer('${x._pasong_type||"song"}','${x.id}')"><div class="num">${j+1}</div><img src="${x.cover_url||""}" alt=""><div style="flex:1;overflow:hidden"><div class="rt">${escapeHTML(x.title||"Untitled")}</div><div class="ra">${rp.toLocaleString()} plays</div></div></div>`;
  }
  document.getElementById("popularList").innerHTML=pop;
  const alb=await db.from("albums").select("*").order("created_at",{ascending:false}).limit(20);
  let releaseHtml="";
  if((alb.data||[]).length){alb.data.slice(0,10).forEach(a=>{releaseHtml+=`<div class="card" onclick="location.href='album.html?id=${encodeURIComponent(a.id)}'"><img src="${a.cover_url||current.cover_url||""}" alt=""><div class="card-info"><div class="t">${escapeHTML(a.title||a.name||"Album")}</div><div class="a">${escapeHTML(String(a.release_year||"Release"))}</div></div></div>`;});}
  else{same.slice(0,8).forEach(x=>{releaseHtml+=`<div class="card" onclick="openPlayer('${x._pasong_type||"song"}','${x.id}')"><img src="${x.cover_url||""}" alt=""><div class="card-info"><div class="t">${escapeHTML(x.title||"Untitled")}</div><div class="a">Single</div></div></div>`;});}
  document.getElementById("releaseGrid").innerHTML=releaseHtml;
  let albumHtml="";
  if((alb.data||[]).length){alb.data.forEach(a=>{albumHtml+=`<div class="card" onclick="location.href='album.html?id=${encodeURIComponent(a.id)}'"><img src="${a.cover_url||current.cover_url||""}" alt=""><div class="card-info"><div class="t">${escapeHTML(a.title||a.name||"Album")}</div><div class="a">${escapeHTML(String(a.release_year||"Album"))}</div></div></div>`;});}
  else albumHtml='<div style="padding:20px;color:#666;font-size:14px">No albums yet from this artist</div>';
  document.getElementById("albumGrid").innerHTML=albumHtml;
  let rec=list.filter(x=>x.id!==current.id).sort(()=>0.5-Math.random()).slice(0,12),recHtml="";
  rec.forEach(x=>{recHtml+=`<div class="card" onclick="openPlayer('${x._pasong_type||"song"}','${x.id}')"><img src="${x.cover_url||""}" alt=""><div class="card-info"><div class="t">${escapeHTML(x.title||"Untitled")}</div><div class="a">${escapeHTML(x.genre||"Recommended")}</div></div></div>`;});
  document.getElementById("recommendedGrid").innerHTML=recHtml;
  let fansList=list.filter(x=>x.genre===current.genre&&x.id!==current.id).slice(0,8);if(fansList.length<2)fansList=list.slice(0,8);
  let fans="";fansList.forEach(x=>{fans+=`<div class="card" style="padding:14px;text-align:center" onclick="openPlayer('${x._pasong_type||"song"}','${x.id}')"><img src="${x.cover_url||""}" alt="" style="width:76px;height:76px;border-radius:50%;margin:0 auto;display:block;border:3px solid #7C4DFF"><div class="t" style="margin-top:10px">${escapeHTML((x.title||"Untitled").slice(0,18))}</div></div>`;});
  document.getElementById("fansGrid").innerHTML=fans;
  const nextIdx=(idx+1)%list.length;document.getElementById("nextUp").style.display=list.length>1?"block":"none";document.getElementById("nextTitle").textContent=list[nextIdx]?.title||"";
  document.getElementById("buyCover").src=current.cover_url||"";document.getElementById("buyTitle").textContent=current.title||"";document.getElementById("buyArtist").textContent=name;
  await checkFav();await loadComments();
}
function escapeHTML(value){return String(value).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function openPlayer(type,id){location.href="player.html?type="+encodeURIComponent(type)+"&id="+encodeURIComponent(id);}
async function checkFav(){
  if(!current)return;const b=document.getElementById("heart");
  if(current._pasong_type!=="song"){b.classList.remove("active");b.textContent="♡ Favorite";return;}
  try{const auth=await db.auth.getUser(),u=auth.data?.user;if(!u){b.classList.remove("active");b.textContent="♡ Favorite";return;}
    const {data,error}=await db.from("favorites").select("id").eq("song_id",current.id).eq("user_id",u.id).limit(1);if(error)throw error;
    if(data&&data.length){b.classList.add("active");b.textContent="♥ Favorited";}else{b.classList.remove("active");b.textContent="♡ Favorite";}
  }catch(e){console.error("Favorite check failed:",e);}
}
async function toggleFav(){
  if(!current)return;if(current._pasong_type!=="song"){alert("Favorites are currently available for songs.");return;}
  const result=await db.auth.getUser(),u=result.data?.user;if(!u){alert("Login to favorite");return;}
  const {data,error}=await db.from("favorites").select("id").eq("song_id",current.id).eq("user_id",u.id).limit(1);
  if(error){alert(error.message);return;}
  if(data&&data.length){const del=await db.from("favorites").delete().eq("id",data[0].id).eq("user_id",u.id);if(del.error){alert(del.error.message);return;}}
  else{const ins=await db.from("favorites").insert({song_id:current.id,user_id:u.id});if(ins.error){alert(ins.error.message);return;}}
  await checkFav();
}
function toggle(){
  if(audio.paused){
    if(!audio.src){alert(audioSourceError||"Protected audio is not available for this song yet.");return;}
    audio.play().then(()=>document.getElementById("playBtn").textContent="⏸").catch(error=>{console.error("Audio playback failed:",error);alert("This audio could not be played. Please try again.");});
  }else{audio.pause();document.getElementById("playBtn").textContent="▶";}
}

/* Public play counter: 60 seconds of valid playback. */
function getPlayThreshold(){return 60;}
async function recordQualifiedPlay(){
  if(!current||current._pasong_type!=="song"||playCounted||playRecordInFlight)return;
  playCounted=true;playRecordInFlight=true;
  try{await addRealPlay(current.id);}catch(error){playCounted=false;console.error("Could not record PASONG play:",error);}
  finally{playRecordInFlight=false;}
}
audio.ontimeupdate=()=>{
  const duration=audio.duration||1;document.getElementById("fill").style.width=(audio.currentTime/duration*100)+"%";document.getElementById("cur").textContent=formatTime(audio.currentTime);
  if(!audio.paused&&!audio.seeking&&current&&current._pasong_type==="song"){
    if(lastPlaybackTime!==null){const delta=audio.currentTime-lastPlaybackTime;if(delta>0&&delta<=2.5)playedSeconds+=delta;}
    lastPlaybackTime=audio.currentTime;if(playedSeconds>=getPlayThreshold())recordQualifiedPlay();
  }
};
audio.addEventListener("play",()=>{document.getElementById("playBtn").textContent="⏸";lastPlaybackTime=audio.currentTime;});
audio.addEventListener("pause",()=>{lastPlaybackTime=null;document.getElementById("playBtn").textContent="▶";});
audio.addEventListener("seeking",()=>{lastPlaybackTime=null;});
audio.addEventListener("seeked",()=>{lastPlaybackTime=audio.currentTime;});
audio.onloadedmetadata=()=>{document.getElementById("dur").textContent=formatTime(audio.duration);};
audio.onended=async()=>{
  const finished=current;if(finished&&finished._pasong_type==="song"&&!playCounted&&playedSeconds>=getPlayThreshold())await recordQualifiedPlay();
  if(isRepeat){playCounted=false;playedSeconds=0;lastPlaybackTime=null;audio.currentTime=0;try{await audio.play();}catch(error){console.error("Replay failed:",error);}}
  else{await stopPasongStreamSession();await next();}
};
async function addRealPlay(songId){
  if(!songId)return;const {data,error}=await db.rpc("record_song_play",{p_song_id:songId});if(error){console.error("PASONG play counter failed:",error);throw error;}
  const count=Number(data),item=list.find(x=>String(x.id)===String(songId)&&x._pasong_type==="song");if(item)item.plays=count;
  if(current&&String(current.id)===String(songId)&&current._pasong_type==="song")document.getElementById("meta").textContent=count.toLocaleString()+" plays"+(current.genre?" • "+current.genre:"");
  console.log("PASONG public play recorded. Total:",count);return count;
}
async function next(){if(!list.length)return;idx=isShuffle?Math.floor(Math.random()*list.length):(idx+1)%list.length;await load(idx);try{await audio.play();document.getElementById("playBtn").textContent="⏸";}catch(e){document.getElementById("playBtn").textContent="▶";}}
async function prev(){if(!list.length)return;idx=isShuffle?Math.floor(Math.random()*list.length):(idx-1+list.length)%list.length;await load(idx);try{await audio.play();document.getElementById("playBtn").textContent="⏸";}catch(e){document.getElementById("playBtn").textContent="▶";}}
function toggleShuffle(){isShuffle=!isShuffle;document.getElementById("shuffleBtn").classList.toggle("active",isShuffle);}
function toggleRepeat(){isRepeat=!isRepeat;document.getElementById("repeatBtn").classList.toggle("active",isRepeat);}
function buy(){checkout();}
function openBuy(){if(!current){alert("Choose a song or beat first.");return;}const isBeat=current._pasong_type==="beat";document.getElementById("buyModalTitle").textContent=isBeat?"Buy Producer Beat":"Buy Song";document.querySelectorAll(".license").forEach(el=>{el.style.display=isBeat?"none":"flex";});document.getElementById("buyModal").classList.add("open");}
function closeBuy(){document.getElementById("buyModal").classList.remove("open");}
function selectLicense(el){document.querySelectorAll(".license").forEach(l=>l.classList.remove("active"));el.classList.add("active");selectedPrice=Number(el.dataset.price);document.getElementById("buyPrice").textContent="$"+selectedPrice;}
function checkout(){if(!current||!current.id){alert("No item is selected.");return;}const id=encodeURIComponent(current.id),isBeat=current._pasong_type==="beat";closeBuy();if(isBeat){location.href="beat-checkout.html?beat="+id;return;}location.href="pasong_checkout.html?id="+id;}
async function shareLink(){try{if(navigator.clipboard&&navigator.clipboard.writeText){await navigator.clipboard.writeText(location.href);alert("Link copied!");}else prompt("Copy this link:",location.href);}catch(e){prompt("Copy this link:",location.href);}}
function shareWA(){window.open("https://wa.me/?text="+encodeURIComponent(location.href),"_blank");}
/* Download control intentionally absent. */
document.getElementById("progressBar").addEventListener("click",e=>{const r=e.currentTarget.getBoundingClientRect(),p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));if(audio.duration)audio.currentTime=p*audio.duration;});
function addEmoji(em){const inp=document.getElementById("commentText");inp.value+=em;inp.focus();}
async function loadComments(){
  if(!current)return;
  try{
    const r=await db.from("comments").select("*").eq("song_id",current.id).order("created_at",{ascending:false}).limit(50);if(r.error)throw r.error;
    const data=r.data||[];document.getElementById("commentCount").textContent="("+data.length+")";
    if(!data.length){document.getElementById("commentsList").innerHTML="<div style='color:#666;font-size:13px;padding:10px 0'>No comments yet. Be first!</div>";return;}
    let h="";data.forEach(c=>{const name=c.username||c.user_name||"User",txt=c.text||c.comment||c.content||"",likes=c.likes||c.likes_count||0,liked=localStorage.getItem("liked_"+c.id)?"liked":"",ago=c.created_at?timeAgo(c.created_at):"";
      h+=`<div class="comment-row"><div style="width:32px;height:32px;background:#7C4DFF;border-radius:50%;display:grid;place-items:center;font-weight:900;flex-shrink:0">${escapeHTML(String(name)[0].toUpperCase())}</div><div style="flex:1"><b style="font-size:14px">${escapeHTML(name)}</b><span class="time-ago">${escapeHTML(ago)}</span><p style="font-size:13px;color:#D1D5DB;margin-top:4px">${escapeHTML(txt)}</p><div class="like-btn"><span class="${liked}" onclick="likeComment('${c.id}',${likes})">♥ ${likes} likes</span><span onclick="replyComment('${escapeHTML(name)}')">↩ Reply</span></div></div></div>`;
    });
    document.getElementById("commentsList").innerHTML=h;
  }catch(e){console.error("Comments failed to load:",e);}
}
async function likeComment(id,cur){
  if(localStorage.getItem("liked_"+id)){alert("Already liked");return;}
  try{const {error}=await db.from("comments").update({likes:cur+1,likes_count:cur+1}).eq("id",id);if(error)throw error;localStorage.setItem("liked_"+id,"1");await loadComments();}
  catch(err){alert(err.message);}
}
function replyComment(name){const inp=document.getElementById("commentText");inp.value="@"+name+" ";inp.focus();}
document.getElementById("commentText").addEventListener("keydown",async e=>{
  if(e.key!=="Enter")return;const t=e.target.value.trim();if(!t||!current)return;
  const input=e.target;input.disabled=true;input.placeholder="Posting...";
  try{
    const ud=await db.auth.getUser(),user=ud.data?.user;
    const uname=user?(user.user_metadata?.full_name||user.email?.split("@")[0]||"User"):"Guest"+Math.floor(Math.random()*900);
    const obj={song_id:current.id,text:t,comment:t,content:t,username:uname,user_name:uname,likes:0,likes_count:0};if(user)obj.user_id=user.id;
    const res=await db.from("comments").insert(obj);if(res.error)throw res.error;e.target.value="";await loadComments();
  }catch(err){alert(err.message);}
  input.disabled=false;input.placeholder="Add a comment and press Enter...";
});
init();
</script>
</body>
</html>
