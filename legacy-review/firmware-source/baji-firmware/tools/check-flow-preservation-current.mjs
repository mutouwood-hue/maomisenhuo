import fs from 'node:fs';
const root='C:/Users/admin/AppData/Local/Temp/dsh-spill-7KM5PE/session-1929880fa805/';
const a=JSON.parse(fs.readFileSync(root+'21836b2aff2e-flow_studio.txt','utf8')).flow;
const b=JSON.parse(fs.readFileSync(root+'7bde64a87d2c-flow_studio.txt','utf8')).flow;
const errors=[];
for(const n of a.nodes){const m=b.nodes.find(x=>x.id===n.id);if(!m){errors.push('missing '+n.id);continue;}const {note,...x}=n,{note:y,...z}=m;if(JSON.stringify(x)!==JSON.stringify(z))errors.push({id:n.id,before:x,after:z});if(!y.startsWith(note))errors.push('note '+n.id);}
for(const e of a.edges)if(!b.edges.some(x=>JSON.stringify(x)===JSON.stringify(e)))errors.push({edge:e});
console.log(JSON.stringify({old:[a.nodes.length,a.edges.length],new:[b.nodes.length,b.edges.length],errors},null,2));if(errors.length)process.exitCode=1;
