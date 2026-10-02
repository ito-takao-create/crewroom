import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
const postsStore=()=>getStore("crewroom-posts",{consistency:"strong"});
const chunksStore=()=>getStore("crewroom-video-chunks",{consistency:"strong"});
const sessionsStore=()=>getStore("crewroom-sessions",{consistency:"strong"});
const usersStore=()=>getStore("crewroom-users",{consistency:"strong"});
function json(x:unknown,s=200){return new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8"}})}
async function currentUser(req:Request){const h=req.headers.get("authorization")||"";const t=h.startsWith("Bearer ")?h.slice(7).trim():"";if(!t)return null;const s:any=await sessionsStore().get(`session-${t}`,{type:"json"});if(!s||s.expiresAt<Date.now())return null;const u:any=await usersStore().get(s.userKey,{type:"json"});return u||null;}
export default async(req:Request,_context:Context)=>{
 const posts=postsStore();
 if(req.method==="GET"){
   const {blobs}=await posts.list({prefix:"post-"});
   const rows=await Promise.all(blobs.map(({key})=>posts.get(key,{type:"json"})));
   return json(rows.filter(Boolean).filter((p:any)=>p.status!=="hidden").sort((a:any,b:any)=>b.createdAt-a.createdAt));
 }
 if(req.method==="POST"){
  const u:any=await currentUser(req); if(!u)return json({error:"ログインが必要です。"},401);
  const b:any=await req.json(); const {id,title,desc="",type="無料",totalChunks,fileSize,videoName,mimeType}=b;
  if(!/^[0-9a-f-]{36}$/i.test(id||"")||!String(title||"").trim()) return json({error:"必須項目が不足しています。"},400);
  if(!Number.isInteger(totalChunks)||totalChunks<1||totalChunks>20||!Number.isFinite(fileSize)||fileSize<=0||fileSize>20*1024*1024) return json({error:"動画は20MBまでです。"},413);
  const chunks=chunksStore();
  for(let i=0;i<totalChunks;i++){if(!(await chunks.getMetadata(`${id}/${String(i).padStart(2,"0")}`))) return json({error:`動画チャンク${i+1}/${totalChunks}が見つかりません。`},400);}
  const post={id,title:String(title).trim(),desc:String(desc).trim(),by:u.name,userId:u.id,type:String(type),status:"public",totalChunks,fileSize,videoName:String(videoName||"video"),mimeType:String(mimeType||"video/mp4"),videoUrl:`/api/video?id=${encodeURIComponent(id)}`,createdAt:Date.now()};
  await posts.setJSON(`post-${id}`,post); return json(post,201);
 }
 return json({error:"Method not allowed"},405);
};
export const config:Config={path:"/api/posts"};
