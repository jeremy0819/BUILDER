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
  const before=requests.length;await page.goto(base+"dashboard.html",{waitUntil:"networkidle"});await page.locator("body.uros-unified").waitFor();
  check(requests.slice(before).every(r=>!r.includes("spatial-prototype")),"production workflow does not download Three.js");
  console.log(`PAGES: ${passed} passed; commit=${build.commit}`);
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));}
