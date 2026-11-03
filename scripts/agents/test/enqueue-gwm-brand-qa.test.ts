import { describe, expect, it } from 'vitest';
import { gwmDiscoveryJob, parseGwmEnqueueArgs } from '../enqueue-gwm-brand-qa';

describe('VS Code GWM QA launcher', () => {
  it('requires explicit check or enqueue flag', () => {
    expect(parseGwmEnqueueArgs(['--check'])).toEqual({enqueue:false,createdBy:null});
    expect(parseGwmEnqueueArgs(['--enqueue'])).toEqual({enqueue:true,createdBy:null});
    expect(() => parseGwmEnqueueArgs([])).toThrow('QA_PILOT_INVALID_ARGUMENTS');
    expect(() => parseGwmEnqueueArgs(['--brand','Jeep','--enqueue']))
      .toThrow('QA_PILOT_INVALID_ARGUMENTS');
  });
  it('requires UUID for attributable manual operator mode', () => {
    const id='f3fbec77-6eb3-4b59-a1e3-3537a4c709b2';
    expect(parseGwmEnqueueArgs(['--enqueue','--created-by',id]))
      .toEqual({enqueue:true,createdBy:id});
    expect(() => parseGwmEnqueueArgs(['--enqueue','--created-by','bad']))
      .toThrow('QA_PILOT_INVALID_ARGUMENTS');
  });
  it('enqueues the existing worker contract, with no direct provider usage', () => {
    const job=gwmDiscoveryJob(null);
    expect(job).toEqual({
      job_type:'BRAND_CONNECTOR',
      status:'QUEUED',
      market:'BR',
      brand:'GWM',
      created_by:null,
      input:{provider:'openai',persistFindings:true,mode:'discover',
        requestedFrom:'VSCODE_QA_GWM_PILOT'},
    });
  });
});
