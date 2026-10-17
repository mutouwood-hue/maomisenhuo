import { parseApiTime } from './life-provider.js';
export function eligibilityAllows(value,scope,now=Date.now()){
 if(!value||value.status!=='ELIGIBLE'||!['UNDER_14','14_PLUS'].includes(value.ageBand)||value[scope!=='environment'?'isLocationEligible':'isEnvironmentEligible']!==true)return false;
 try{return typeof value.expiresAt==='string'&&parseApiTime(value.expiresAt)>now;}catch{return false;}
}
export async function readEligibility(api){try{return await api.request('/api/privacy-eligibility');}catch(error){if(error.status===401)throw error;return {status:'UNCONFIGURED',ageBand:'UNKNOWN',isLocationEligible:false,isEnvironmentEligible:false,expiresAt:null};}}
export async function requireEligibility(api,scope,onStatus=()=>{}){const value=await readEligibility(api);onStatus(`${value.status} · ${value.ageBand}（14_PLUS不表示成年）；资格来自可信服务，不能自行声明监护验证。`);if(!eligibilityAllows(value,scope))throw new Error('可信年龄/监护资格未就绪或过期，不能开启位置或环境；关闭与清除仍可用。');return value;}
