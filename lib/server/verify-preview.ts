import type { RadarPreview, SourceVerification } from "../types";
import { correctedSourceUrl, sourceDateExpired, sourceMayRecommend } from "../source-policy";
import { checkSource } from "./source-checker";
import { hydrateAihotPreview } from "./aihot";

type Sourced = {id:string;title?:string;name?:string;url:string|null;sourceId?:string;deadline?:string|null;when?:string|null;opensAt?:string|null;availability?:string;status?:string;reviewedAt?:string;verification?:SourceVerification};
type Checker = (url:string)=>Promise<SourceVerification>;

/** Used for new reports, already-saved web reports, Ask context and unsent email retries.
 * Never probes personal Canvas, calendars or user-forwarded private URLs.
 */
export async function verifyRadarPreview(preview:RadarPreview, now=new Date(), checker:Checker=checkSource):Promise<RadarPreview> {
  if(preview.aihotOptIn || preview.aihotRefs?.length || preview.aiNews?.some(x=>x.sourceId==="aihot"))preview=await hydrateAihotPreview(preview);
  const zh=preview.language==="zh";
  const withheld:NonNullable<RadarPreview["sourceChecks"]>["withheld"]=[];
  const decisions=new Map<string,SourceVerification>();
  const publicItems=(preview.opportunities||[]).filter(item=>item.campusScope==="umich" || item.id.startsWith("umich-"));
  const fieldSources=(preview.fieldInsight?.sources||[]).map((source,index)=>({...source,id:`field-source-${index}`,title:source.label}));
  const work:{item:Sourced;event?:boolean;job?:boolean}[]=[
    ...(preview.researchLabs?.matches||[]).map(item=>({item})),
    ...(preview.scholarships||[]).map(item=>({item})),
    ...(preview.careerJobs||[]).map(item=>({item,job:true})),
    ...(preview.umichCareerEvents||[]).map(item=>({item,event:true})),
    ...(preview.campusEvents||[]).map(item=>({item,event:true})),
    ...(preview.externalEvents||[]).map(item=>({item,event:true})),
    ...(preview.businessNews||[]).map(item=>({item})),
    ...(preview.aiNews||[]).map(item=>({item})),
    ...publicItems.map(item=>({item,event:true})),
    ...fieldSources.map(item=>({item})),
  ];
  const key=(item:Sourced)=>`${item.id}|${item.url}`;
  let index=0;
  await Promise.all(Array.from({length:6},async()=>{
    for(;;){const entry=work[index++];if(!entry)break;const {item}=entry;
      const failure=(status:SourceVerification["status"],reason:string):SourceVerification=>({status,reason,checkedAt:now.toISOString(),httpStatus:null,finalUrl:null});
      let check:SourceVerification;
      const rawDate=item.deadline || (entry.event ? item.when || item.opensAt : null);
      // Old public event display strings use YYYY-MM-DD · HH:MM; keep the known date only.
      const date=rawDate?.replace(/^(\d{4}-\d{2}-\d{2}) · .*$/,"$1");
      if(item.sourceId==="aihot" && item.verification?.status==="feed_verified")check=item.verification;
      else if(item.availability==="closed" || entry.job && item.status==="closed") check=failure("closed","Record is explicitly closed.");
      else if(item.availability==="needs_review") check=failure("needs_review","Changed source facts are awaiting review.");
      else if(date && !Number.isFinite(Date.parse(date))) check=failure("needs_review","Recorded date is invalid; no replacement deadline was invented.");
      else if(date && sourceDateExpired(date,now)) check=failure("expired","Known deadline/event time has passed.");
      else if(entry.job && item.status!=="open") check=failure("needs_review","Job status is awaiting review.");
      else if((entry.job || entry.event && item.reviewedAt) && (!item.reviewedAt || !Number.isFinite(Date.parse(item.reviewedAt)) || now.getTime()-Date.parse(item.reviewedAt)>7*86400000)) check=failure("needs_review","Snapshot is no longer within its seven-day review window.");
      else if(!item.url) check=failure("needs_review","Original source URL is missing.");
      else {try{check=await checker(correctedSourceUrl(item.url));}catch{check=failure("unavailable","Source checker failed; not treated as an open opportunity.");}}
      if(sourceMayRecommend(check) && check.sourceDeadline && sourceDateExpired(check.sourceDeadline,now)) check={...check,status:"expired",reason:"Source-provided listing deadline has passed."};
      decisions.set(key(item),check);
      if(!sourceMayRecommend(check) && !withheld.some(row=>row.id===item.id)) withheld.push({id:item.id,title:item.title||item.name||"Source needs review",url:item.url && check.status!=="unsupported"?correctedSourceUrl(item.url):null,verification:check});
    }
  }));
  function clean<T extends Sourced>(rows:T[]|undefined):T[]|undefined {
    return rows?.flatMap(item=>{
      const check=decisions.get(key(item));
      if(!check)return [item];
      return sourceMayRecommend(check)?[{...item,url:item.url?correctedSourceUrl(item.url):null,verification:check}]:[];
    });
  }
  const labs=(clean(preview.researchLabs?.matches)||[]).map(lab=>{
    if(lab.status==="official_undergrad_pathway" || now.getTime()-Date.parse(lab.verifiedAt)<=7*86400000)return lab;
    return {...lab,status:"contact_to_confirm" as const,statusLabel:zh?"此前欢迎本科生，当前招募需重新确认":"Previously welcomed undergraduates; reconfirm recruitment",nextAction:zh?"先查看当前招募状态，再决定是否联系；不默认仍有空缺。":"Check current recruitment status before contacting the lab; an opening is not assumed."};
  });
  const removed=new Set(withheld.map(row=>row.id));
  const result:RadarPreview={...preview,
    sourceChecks:{policyVersion:1,checkedAt:now.toISOString(),withheld},
    researchLabs:{...preview.researchLabs,matches:labs},
    scholarships:clean(preview.scholarships),careerJobs:clean(preview.careerJobs),
    umichCareerEvents:clean(preview.umichCareerEvents),externalEvents:clean(preview.externalEvents),
    campusEvents:clean(preview.campusEvents),
    businessNews:clean(preview.businessNews),aiNews:clean(preview.aiNews),
    opportunities:clean(preview.opportunities)||[],
    actions:(preview.actions||[]).filter(item=>!removed.has(item.id)&&!removed.has(item.id.replace(/^research-/,""))),
    ...(preview.fieldInsight?{fieldInsight:{...preview.fieldInsight,sources:(clean(fieldSources)||[]).map(item=>({label:item.label,url:item.url}))}}:{}),
  };
  if(preview.emailUpdates) {
    // Guard the saved change markers too; the renderer uses them only for labels,
    // while the verified full shortlist remains the content sent to the student.
    const checked=await verifyRadarPreview({...preview,...preview.emailUpdates,aihotRefs:preview.emailUpdates.aihotRefs || [],emailUpdates:undefined},now,checker);
    result.emailUpdates={researchLabs:checked.researchLabs,scholarships:checked.scholarships,careerJobs:checked.careerJobs,umichCareerEvents:checked.umichCareerEvents,campusEvents:checked.campusEvents,externalEvents:checked.externalEvents,businessNews:checked.businessNews,aiNews:checked.aiNews,aihotRefs:checked.aihotRefs,opportunities:checked.opportunities};
  }
  return result;
}
