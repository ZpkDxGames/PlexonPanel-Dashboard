import {firefox} from '@playwright/test';
const browser=await firefox.launch();
for(const name of ['operations-desk','orbital-observatory'])for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:width===390?844:900}});
 await page.route('**/*',route=>new URL(route.request().url()).origin==='http://127.0.0.1:4173'?route.continue():route.abort());
 await page.goto(`http://127.0.0.1:4173/docs/design-proofs/${name}.html`);
 await page.screenshot({path:`artifacts/reconstruction/${name}-${width}.png`,fullPage:true});await page.close();
}await browser.close();
