export function validateRules(value) {
  if(!value||typeof value.enabled!=='boolean'||!Array.isArray(value.rules)||value.rules.length>20)throw new Error('Use up to 20 writing rules.');
  const rules=value.rules.map(rule=>{
    if(typeof rule!=='string'||!rule.trim()||rule.trim().length>500)throw new Error('Each rule needs 1–500 characters.');
    return rule.trim();
  });
  if(new Set(rules).size!==rules.length)throw new Error('Remove duplicate rules.');
  if(value.autoLearn!==undefined && typeof value.autoLearn!=='boolean')throw new Error('Invalid automatic rules setting.');
  return {enabled:value.enabled,rules,...(value.autoLearn===undefined?{}:{autoLearn:value.autoLearn})};
}
export function activeRules(value) { return value?.enabled?validateRules(value).rules:[]; }
export function checkItems(items,rules=[]) {
  return [...items,...rules.map((text,index)=>({id:`rule-${index}`,type:'writing_rule',text,source:{kind:'rule',label:'Writing rule'}}))];
}
export function rulesPrompt(rules=[]) {
  return rules.length?`\n\n[Lossless Rewrite: my writing rules]\nApply these writing preferences to the complete reply. Keep the protected claims accurate. If a rule conflicts with my current request or protected information, explain the conflict. Do not silently discard information to satisfy style.\n${JSON.stringify(rules)}`:'';
}
