import {chromium} from "playwright";
import {spawnSync} from "node:child_process";
import {createServer} from "node:http";
import {readFileSync,existsSync,statSync} from "node:fs";
import {resolve,sep,extname} from "node:path";
import {fileURLToPath} from "node:url";
import assert from "node:assert/strict";

const root=fileURLToPath(new URL("../../",import.meta.url)),output=resolve(root,"tools/browser/artifacts/pages-"+Date.now());
let server,browser,base=process.env.BUILDER_PUBLIC_URL,passed=0;
if(!base){
  const built=spawnSync(process.env.PYTHON||"python",["tools/build_pages.py","--output",output],{cwd:root,encoding:"utf8"});
  assert.equal(built.status,0,built.stdout+built.stderr);
  const types={".html":"text/html; charset=utf-8",".js":"text/javascript",".mjs":"text/javascript",".json":"application/json",".css":"text/css"};
  server=createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,"http://localhost").pathname);
    if(!pathname.startsWith("/BUILDER/")){res.writeHead(404);res.end();return;}
    const file=resolve(output,pathname.slice("/BUILDER/".length));
    if(!file.startsWith(output+sep)||!existsSync(file)||!statSync(file).isFile()){res.writeHead(404);res.end();return;}
    res.writeHead(200,{"Content-Type":types[extname(file)]||"application/octet-stream"});res.end(readFileSync(file));
  });
  await new Promise(r=>server.listen(0,"127.0.0.1",r));
  base=`http://127.0.0.1:${server.address().port}/BUILDER/`;
}
const check=(value,name)=>{assert.ok(value,name);passed++;console.log("PASS",name);};
try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),requests=[],errors=[];
  context.on("request",r=>requests.push(r.url()));page.on("pageerror",e=>errors.push(e.message));
  await context.route("**/*",r=>r.request().url().startsWith(base)?r.continue():r.abort());
  await page.goto(base+"spatial-prototype.html");await page.waitForFunction(()=>!!window.spatialDiagnostics,{},{timeout:30000});
  await page.waitForFunction(()=>{const p=spatialPixelCheck();return p.different>p.total*.025;},{},{timeout:10000});
  check((await page.evaluate(()=>spatialPixelCheck())).different>0,"Pages-prefix 3D canvas nonblank");
  check(await page.locator("#runtime").isHidden(),"public demo excludes local Core diagnostics");
  check(requests.every(r=>r.startsWith(base)),"all prototype requests stay within project prefix");
  check(errors.length===0,"no published-path script errors");
  await page.locator("#top").click();check((await page.evaluate(()=>spatialDiagnostics())).mode==="top","published top view");
  await page.locator('[data-object="demo-building"]').click();check(await page.locator("#height").innerText()==="26 m","published object selection");
  await page.locator("#iso").click();await page.screenshot({path:resolve(root,"tools/browser/artifacts/pages-desktop.png"),fullPage:true});
  await page.setViewportSize({width:390,height:844});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"published mobile no overflow");
  check((await page.evaluate(()=>spatialPixelCheck())).different>0,"published mobile canvas nonblank");
  await page.screenshot({path:resolve(root,"tools/browser/artifacts/pages-mobile.png"),fullPage:true});
  const build=await (await context.request.get(base+"build-info.json")).json();
  check(/^[0-9a-f]{40}$/.test(build.commit),"published build has commit provenance");
  await page.setViewportSize({width:1440,height:1000});
  // A fresh browser has no case: enter through the visible synthetic-demo action.
  await page.goto(base+"index.html");await page.locator('#btn-demo').click();
  await page.waitForURL(base+'dashboard.html');await page.locator("body.uros-unified").waitFor();
  check(await page.locator('html').getAttribute('data-theme')==='dark','new workspace defaults to dark');
  check(await page.locator('.stage-viewport [data-stage="name"]').count()===0,'case name stays outside the synthetic viewport');
  check(await page.locator('.stage-preview').innerText()==='0.7 Preview','prototype maturity is explicit without changing release');
  check(await page.locator('.stage-demo-label').evaluate(el=>{
    const luminance=color=>{const rgb=color.match(/[\d.]+/g).slice(0,3).map(v=>Number(v)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
    const fg=luminance(getComputedStyle(el).color),bg=luminance(getComputedStyle(el.closest('.stage-viewport')).backgroundColor);
    return (Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)>=4.5;
  }),'non-case label maintains readable contrast');
  const frame=page.frameLocator('.spatial-stage iframe');
  await frame.locator('canvas').waitFor();
  check(await page.evaluate(()=>typeof window.spatialDiagnostics==='undefined'),"Three runtime remains in the child document");
  const storage=await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)));
  await frame.locator('#top').click();
  check(await frame.locator('#top').getAttribute('aria-pressed')==='true',"in-workspace top view works");
  await frame.locator('#inspect').click();await frame.locator('[data-object="demo-building"]').click();
  check(await frame.locator('#height').innerText()==='26 m',"embedded source inspector retains explicit height");
  await frame.locator('#close-inspector').click();
  check(await frame.locator('#object-inspector').isHidden(),'source inspector has a visible close action');
  await frame.locator('#view-options > summary').click();await frame.locator('#focus').click();
  await frame.locator('#focus').press('Escape');
  check(await frame.locator('#view-options').getAttribute('open')===null,'advanced camera menu closes with Escape');
  check(await page.evaluate(()=>JSON.stringify(Object.entries(localStorage)))===storage,"embedded viewing never changes case storage");
  check(await page.locator('.stage-view-title').innerText().then(t=>t.includes('非本案量體')),"embedded model cannot be mistaken for the case geometry");
  await frame.locator('#iso').click();
  await page.screenshot({path:resolve(root,'tools/browser/artifacts/studio-desktop.png'),fullPage:false});
  await page.setViewportSize({width:390,height:844});
  check(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),"embedded workspace mobile no overflow");
  await frame.locator('#top').click();
  check(await frame.locator('#top').getAttribute('aria-pressed')==='true',"embedded mobile camera control remains reachable");
  await page.screenshot({path:resolve(root,'tools/browser/artifacts/studio-mobile.png'),fullPage:false});
  console.log(`PAGES: ${passed} passed; commit=${build.commit}`);
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));}
