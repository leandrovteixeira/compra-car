import {describe,expect,it} from 'vitest';
import {selectGenerationEvidencePair,type GenerationVisualAsset} from '../src/agents/generation-evidence-collector';

const hash=(n:string)=>n.repeat(64);
const asset=(year:number,patch:Partial<GenerationVisualAsset>={}):GenerationVisualAsset=>({
  brand:'Ford',model:'Ranger',version:'Limited',modelYear:year,
  sourceUrl:'https://www.ford.com.br/picapes/ranger/'+year,
  assetUrl:'https://media.ford.com.br/ranger-'+year+'.jpg',
  sha256:hash(year===2026?'a':'b'),capturedAt:'2026-11-05T12:00:00Z',
  view:'FRONT_THREE_QUARTER',verifiedModelYear:true,verifiedModel:true,
  sourceAuthority:'MANUFACTURER',...patch,
});
const base={brand:'Ford',model:'Ranger',previousModelYear:2026,currentModelYear:2027,
  officialHosts:['ford.com.br'],assets:[asset(2026),asset(2027)]};
describe('Generation Evidence Collector',()=>{
  it('selects verified comparable official historic images',()=>{
    const r=selectGenerationEvidencePair(base);
    expect(r.status).toBe('READY');
    if(r.status==='READY'){
      expect(r.pair.previous.modelYear).toBe(2026);
      expect(r.pair.current.modelYear).toBe(2027);
    }
  });
  it('refuses a missing predecessor',()=>{
    expect(selectGenerationEvidencePair({...base,assets:[asset(2027)]})).toEqual({
      status:'UNKNOWN',reason:'NO_COMPARABLE_OFFICIAL_IMAGES',
    });
  });
  it('refuses an MY inferred only from the filename',()=>{
    expect(selectGenerationEvidencePair({...base,assets:[asset(2026,{verifiedModelYear:false}),asset(2027)]})).toEqual({
      status:'UNKNOWN',reason:'UNVERIFIED_MODEL_YEAR',
    });
  });
  it('rejects off-brand third party and dealer assets',()=>{
    expect(selectGenerationEvidencePair({...base,assets:[
      asset(2026,{sourceUrl:'https://notford.com.br/ranger'}),
      asset(2027),
    ]}).status).toBe('UNKNOWN');
    expect(selectGenerationEvidencePair({...base,assets:[
      asset(2026,{sourceAuthority:'DEALER'}),asset(2027),
    ]}).status).toBe('UNKNOWN');
  });
  it('detects reused image hash relabelled as another MY',()=>{
    expect(selectGenerationEvidencePair({...base,assets:[
      asset(2026),asset(2027,{sha256:hash('a')}),
    ]})).toEqual({status:'UNKNOWN',reason:'AMBIGUOUS_MODEL_YEAR_BINDING'});
  });
  it('does not match incomparable views',()=>{
    expect(selectGenerationEvidencePair({...base,assets:[
      asset(2026,{view:'SIDE'}),asset(2027,{view:'INTERIOR'}),
    ]}).status).toBe('UNKNOWN');
  });
  it('prefers side view if multiple views exist',()=>{
    const r=selectGenerationEvidencePair({...base,assets:[
      ...base.assets,asset(2026,{view:'SIDE',sha256:hash('c')}),
      asset(2027,{view:'SIDE',sha256:hash('d')}),
    ]});
    expect(r.status==='READY'&&r.pair.view).toBe('SIDE');
  });
  it('refuses reversed years',()=>{
    expect(()=>selectGenerationEvidencePair({...base,previousModelYear:2027,currentModelYear:2026}))
      .toThrow('GENERATION_EVIDENCE_INPUT_INVALID');
  });
});
