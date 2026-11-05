/** PBEV structured evidence adapter, pure and review-only.
 * Accepts rows from a vetted official-table extraction, never screenshots or
 * free text pretending to be a measured vehicle value.
 */
export type PbevFuel27='DIESEL'|'GASOLINE'|'ETHANOL'|'ELECTRIC';
export type PbevMetric27='EFFICIENCY_MJ_KM'|'CITY_KM_L'|'HIGHWAY_KM_L'|'COMBINED_KM_L';
export type PbevSourceRow27=Readonly<{
  sourceEditionYear:number;
  sourceUrl:string;
  documentSha256:string;
  sourcePage:number;
  brand:string;
  model:string;
  version:string;
  engine:string;
  transmission:string;
  fuel:PbevFuel27;
  cityKmL:number|null;
  highwayKmL:number|null;
  combinedKmL:number|null;
  energyMjKm:number|null;
}>;
export type PbevMmvIdentity27=Readonly<{
  brand:string;model:string;version:string;engine:string;
  transmission:string;modelYear:number;
}>;
export type PbevObservation27=Readonly<{
  metric:PbevMetric27;fuel:PbevFuel27;
  value:number;unit:'MJ/km'|'km/L';
  canonicalCode:string|null;
  sourcePage:number;sourceDocumentSha256:string;
  disposition:'REVIEW_ONLY';
}>;
export type PbevMatchAssessment27=Readonly<{
  match:'REVIEW_REQUIRED'|'ABSTAIN';
  reasons:readonly string[];
  observations:readonly PbevObservation27[];
}>;
const normalized=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
  .toLowerCase().replace(/[^a-z0-9]+/gu,' ').trim();
const officialSource=(url:string)=>{
  try{const u=new URL(url);return u.protocol==='https:'&&
    !u.username&&!u.password&&u.hostname==='www.gov.br'&&
    u.pathname.startsWith('/inmetro/');}catch{return false;}
};
const finiteNonnegative=(n:number|null)=>n===null||
  (typeof n==='number'&&Number.isFinite(n)&&n>0&&n<1000);
export function inspectPbevSourceRow27(
  row:PbevSourceRow27,identity:PbevMmvIdentity27
):PbevMatchAssessment27{
 if(!row||!Number.isInteger(row.sourceEditionYear)||row.sourceEditionYear<2020||
   row.sourceEditionYear>2100||!officialSource(row.sourceUrl)||
   !/^[a-f0-9]{64}$/u.test(row.documentSha256)||
   !Number.isInteger(row.sourcePage)||row.sourcePage<1||
   !row.brand?.trim()||!row.model?.trim()||!row.version?.trim()||
   !row.engine?.trim()||!row.transmission?.trim()||
   !['DIESEL','GASOLINE','ETHANOL','ELECTRIC'].includes(row.fuel)||
   ![row.cityKmL,row.highwayKmL,row.combinedKmL,row.energyMjKm].every(finiteNonnegative))
   throw new Error('PBEV_SOURCE_INVALID');
 const reasons:string[]=[];
 if(normalized(row.brand)!==normalized(identity.brand))reasons.push('BRAND_MISMATCH');
 if(normalized(row.model)!==normalized(identity.model))reasons.push('MODEL_MISMATCH');
 if(normalized(row.version)!==normalized(identity.version))reasons.push('VERSION_MISMATCH');
 if(normalized(row.engine)!==normalized(identity.engine))reasons.push('ENGINE_MISMATCH');
 if(normalized(row.transmission)!==normalized(identity.transmission))reasons.push('TRANSMISSION_MISMATCH');
 // The PBEV edition is not a certificate of an MY. Treat every cross-year
 // link as unverified until a separately attested MY-specific binding exists.
 if(identity.modelYear!==row.sourceEditionYear)reasons.push('MY_NOT_VERIFIED_BY_PBEV');
 if(reasons.length)return {match:'ABSTAIN',reasons,observations:[]};
 const specs:readonly [PbevMetric27,number|null,'MJ/km'|'km/L',string|null][]=[
  ['EFFICIENCY_MJ_KM',row.energyMjKm,'MJ/km','OW_0001'],
  ['CITY_KM_L',row.cityKmL,'km/L',row.fuel==='GASOLINE'?'OW_0002':row.fuel==='ETHANOL'?'OW_0004':null],
  ['HIGHWAY_KM_L',row.highwayKmL,'km/L',row.fuel==='GASOLINE'?'OW_0003':row.fuel==='ETHANOL'?'OW_0005':null],
  ['COMBINED_KM_L',row.combinedKmL,'km/L',null],
 ];
 return {match:'REVIEW_REQUIRED',reasons:['SOURCE_PBEV_NOT_PRODUCT_CONFIRMATION'],
  observations:specs.filter(([,value])=>value!==null).map(([metric,value,unit,canonicalCode])=>({
    metric,fuel:row.fuel,value:value!,unit,canonicalCode,
    sourcePage:row.sourcePage,sourceDocumentSha256:row.documentSha256,
    disposition:'REVIEW_ONLY'
  }))
 };
}
