import {describe,it,expect} from 'vitest';
import {selectOfficialLaunchPages} from '../mmv-launch-watch';

const entries=[
 {type:'MODEL_PAGE',url:'https://www.gwmmotors.com.br/pt/modelos/haval-h6-phev-19'},
 {type:'MODEL_PAGE',url:'https://www.gwmmotors.com.br/pt/modelos/haval-h6-phev-35'},
 {type:'MODEL_PAGE',url:'https://www.gwmmotors.com.br/pt/modelos/haval-h6-hev-one'},
 {type:'MODEL_PAGE',url:'https://www.gwmmotors.com.br/pt/modelos/tank-300'},
 {type:'MODEL_PAGE',url:'https://www.gwmmotors.com.br/pt/modelos/tank-300-terraforce'},
 {type:'MEDIA_CENTER',url:'https://www.gwmmotors.com.br/pt/media-center/haval-h6-phev-19'},
];
describe('targeted launch watch uses only the approved MMV and model page',()=>{
 it('picks PHEV19 without sibling versions',()=>{
  expect(selectOfficialLaunchPages({model:'HAVAL H6',official_version_label:'PHEV19'},entries))
   .toEqual(['https://www.gwmmotors.com.br/pt/modelos/haval-h6-phev-19']);
 });
 it('matches approved TerraForce separately from generic TANK 300',()=>{
  expect(selectOfficialLaunchPages({model:'TANK 300',official_version_label:'TerraForce'},entries))
   .toEqual(['https://www.gwmmotors.com.br/pt/modelos/tank-300-terraforce']);
  expect(selectOfficialLaunchPages({model:'TANK 300',official_version_label:null},entries))
   .toEqual(['https://www.gwmmotors.com.br/pt/modelos/tank-300']);
 });
 it('never searches unrelated model or media pages',()=>{
  expect(selectOfficialLaunchPages({model:'Haval H7',official_version_label:null},entries))
   .toEqual([]);
 });
});
