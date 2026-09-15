import { getStore, getDeployStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
function store(name:string){const c=(globalThis as any).Netlify?.context?.deploy?.context;return c==="production"?getStore(name,{consistency:"strong"}):getDeployStore(name)}
function json(x:unknown,s=200){return new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8"}})}
export default async(req:Request,_context:Context)=>{
 const posts=store("crewroom-posts");
 if(req.method==="GET"){const {blobs}=await posts.list({prefix:"post-"});const rows=await Promise.all(blobs.map(({key})=>posts.get(key,{type:"json"})));return json(rows.filter(Boolean).filter((p:any)=>p.status!=="hidden").sort((a:any,b:any)=>b.createdAt-a.createdAt));}
 if(req.method==="POST"){
  const b:any=await req.json(); const {id,title,desc="",by,type="無料",totalChunks,fileSize,videoName,mimeType}=b;
  if(!/^[0-9a-f-]{36}$/i.test(id||"")||!String(title||"").trim()||!String(by||"").trim()) return json({error:"必須項目が不足しています。"},400);
  if(!Number.isInteger(totalChunks)||totalChunks<1||totalChunks>7||!Number.isFinite(fileSize)||fileSize<=0||fileSize>20*1024*1024) return json({error:"動画は20MBまでです。"},413);
  const chunks=store("crewroom-video-chunks"); for(let i=0;i<totalChunks;i++){if(!(await chunks.getMetadata(`${id}/${String(i).padStart(2,"0")}`))) return json({error:"動画アップロードが完了していません。"},400);}
  const post={id,title:String(title).trim(),desc:String(desc).trim(),by:String(by).trim(),type:String(type),status:"public",totalChunks,fileSize,videoName:String(videoName||"video"),mimeType:String(mimeType||"video/mp4"),videoUrl:`/api/video?id=${encodeURIComponent(id)}`,createdAt:Date.now()};
  await posts.setJSON(`post-${id}`,post); return json(post,201);
 }
 return json({error:"Method not allowed"},405);
};
export const config:Config={path:"/api/posts"};
