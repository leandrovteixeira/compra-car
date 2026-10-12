import {describe,it,expect} from 'vitest';
import {engineeringFailureReason} from '../engineering-failure-reason';
describe('Engineering sanitized failure classifier',()=>{
 it('classifies known codes and never persists user-provided secrets',()=>{
   expect(engineeringFailureReason(new Error('OPENAI_AGENT_CONFIG_REQUIRED: sk-secret'), 'brand-connector')).toBe('CONFIGURATION');
   expect(engineeringFailureReason(new Error('CONNECTOR_RESEARCH_INVALID_OUTPUT'), 'brand-connector')).toBe('STRUCTURED_PARSE_FAILED');
   expect(engineeringFailureReason(new Error('something secret sk-123'), 'price')).toBe('PRICE_RUN_FAILED');
 });
});
