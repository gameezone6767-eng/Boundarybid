import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import crypto from "node:crypto";
import dotenv from "dotenv";

dotenv.config();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_FILE = path.join(__dirname, "../data.json");
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: process.env.CLIENT_ORIGIN || "http://localhost:5173", methods: ["GET","POST"] } });
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

const seedPlayers = [
  ["Virat Kohli","Batter","India",200],["Rohit Sharma","Batter","India",180],
  ["Jasprit Bumrah","Bowler","India",160],["Hardik Pandya","All-rounder","India",140],
  ["Ravindra Jadeja","All-rounder","India",130],["Rishabh Pant","Wicketkeeper","India",120],
  ["Suryakumar Yadav","Batter","India",110],["KL Rahul","Wicketkeeper","India",100],
  ["Shubman Gill","Batter","India",100],["Mohammed Siraj","Bowler","India",90],
  ["Yashasvi Jaiswal","Batter","India",90],["Kuldeep Yadav","Bowler","India",85],
  ["Jos Buttler","Wicketkeeper","England",150],["Ben Stokes","All-rounder","England",130],
  ["Trent Boult","Bowler","New Zealand",120],["Kane Williamson","Batter","New Zealand",110],
  ["Glenn Maxwell","All-rounder","Australia",125],["Pat Cummins","Bowler","Australia",140],
  ["David Warner","Batter","Australia",100],["Rashid Khan","Bowler","Afghanistan",135],
  ["Nicholas Pooran","Wicketkeeper","West Indies",115],["Andre Russell","All-rounder","West Indies",145],
  ["Shaheen Afridi","Bowler","Pakistan",110],["Babar Azam","Batter","Pakistan",125]
].map((p,i)=>({id:"p"+(i+1),name:p[0],role:p[1],country:p[2],basePrice:p[3],status:"available",soldTo:null,soldPrice:0}));

function freshState(){ return { rooms: {}, players: seedPlayers }; }
let state;
try { state = JSON.parse(fs.readFileSync(DATA_FILE,"utf8")); } catch { state = freshState(); }
function save(){ fs.writeFileSync(DATA_FILE, JSON.stringify(state,null,2)); }
const id = () => crypto.randomBytes(3).toString("hex").toUpperCase();
const cleanRoom = r => ({...r, bids: r.bids.slice(-30)});
function getRoom(code){ return state.rooms[String(code||"").toUpperCase()]; }
function publicRoom(r){ return {...cleanRoom(r), players: r.players}; }
function fail(res,msg,status=400){ return res.status(status).json({error:msg}); }

app.get("/api/health",(_,res)=>res.json({ok:true,service:"BOUNDARYBID API"}));
app.get("/api/players",(_,res)=>res.json(state.players));
app.get("/api/rooms/:code",(req,res)=>{ const r=getRoom(req.params.code); if(!r)return fail(res,"Room not found",404); res.json(publicRoom(r)); });

app.post("/api/rooms",(req,res)=>{
  const {name,teamCount=4,purse=1000,ownerName="Auction Host"}=req.body||{};
  if(!name?.trim()) return fail(res,"Enter an auction name.");
  if(!Number.isInteger(Number(teamCount))||teamCount<2||teamCount>10) return fail(res,"Choose between 2 and 10 teams.");
  const code=id();
  const teams=Array.from({length:Number(teamCount)},(_,i)=>({id:"t"+(i+1),name:`${name.trim()} ${i+1}`,shortName:`T${i+1}`,owner:"",purse:Number(purse),spent:0,players:[]}));
  const roomPlayers=seedPlayers.map(p=>({...p,status:"available",soldTo:null,soldPrice:0}));
  const room={code,name:name.trim(),ownerName,teams,players:roomPlayers,currentPlayerId:roomPlayers[0].id,phase:"auction",bids:[],createdAt:new Date().toISOString(),matches:[],mode:"auction"};
  state.rooms[code]=room; save(); res.status(201).json(publicRoom(room));
});

app.post("/api/rooms/:code/join",(req,res)=>{
  const r=getRoom(req.params.code); if(!r)return fail(res,"Room not found",404);
  const {teamId,ownerName}=req.body||{};
  const team=r.teams.find(t=>t.id===teamId); if(!team)return fail(res,"Select a valid team.");
  if(team.owner && team.owner.toLowerCase()!==String(ownerName||"").trim().toLowerCase()) return fail(res,"That team already has an owner.");
  team.owner=String(ownerName||"").trim()||"Team Owner"; save(); io.to(r.code).emit("room:update",publicRoom(r)); res.json(publicRoom(r));
});

app.post("/api/rooms/:code/bid",(req,res)=>{
  const r=getRoom(req.params.code); if(!r)return fail(res,"Room not found",404);
  if(r.phase!=="auction")return fail(res,"Auction is not active.");
  const {teamId,amount,ownerName}=req.body||{};
  const team=r.teams.find(t=>t.id===teamId), player=state.players.find(p=>p.id===r.currentPlayerId);
  const value=Number(amount);
  if(!team||!player)return fail(res,"Team or player not found.");
  if(!Number.isFinite(value)||value<=0)return fail(res,"Enter a valid bid.");
  if(value<player.basePrice)return fail(res,"Bid cannot be below base price.");
  if(value>team.purse)return fail(res,"Your team does not have enough purse.");
  const highest=r.bids.filter(b=>b.playerId===player.id).reduce((m,b)=>Math.max(m,b.amount),0);
  if(value<=highest)return fail(res,"Your bid must beat the current highest bid.");
  r.bids.push({teamId,teamName:team.name,ownerName:ownerName||team.owner,playerId:player.id,playerName:player.name,amount:value,at:new Date().toISOString()});
  save(); io.to(r.code).emit("room:update",publicRoom(r)); res.json(publicRoom(r));
});

app.post("/api/rooms/:code/player/next",(req,res)=>{
  const r=getRoom(req.params.code); if(!r)return fail(res,"Room not found",404);
  if(r.phase!=="auction")return fail(res,"Auction is not active.");
  const player=r.players.find(p=>p.id===r.currentPlayerId);
  const bids=r.bids.filter(b=>b.playerId===player?.id).sort((a,b)=>b.amount-a.amount);
  if(bids.length){ const win=bids[0],team=r.teams.find(t=>t.id===win.teamId); if(team&&player){team.purse-=win.amount;team.spent+=win.amount;team.players.push({...player,soldPrice:win.amount});player.status="sold";player.soldTo=team.id;player.soldPrice=win.amount;} }
  else if(player) player.status="unsold";
  const next=r.players.find(p=>p.status==="available");
  r.currentPlayerId=next?.id||null;
  if(!next)r.phase="completed";
  r.bids=r.bids.filter(b=>b.playerId!==player?.id);
  save(); io.to(r.code).emit("room:update",publicRoom(r)); res.json(publicRoom(r));
});

app.post("/api/rooms/:code/complete",(req,res)=>{
  const r=getRoom(req.params.code); if(!r)return fail(res,"Room not found",404);
  r.phase="completed"; save(); io.to(r.code).emit("room:update",publicRoom(r)); res.json(publicRoom(r));
});

app.post("/api/rooms/:code/matches",(req,res)=>{
  const r=getRoom(req.params.code); if(!r)return fail(res,"Room not found",404);
  const {teamAId,teamBId,overs=2,mode="manual"}=req.body||{};
  if(r.phase!=="completed")return fail(res,"Finish the auction before creating matches.");
  if(teamAId===teamBId)return fail(res,"Choose two different teams.");
  const a=r.teams.find(t=>t.id===teamAId),b=r.teams.find(t=>t.id===teamBId);
  if(!a||!b)return fail(res,"Select two valid teams.");
  if(![2,5,10,15,20].includes(Number(overs)))return fail(res,"Invalid overs format.");
  const match={id:id(),teamAId,teamBId,overs:Number(overs),mode,innings:1,scoreA:0,wicketsA:0,ballsA:0,scoreB:0,wicketsB:0,ballsB:0,events:[],status:"live",createdAt:new Date().toISOString()};
  r.matches.unshift(match); save(); io.to(r.code).emit("room:update",publicRoom(r)); res.status(201).json({room:publicRoom(r),match});
});

app.post("/api/rooms/:code/matches/:matchId/ball",(req,res)=>{
  const r=getRoom(req.params.code); if(!r)return fail(res,"Room not found",404);
  const m=r.matches.find(x=>x.id===req.params.matchId); if(!m)return fail(res,"Match not found",404);
  if(m.status!=="live")return fail(res,"Match has finished.");
  const {runs=0,wicket=false,wide=false,noBall=false,note=""}=req.body||{};
  let batRuns=Number(runs); if(!Number.isInteger(batRuns)||batRuns<0||batRuns>6)return fail(res,"Runs must be between 0 and 6.");
  const extra=wide||noBall?1:0, legal=!wide&&!noBall;
  const prefix=m.innings===1?"A":"B", scoreKey="score"+prefix, wicketKey="wickets"+prefix, ballsKey="balls"+prefix;
  m[scoreKey]+=batRuns+extra; if(wicket)m[wicketKey]++; if(legal)m[ballsKey]++;
  m.events.push({innings:m.innings,runs:batRuns,extra,wicket,wide,noBall,note,at:new Date().toISOString()});
  const maxBalls=m.overs*6;
  if(m[wicketKey]>=10||m[ballsKey]>=maxBalls){
    if(m.innings===1){m.innings=2;}
    else {m.status="completed";m.winner=m.scoreA>m.scoreB?m.teamAId:m.scoreB>m.scoreA?m.teamBId:"tie";}
  }
  if(m.innings===2&&m.scoreB>m.scoreA){m.status="completed";m.winner=m.teamBId;}
  save(); io.to(r.code).emit("room:update",publicRoom(r)); res.json({room:publicRoom(r),match:m});
});

io.on("connection",socket=>{
  socket.on("room:join",code=>{const c=String(code||"").toUpperCase();if(getRoom(c)){socket.join(c);socket.emit("room:update",publicRoom(getRoom(c)));}});
});
const PORT=process.env.PORT||4000;
server.listen(PORT,()=>console.log(`BOUNDARYBID API running on http://localhost:${PORT}`));
