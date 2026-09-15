import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
const posts=()=>getStore("crewroom-posts",{consistency:"strong"});
const chunks=()=>getStore("crewroom-video-chunks",{consistency:"strong"});
export default async(req:Request,_context:Context)=>{
 const u=new URL(req.url),id=u.searchParams.get("id"); if(!id)return new Response("Missing id",{status:400});
 const post:any=await posts().get(`post-${id}`,{type:"json"}); if(!post||post.status==="hidden")return new Response("Not found",{status:404});
 const size=Number(post.fileSize), total=Number(post.totalChunks), chunkSize=1024*1024, MAX_RESPONSE=1024*1024;
 let start=0,end=Math.min(size-1,MAX_RESPONSE-1),status=206;
 const range=req.headers.get("range");
 if(range){
   const m=/bytes=(\d+)-(\d*)/.exec(range);
   if(m){
     start=Number(m[1]);
     const requestedEnd=m[2]?Math.min(Number(m[2]),size-1):size-1;
     end=Math.min(requestedEnd,start+MAX_RESPONSE-1);
   }
 }
 if(start<0||start>=size||end<start)return new Response(null,{status:416,headers:{"content-range":`bytes */${size}`}});
 const first=Math.floor(start/chunkSize),last=Math.floor(end/chunkSize); const parts:Uint8Array[]=[];
 const c=chunks();
 for(let i=first;i<=last&&i<total;i++){
   const ab=await c.get(`${id}/${String(i).padStart(2,"0")}`,{type:"arrayBuffer"});
   if(!ab)return new Response("Not found",{status:404});
   parts.push(new Uint8Array(ab));
 }
 const joined=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let off=0;for(const p of parts){joined.set(p,off);off+=p.length;}
 const localStart=start-first*chunkSize;const out=joined.slice(localStart,localStart+(end-start+1));
 const headers:any={"content-type":post.mimeType||"video/mp4","accept-ranges":"bytes","content-length":String(out.byteLength),"content-range":`bytes ${start}-${end}/${size}`,"cache-control":"public, max-age=300"};
 return new Response(out,{status,headers});
};
export const config:Config={path:"/api/video"};
