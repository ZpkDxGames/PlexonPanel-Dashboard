/* Throwaway fixture reader/renderer. No production import, transport or store. */
(() => {
  const SVG = 'http://www.w3.org/2000/svg';
  const end = Date.UTC(2026, 9, 8, 5, 0, 0);
  const windowMs = 30 * 60 * 1000;
  const colors = ['ok', 'warn', 'critical', 'unknown'];
  const el = (tag, attrs = {}) => {
    const node = document.createElementNS(SVG, tag);
    for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
    return node;
  };
  function fixture(count = 900) {
    const points = [];
    for (let i = 0; i < count; i++) {
      const observedOffset = count===8192 ? i*(windowMs-60000)/count : i*windowMs/count;
      const at = end-windowMs+observedOffset+(count===8192&&observedOffset>=12*60000?60000:0);
      const minute = (at - end + windowMs)/60000;
      if (count!==8192&&minute >= 12 && minute < 13) continue; // Fixture outage: no captures.
      const mspt = minute >= 19 && minute < 21 ? 63 + 12*Math.sin(i*.3) : 10 + 6*Math.sin(i*.13);
      points.push({at, tps: minute >= 19 && minute < 21 ? 14.2 : minute >= 8 && minute < 9 ? 17.8 : 20,
        mspt: i === Math.floor(count*.71) ? 140 : i===20 ? 0 : i===35 ? null : mspt,
        source: 'Paper health fixture'});
    }
    return points;
  }
  const state = p => p.tps===null ? 'unknown' : p.tps>=19 ? 'ok' : p.tps>=15 ? 'warn' : 'critical';
  function geometry(points, width, from=end-windowMs, to=end) {
    const path = {ok:'', warn:'', critical:'', unknown:''};
    let zero = '', overflow = '', gap = '', marks = 0;
    const x = at => (at-from)/(to-from)*width;
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.at < from || p.at > to) continue;
      const interval = i ? p.at-points[i-1].at : windowMs/900;
      if (i && interval > Math.max(1000, windowMs/(points.length/(29/30))*3)) {
        const left = Math.max(0,x(points[i-1].at)), right = Math.min(width,x(p.at));
        gap += `M${left.toFixed(3)} 0H${right.toFixed(3)}V100H${left.toFixed(3)}Z`;
      }
      const markWidth = Math.max(.02, Math.min(2, width/(to-from)*(windowMs/(points.length/(29/30)))*.8));
      const left = x(p.at), right = Math.min(width,left+markWidth);
      const top = p.mspt===null ? 0 : 100-Math.max(0,Math.min(100,p.mspt));
      const key = p.mspt===null ? 'unknown' : state(p);
      if (p.mspt===0) zero+=`M${left.toFixed(3)} 100H${right.toFixed(3)}`;
      else path[key]+=`M${left.toFixed(3)} ${top.toFixed(3)}H${right.toFixed(3)}V100H${left.toFixed(3)}Z`;
      if (p.mspt>100) overflow+=`M${left.toFixed(3)} 2l-2 3h4Z`;
      marks++;
    }
    return {path,zero,overflow,gap,marks};
  }
  function create(container, count=900) {
    container.innerHTML = `<section class="pulse-specimen" aria-label="Tick Pulse fixture experiment">
      <div class="pulse-title"><h2>Tick Pulse</h2><span>30-minute observed window</span></div>
      <p class="fixture-note">Fixture data for design review. Not live server telemetry.</p>
      <div class="signals"><div><span>TPS</span><strong>20.00</strong></div><div><span>MSPT</span><strong>12.0 <small>ms</small></strong></div><div><span>Last capture</span><strong>2 <small>s ago</small></strong></div></div>
      <div class="pulse-plot"><span class="budget-label">50 ms budget</span></div>
      <div class="axis"><span>30 min ago</span><span>15 min ago</span><span>Now</span></div>
      <div class="legend"><span class="ok">Healthy</span><span class="warn">Degraded</span><span class="critical">Critical</span><span>Hatched: no captures / unknown</span></div>
      <p class="pulse-summary"></p><div class="sample-readout" aria-live="off"></div>
      <details class="inspect"><summary>Inspect captures and one-minute lens</summary><div class="lens"></div><p class="lens-note">One minute around the selected real capture; values are unchanged.</p><table><caption>Real fixture captures, page 1 (maximum 100 rows)</caption><thead><tr><th>Time (UTC)</th><th>TPS</th><th>MSPT</th></tr></thead><tbody></tbody></table><div class="table-page"><button type="button" class="previous">Previous</button><span class="page-label"></span><button type="button" class="next">Next</button></div></details>
      <p class="portuguese">Operação concluída. São Paulo: ação, conexão, memória e duração.</p></section>`;
    const plot = container.querySelector('.pulse-plot');
    const svg = el('svg', {role:'img',tabindex:0,'aria-label':'Fixture Tick Pulse. Left and right inspect captures; Home and End select limits.'});
    const defs=el('defs');
    const pattern=el('pattern',{id:'hatch',width:6,height:6,patternUnits:'userSpaceOnUse'});
    pattern.append(el('path',{d:'M0 6L6 0',stroke:'var(--muted)','stroke-width':1}));defs.append(pattern);svg.append(defs);
    const gaps=el('path',{fill:'url(#hatch)',opacity:.7});svg.append(gaps);
    const budget=el('path',{stroke:'var(--boundary)','stroke-dasharray':'3 3','stroke-width':1});svg.append(budget);
    const paths={};for(const key of colors){paths[key]=el('path',{fill:key==='unknown'?'url(#hatch)':`var(--${key})`,'data-status':key});svg.append(paths[key]);}
    const zero=el('path',{stroke:'var(--ok)','stroke-width':1});svg.append(zero);
    const overflow=el('path',{fill:'var(--critical)'});svg.append(overflow);
    const selection=el('path',{stroke:'var(--text)','stroke-width':1});svg.append(selection);plot.append(svg);
    let points=fixture(count),selected=points.length-1,page=0,last;
    function draw(newPoints=points) {
      const started=performance.now();points=newPoints;
      const width=plot.clientWidth;
      last=geometry(points,width);const generated=performance.now();
      svg.setAttribute('viewBox',`0 0 ${width} 100`);
      gaps.setAttribute('d',last.gap);budget.setAttribute('d',`M0 50H${width}`);
      for(const key of colors) paths[key].setAttribute('d',last.path[key]);
      zero.setAttribute('d',last.zero);overflow.setAttribute('d',last.overflow);
      container.querySelector('.pulse-summary').textContent=`${points.length.toLocaleString('en-US')} actual fixture captures; one-minute outage remains empty. One mark per capture.`;
      const latest=points.at(-1),values=container.querySelectorAll('.signals strong');
      values[0].textContent=latest.tps===null?'Not supplied':latest.tps.toFixed(2);
      values[1].replaceChildren(document.createTextNode(latest.mspt===null?'Not supplied':latest.mspt.toFixed(1)+' '));
      if(latest.mspt!==null){const unit=document.createElement('small');unit.textContent='ms';values[1].append(unit);}
      values[2].replaceChildren(document.createTextNode(((end-latest.at)/1000).toFixed(2)+' '));const ageUnit=document.createElement('small');ageUnit.textContent='s ago';values[2].append(ageUnit);
      return {geometryMs:generated-started,submitMs:performance.now()-generated,totalMs:performance.now()-started,
        marks:last.marks,pathBytes:Object.values(last.path).join('').length+last.zero.length+last.overflow.length,
        svgNodes:svg.querySelectorAll('*').length,plotWidth:width,averagePitchPx:width/(count),averageMarkWidthPx:width/count*.8};
    }
    const readout=container.querySelector('.sample-readout');
    const time=p=>new Date(p.at).toISOString().slice(11,23);
    function inspect(index) {
      selected=Math.max(0,Math.min(points.length-1,index));const p=points[selected];
      const x=(p.at-end+windowMs)/windowMs*plot.clientWidth;selection.setAttribute('d',`M${x} 0V100`);
      readout.textContent=`${time(p)} UTC | TPS ${p.tps===null?'not supplied':p.tps.toFixed(2)} | MSPT ${p.mspt===null?'not supplied':p.mspt.toFixed(2)+' ms'} | ${p.source}`;
      svg.setAttribute('aria-label',readout.textContent+'. Left/Right/Home/End inspect real captures.');
      const lens=container.querySelector('.lens');lens.replaceChildren();
      const from=p.at-30000,to=p.at+30000,g=geometry(points,lens.clientWidth||plot.clientWidth,from,to);
      const lensSvg=el('svg',{viewBox:`0 0 ${lens.clientWidth||plot.clientWidth} 100`,'aria-label':'One-minute exact-capture lens'});
      for(const key of colors)lensSvg.append(el('path',{d:g.path[key],fill:key==='unknown'?'var(--muted)':`var(--${key})`}));
      lens.append(lensSvg);return {selected,timestamp:p.at};
    }
    function table() {
      const body=container.querySelector('tbody');body.replaceChildren();
      for(const p of points.slice(page*100,(page+1)*100)) {
        const row=document.createElement('tr');for(const value of [time(p),p.tps??'not supplied',p.mspt??'not supplied']){const cell=document.createElement('td');cell.textContent=String(value);row.append(cell);}body.append(row);
      }
      container.querySelector('.page-label').textContent=`Page ${page+1} of ${Math.ceil(points.length/100)}`;
      container.querySelector('.previous').disabled=page===0;container.querySelector('.next').disabled=(page+1)*100>=points.length;
    }
    container.querySelector('.previous').onclick=()=>{page--;table();};container.querySelector('.next').onclick=()=>{page++;table();};
    svg.addEventListener('keydown',e=>{const action={ArrowLeft:selected-1,ArrowRight:selected+1,Home:0,End:points.length-1}[e.key];if(action!==undefined){e.preventDefault();inspect(action);}});
    svg.addEventListener('pointerdown',e=>{const target=end-windowMs+(e.clientX-svg.getBoundingClientRect().left)/plot.clientWidth*windowMs;let low=0,high=points.length-1;while(low<high){const mid=(low+high)>>1;if(points[mid].at<target)low=mid+1;else high=mid;}inspect(low&&target-points[low-1].at<points[low].at-target?low-1:low);});
    draw();inspect(selected);table();
    return {draw,inspect,fixture,get points(){return points;},svg,container};
  }
  window.PulseExperiment={create,fixture,geometry,end,windowMs};
})();
