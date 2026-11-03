import {describe,it,expect} from 'vitest';
import {buildLaunchingMap,type LaunchEvidence} from '../src/agents/watcher-launching-map';
const e=(overrides:Partial<LaunchEvidence>={}):LaunchEvidence=>({
 revisionId:'rev-1',brand:'MG',model:'IM 6',market:'BR',category:'MARKET_ENTRY',
 uncertain:false,quote:'MG IM 6 chega ao Brasil',expectedStart:'2027-06',
 precision:'MONTH',...overrides});
describe('Watcher 24C launching map engine',()=>{
 it('groups versions of one brand/model and keeps evidence',()=>{
  const rows=buildLaunchingMap([e({version:'A'}),e({revisionId:'rev-2',version:'B'})],[],'2026-10');
  expect(rows).toHaveLength(1);
  expect(rows[0]).toMatchObject({state:'PROBABLE',visible:true,revisions:['rev-1','rev-2'],versions:['A','B']});
 });
 it('closes every projected version when first approved MMV arrives',()=>{
  const rows=buildLaunchingMap([e({version:'A'}),e({version:'B'})],
    [{id:'mmv-1',brand:'MG',model:'IM 6',approved:true}],'2026-10');
  expect(rows[0]).toMatchObject({state:'CLOSED',visible:false,closedByMmvId:'mmv-1',versions:['A','B']});
 });
 it('does not close for unapproved or different model',()=>{
  const rows=buildLaunchingMap([e()],
    [{id:'mmv-1',brand:'MG',model:'IM 6',approved:false},{id:'mmv-2',brand:'MG',model:'ZS',approved:true}],'2026-10');
  expect(rows[0]?.closedByMmvId).toBeNull();
 });
 it('excludes rumors and foreign launches from main map',()=>{
  expect(buildLaunchingMap([e({uncertain:true}),e({market:'FOREIGN',model:'X'})],[],'2026-10')
    .every(x=>!x.visible)).toBe(true);
 });
 it('preserves uncertainty in dates rather than inventing month',()=>{
  const rows=buildLaunchingMap([e({expectedStart:null,precision:'YEAR'})],[],'2026-10');
  expect(rows[0]).toMatchObject({start:null,end:null,precision:'YEAR'});
 });
});
