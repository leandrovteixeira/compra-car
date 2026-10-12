/** Classify only known operational error *codes*. Never persist error messages or stack traces. */
const categories: readonly [RegExp,string][]=[
 [/^(?:COST_|PRICE_MODEL_PRICING_)/u,'COST_GOVERNANCE'],
 [/^(?:CONNECTOR_RESEARCH_NO_WEB_SEARCH|ENGINEERING_UNSUPPORTED_SOURCE)/u,'SOURCE_ROUTING'],
 [/^(?:CONNECTOR_RESEARCH_INVALID_OUTPUT|STRUCTURED_|PRICE_PARSE_)/u,'STRUCTURED_PARSE_FAILED'],
 [/^(?:CONNECTOR_SCOPE_MISMATCH|PRICE_IDENTITY_)/u,'IDENTITY_MISMATCH'],
 [/^(?:BRAND_CONNECTOR_REQUIRED|CONNECTOR_READ_FAILED)/u,'SOURCE_ROUTING'],
 [/^(?:SUPABASE_|COST_ACCOUNTING_FAILED)/u,'INFRASTRUCTURE'],
 [/^(?:OPENAI_AGENT_CONFIG_REQUIRED|SUPABASE_AGENT_CONFIG_REQUIRED)/u,'CONFIGURATION'],
];
/** Bounded allowlisted classification, never echoes untrusted exception content. */
export function engineeringFailureReason(error:unknown,agent:'brand-connector'|'mmv-discovery'|'price'):string {
 const message=error instanceof Error?error.message:'';
 const code=message.split(/[:\s]/u,1)[0]??'';
 if(!/^[A-Z][A-Z0-9_]{2,100}$/u.test(code))return agent.toUpperCase().replace(/-/gu,'_')+'_RUN_FAILED';
 for(const [re,kind] of categories)if(re.test(code))return kind;
 return agent.toUpperCase().replace(/-/gu,'_')+'_RUN_FAILED';
}
