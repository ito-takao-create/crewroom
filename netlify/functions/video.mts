import { getStore, getDeployStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
function store(name:string){const c=(globalThis as any).Netlify?.context?.deploy?.context;return c==="production"?getStore(name):getDeployStore(name)}
export default async(req:Request,_context:Context)=>{
 const u=new URL(req.url),id=u.searchParams.get("id"); if(!id)return new Response("Missing id",{status:400});
 const post:any=await store("crewroom-posts").get(`post-${id}`,{type:"json"}); if(!post||post.status==="hidden")return new Response("Not found",{status:404});
 const chunks=store("crewroom-video-chunks"), size=Number(post.fileSize), total=Number(post.totalChunks), chunkSize=3*1024*1024;
 let start=0,end=size-1,status=200; const range=req.headers.get("range");
 if(range){const m=/bytes=(\d+)-(\d*)/.exec(range);if(m){start=Number(m[1]);end=m[2]?Math.min(Number(m[2]),size-1):size-1;status=206;}}
 if(start<0||start>=size||end<start)return new Response(null,{status:416,headers:{"content-range":`bytes */${size}`}});
 const first=Math.floor(start/chunkSize),last=Math.floor(end/chunkSize); const parts:Uint8Array[]=[];
 for(let i=first;i<=last&&i<total;i++){const ab=await chunks.get(`${id}/${String(i).padStart(2,"0")}`,{type:"arrayBuffer"});if(!ab)return new Response("Not found",{status:404});parts.push(new Uint8Array(ab));}
 const joined=new Uint8Array(parts.reduce((n,p)=>n+p.length,0));let off=0;for(const p of parts){joined.set(p,off);off+=p.length;} const localStart=start-first*chunkSize;const out=joined.slice(localStart,localStart+(end-start+1));
 const headers:any={"content-type":post.mimeType||"video/mp4","accept-ranges":"bytes","content-length":String(out.byteLength),"cache-control":"public, max-age=300"}; if(status===206)headers["content-range"]=`bytes ${start}-${end}/${size}`;
 return new Response(out,{status,headers});
};
export const config:Config={path:"/api/video"};
