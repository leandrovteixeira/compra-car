import {describe,it,expect} from 'vitest';
import {fipeModelPriority,fipeVersionEvidence} from './fipe-agent-pilot';

describe('FIPE Ford Ranger lookup priorities',()=>{
 it('accepts semantic model variants with reordered technical terms for review',()=>{
  expect(fipeVersionEvidence('XLS 3.0 4x4 V6','Ranger XLS V6 3.0 4X4 Diesel AT'))
   .toEqual({strong:true,partial:true});
 });
 it('does not treat an engine or trim mismatch as a positive identity',()=>{
  expect(fipeVersionEvidence('XLS 3.0 4x4 V6','Ranger XLS 2.0 4x4 Diesel AT').partial)
   .toBe(false);
  expect(fipeVersionEvidence('XLS 3.0 4x4 V6','Ranger XLT 3.0 V6 4x4 Diesel AT').partial)
   .toBe(false);
 });
 it('prioritizes an exact relevant FIPE version over old Ranger engine variants',()=>{
  const target={model:'Ranger',version:'XLS 3.0 4x4 V6'};
  expect(fipeModelPriority(target,'Ranger XLS 3.0 V6 4X4 Diesel'))
   .toBeGreaterThan(fipeModelPriority(target,'Ranger 2.5 4x2 CD TB Diesel'));
 });
 it('rejects other models',()=>{
  expect(fipeModelPriority({model:'Ranger',version:'XLS 3.0'},'Ford Maverick XLS 3.0')).toBe(-1);
 });
});
