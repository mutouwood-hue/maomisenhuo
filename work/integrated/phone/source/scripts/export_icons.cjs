const fs=require('node:fs'),path=require('node:path'),icons=require('../web/offline-nav-icons.js');
const dir=path.resolve(__dirname,'../../evidence/icons');fs.mkdirSync(dir,{recursive:true});
for(const key of Object.keys(icons.labels))fs.writeFileSync(path.join(dir,key+'.svg'),icons.svg(key,48,'preview-'+key));
