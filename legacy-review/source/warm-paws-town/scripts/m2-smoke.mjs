import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const server=createServer(async(req,res)=>{try{const name=req.url==='/'?'index.html':req.url.slice(1).split('?')[0];if(!/^[a-z\d.-]+$/i.test(name))throw new Error();res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':'text/html');res.end(await readFile(new URL('../www/'+name,import.meta.url)));}catch{res.writeHead(404).end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const browser=await chromium.launch({headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});const page=await browser.newPage({viewport:{width:393,height:852}}),errors=[];page.on('pageerror',error=>errors.push(error.message));
try{
 await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.__companion?.social);await page.screenshot({path:fileURLToPath(new URL('../deliverables/m2-mobile-header.png',import.meta.url))});assert.equal(await page.locator('#m2-open').evaluate(node=>node.getBoundingClientRect().top>=innerHeight),true);await page.click('#m-dock [data-m=more]');await page.locator('#companion-mobile-entries').waitFor({state:'visible'});assert.equal(await page.locator('#m2-open').evaluate(node=>getComputedStyle(node).position),'static');await page.screenshot({path:fileURLToPath(new URL('../deliverables/m2-mobile-entry-drawer.png',import.meta.url))});await page.click('#m2-open');
 assert.match(await page.locator('#m2-status').textContent(),/未登录/);assert.equal(await page.locator('#m2-collection li').count(),6);
 await page.click('#m2-scan');assert.match(await page.locator('#m2-error').textContent(),/登录/);
 assert.equal(await page.locator('#m2-method option[value=KNOCK]').evaluate(node=>node.disabled),true);
 assert.equal(await page.locator('#m2-method option[value=PATTERN]').evaluate(node=>node.disabled),true);
 assert.equal(await page.locator('#m2-exchange-id').evaluate(node=>node.tagName),'SELECT');assert.equal(await page.locator('#m2-peer-parent').evaluate(node=>node.tagName),'SELECT');
 assert.equal(await page.locator('#m2-environment').isChecked(),false);
 await page.screenshot({path:fileURLToPath(new URL('../deliverables/m2-mobile-empty.png',import.meta.url))});
 await page.locator('#m2-environment-status').scrollIntoViewIfNeeded();await page.screenshot({path:fileURLToPath(new URL('../deliverables/m2-mobile-environment.png',import.meta.url))});
 assert.deepEqual(errors,[]);await writeFile(new URL('../deliverables/m2-mobile-smoke.json',import.meta.url),JSON.stringify({scope:'真实生成页面+离线无设备空态；无实际Android摄像头/无线验证',checks:['原作可载入','单机6品种图鉴','未登录不调用camera','KNOCK/PATTERN诚实禁用','真实picker而非ID输入','独立环境默认关闭'],errors},null,2));console.log('M2 browser empty-state smoke passed');
}catch(error){console.error('PAGE ERRORS',errors,await page.locator('#m2-method').evaluate(node=>node.outerHTML));throw error;}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
