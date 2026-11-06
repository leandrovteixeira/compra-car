/** Pure verification gate for a Ford BR version-specific official page.
 * The operator can attest a page only when exact MY and full mechanical
 * variant occur together in the version heading; the catalogue's date,
 * breadcrumbs, generic model text, and sibling versions are NOT sufficient.
 */
export type FordXls2027SourceAssessment=Readonly<{
  status:'VERIFIED_FOR_REVIEW'|'ABSTAIN';
  reason:string;
  vehicle:{brand:'Ford';model:'Ranger';version:'XLS 3.0 V6 Diesel 4WD AT';modelYear:2027};
  evidence:readonly {field:string;value:string;sourceExcerpt:string}[];
}>;
export const FORD_XLS_2027_URL=
  'https://www.ford.com.br/picapes/ranger/compare-as-versoes/xls-3-0-diesel-4wd-at/';
const fold=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/gu,'')
  .replace(/\s+/gu,' ').toLowerCase().trim();
/** Input is the extracted visible main content of the specific version page.
 * Evidence is read-only: NEVER imports a generic equipment matrix to a MY.
 */
export function auditFordXls2027VersionPage(input:{
  sourceUrl:string;heading:string;visibleMainText:string;
}):FordXls2027SourceAssessment{
 const vehicle={brand:'Ford' as const,model:'Ranger' as const,
  version:'XLS 3.0 V6 Diesel 4WD AT' as const,modelYear:2027 as const};
 const abstain=(reason:string):FordXls2027SourceAssessment=>({
  status:'ABSTAIN',reason,vehicle,evidence:[]
 });
 if(input.sourceUrl!==FORD_XLS_2027_URL)return abstain('UNVERIFIED_SOURCE_URL');
 const heading=fold(input.heading);
 if(!/\bxls\b/u.test(heading)||!/\b3[.,]?0\b/u.test(heading)||
    !/\bv6\b/u.test(heading)||!/diesel/u.test(heading)||
    !/4wd/u.test(heading)||!/(?:\bat\b|autom[aá]tica)/u.test(heading)||
    !/\b2027\b/u.test(heading))
  return abstain('MODEL_YEAR_OR_VERSION_HEADING_MISSING');
 const body=fold(input.visibleMainText);
 // Whole-page text can contain other trims: do not treat its presence as
 // evidence of equipment availability on the XLS.
 if(body.length<100||body.length>250000)return abstain('SOURCE_TEXT_INVALID');
 const checks:readonly [string,RegExp,string][]=[
  ['powertrain',/3[.,]0\s*v6\s*(?:turbo\s*)?diesel/u,'3.0 V6 diesel'],
  ['power',/\b250\s*cv\b/u,'250 cv'],
  ['torque',/\b600\s*nm\b/u,'600 Nm'],
  ['transmission',/(?:autom[aá]tica\s*de\s*10\s*velocidades|transmiss[aã]o\s*autom[aá]tica\s*de\s*10)/u,'AT 10 velocidades'],
 ];
 const evidence=checks.flatMap(([field,pattern,value])=>{
  const m=pattern.exec(body);
  return m?[{field,value,sourceExcerpt:input.visibleMainText.slice(
   Math.max(0,m.index-90),Math.min(input.visibleMainText.length,m.index+m[0].length+120)
  )}]:[];
 });
 if(evidence.length<3)return abstain('INSUFFICIENT_VERSION_TECHNICAL_EVIDENCE');
 return {status:'VERIFIED_FOR_REVIEW',reason:'OFFICIAL_VERSION_HEADING_AND_EVIDENCE',
  vehicle,evidence};
}
