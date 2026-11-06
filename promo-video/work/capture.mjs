import puppeteer from 'puppeteer-core';
const BASE='http://127.0.0.1:7140';
const [email,pass,prefix,pagesArg]=[process.env.HM_EMAIL,process.env.HM_PASS,process.env.HM_PREFIX||'',process.env.HM_PAGES||''];
const browser=await puppeteer.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:'new',args:['--lang=ar','--force-color-profile=srgb']});
const page=await browser.newPage();
await page.setViewport({width:1440,height:900,deviceScaleFactor:2});
await page.evaluateOnNewDocument(()=>{try{localStorage.setItem('gfp_locale','ar');localStorage.setItem('gfp_appearance','dark');}catch(e){}});
await page.goto(BASE+'/auth/login/',{waitUntil:'networkidle2'});
await page.type('input[type=email]',email); await page.type('input[type=password]',pass);
await Promise.all([page.waitForNavigation({waitUntil:'networkidle2'}),page.keyboard.press('Enter')]);
const pages=JSON.parse(pagesArg);
for(const p of pages){
  await page.goto(BASE+p.url,{waitUntil:'networkidle2'}); await new Promise(r=>setTimeout(r,p.wait||2500));
  if(p.eval) { await page.evaluate(p.eval); await new Promise(r=>setTimeout(r,1500)); }
  if(p.scroll) { await page.evaluate(y=>{const m=document.querySelector('.main-content, main, .content, #main')||document.scrollingElement; (m.scrollTo?m:window).scrollTo(0,y); window.scrollTo(0,y);},p.scroll); await new Promise(r=>setTimeout(r,1200)); }
  await page.screenshot({path:`public/shots/${prefix}${p.name}.png`});
  console.log('shot',p.name);
}
await browser.close();
