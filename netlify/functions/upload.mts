import { getStore } from "@netlify/blobs";
import type { Config, Context } from "@netlify/functions";
const store = () => getStore("crewroom-video-chunks", { consistency: "strong" });
function json(x:unknown,s=200){return new Response(JSON.stringify(x),{status:s,headers:{"content-type":"application/json; charset=utf-8"}})}
export default async (req:Request,_context:Context)=>{
 if(req.method!=="POST") return json({error:"Method not allowed"},405);
 const u=new URL(req.url), id=u.searchParams.get("id")||"", index=Number(u.searchParams.get("index")), total=Number(u.searchParams.get("total"));
 if(!/^[0-9a-f-]{36}$/i.test(id)||!Number.isInteger(index)||index<0||!Number.isInteger(total)||total<1||total>20||index>=total) return json({error:"Invalid upload"},400);
 const body=await req.arrayBuffer();
 if(body.byteLength<=0||body.byteLength>1024*1024) return json({error:`Chunk too large: ${body.byteLength}`},413);
 await store().set(`${id}/${String(index).padStart(2,"0")}`,body);
 return json({ok:true,index,size:body.byteLength});
};
export const config:Config={path:"/api/upload"};
