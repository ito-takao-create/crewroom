import { getStore, getDeployStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
function store(name:string){const c=(globalThis as any).Netlify?.context?.deploy?.context;return c==="production"?getStore(name,{consistency:"strong"}):getDeployStore(name)}
function json(x:unknown,s=200){return new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8"}})}
export default async (req:Request,_context:Context)=>{
 if(req.method!=="POST") return json({error:"Method not allowed"},405);
 const u=new URL(req.url), id=u.searchParams.get("id")||"", index=Number(u.searchParams.get("index")), total=Number(u.searchParams.get("total"));
 if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isInteger(index)||index<0||!Number.isInteger(total)||total<1||total>7||index>=total) return json({error:"Invalid upload"},400);
 const len=Number(req.headers.get("content-length")||0); if(len>3*1024*1024) return json({error:"Chunk too large"},413);
 const body=await req.arrayBuffer(); if(body.byteLength>3*1024*1024) return json({error:"Chunk too large"},413);
 await store("crewroom-video-chunks").set(`${id}/${String(index).padStart(2,"0")}`,body);
 return json({ok:true,index});
};
export const config:Config={path:"/api/upload",rateLimit:{windowSize:60,windowLimit:120,aggregateBy:["ip"]}};
