(() => {
  'use strict';
  const GENO_PAYLOAD = window.VAPADONF_GENOTYPES;
  const MODEL = window.VAPADONF_MODEL;
  const GENOS = GENO_PAYLOAD.genotypes;
  const genoByCode = Object.fromEntries(GENOS.map(g => [g.identifiant_moteur, g]));
  const traditional = new Set(MODEL.traditional_varieties || []);
  const crbLinks = {
    GOANA:{code:'PT-IG-00025',olga:'OLGA-19694',url:'https://florilege.arcad-project.org/fr/accession/OLGA-19694'},
    KINABAYO:{code:'PT-IG-00077',olga:'OLGA-19746',url:'https://florilege.arcad-project.org/fr/accession/OLGA-19746'},
    GROSSECAILLE:{code:'PT-IG-00119',olga:'OLGA-19788',url:'https://florilege.arcad-project.org/fr/accession/OLGA-19788'},
    PAKALA:{code:'PT-IG-00350',olga:'OLGA-19686',url:'https://florilege.arcad-project.org/fr/accession/OLGA-19686'},
    ROUJOL:{code:'PT-IG-00686',olga:'OLGA-20355',url:'https://florilege.arcad-project.org/fr/accession/OLGA-20355'},
    TIBOU:{code:'PT-IG-00691',olga:'OLGA-20360',url:'https://florilege.arcad-project.org/fr/accession/OLGA-20360'},
    DOU:{code:'PT-IG-00694',olga:'OLGA-20363',url:'https://florilege.arcad-project.org/fr/accession/OLGA-20363'},
    CIRADIENNE:{code:'PT-IG-00696',olga:'OLGA-20365',url:'https://florilege.arcad-project.org/fr/accession/OLGA-20365'},
    TIVIOLET:{code:'PT-IG-00697',olga:'OLGA-20366',url:'https://florilege.arcad-project.org/fr/accession/OLGA-20366'},
    MALALAGI:{code:'PT-IG-00698',olga:'OLGA-20367',url:'https://florilege.arcad-project.org/fr/accession/OLGA-20367'},
    COCO:{code:'PT-IG-00699',olga:'OLGA-20368',url:'https://florilege.arcad-project.org/fr/accession/OLGA-20368'},
    BELO:{code:'PT-IG-00700',olga:'OLGA-20369',url:'https://florilege.arcad-project.org/fr/accession/OLGA-20369'},
    TICLAIR:{code:'PT-IG-00701',olga:'OLGA-20370',url:'https://florilege.arcad-project.org/fr/accession/OLGA-20370'},
    KABUSAH:{code:'—',olga:'OLGA-19715',url:'https://florilege.arcad-project.org/fr/accession/OLGA-19715'}
  };
  const criteria = [
    ['I1','Production','production.JPG'],
    ['I2','Résistance aux maladies','maladies.jpg'],
    ['I3','Conservation en stockage','conservation.JPG'],
    ['I4','Qualité du tubercule','qualite.JPG'],
    ['I5','Tolérance aux mauvaises herbes','weeds.JPG']
  ];
  const colors = [
    ['blanche','Blanche','blanc.jpg'],['creme','Crème','creme.jpg'],['jaunatre','Jaunâtre','jaunatre.jpg'],['orange','Orange','orange.jpg'],['violace','Violacée','violace.jpg']
  ];
  const colorLabelByKey = Object.fromEntries(colors.map(([id,l]) => [id,l]));
  const importanceLabels = {5:'Très important',4:'Important',3:'Moyennement important',2:'Peu important',1:'Pas du tout important'};
  const colorLabels = {5:'Parfaitement',4:'Bien',3:'Moyennement',2:'Faiblement',1:'Pas du tout'};
  const pieColors = ['#237a57','#c96549','#d3a02c','#6f7885'];
  const chartColors = {improved:'#207a57', traditional:'#a54878'};
  const parcelleNames = {AB:'Anse Bertrand',BA:'Baillif',GO:'Goyave',GB:'Grand Bourg',LA:'Lamentin',LM:'Le Moule',MO:"Morne à l'Eau",SF:'Saint François',Roujol:'Roujol',Godet:'Godet',Duclos:'Duclos'};
  const indicatorLabels = {I1:'Production',I2:'Résistance',I3:'Conservation',I4:'Qualité',I5:'Adventices'};
  let state = {results:null,prefs:null};

  const q = s => document.querySelector(s);
  const qa = s => [...document.querySelectorAll(s)];
  const fmt = (n,d=2) => Number.isFinite(n) ? n.toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d}) : '—';
  const mean = a => { const v=a.filter(Number.isFinite); return v.length ? v.reduce((s,x)=>s+x,0)/v.length : null; };
  const sd = a => { const v=a.filter(Number.isFinite); if(v.length<2)return null; const m=mean(v); return Math.sqrt(v.reduce((s,x)=>s+(x-m)**2,0)/(v.length-1)); };
  const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const clamp = (x,a,b) => Math.max(a,Math.min(b,x));

  function initFields(){
    q('#criteria-grid').innerHTML = criteria.map(([id,label,img]) => `
      <div class="field-card"><img src="images/ui/${img}" alt="Illustration ${escapeHtml(label)}"><div class="inner"><label>${escapeHtml(label)}<select name="weight-${id}">${[5,4,3,2,1].map(v=>`<option value="${v}">${importanceLabels[v]}</option>`).join('')}</select></label></div></div>`).join('');
    q('#colors-grid').innerHTML = colors.map(([id,label,img]) => `
      <div class="color-card"><img src="images/colors/${img}" alt="Chair ${label.toLowerCase()}"><div class="inner"><strong>${label}</strong><select name="color-${id}">${[5,4,3,2,1].map(v=>`<option value="${v}">${colorLabels[v]}</option>`).join('')}</select></div></div>`).join('');
  }

  function readPrefs(){
    const zones = qa('input[name="zone"]:checked').map(x=>x.value);
    const species = qa('input[name="species"]:checked').map(x=>x.value);
    const weights = Object.fromEntries(criteria.map(([id])=>[id, Number(q(`[name="weight-${id}"]`).value)]));
    const colorPrefs = Object.fromEntries(colors.map(([id])=>[id, Number(q(`[name="color-${id}"]`).value)]));
    const minG = Number(q('#calibre-min').value);
    const maxG = Number(q('#calibre-max').value) * 1000;
    return {zones,species,weights,colorPrefs,minG,maxG};
  }

  function validate(p){
    if(!p.zones.length) return 'Sélectionnez au moins une zone.';
    if(!p.species.length) return 'Sélectionnez au moins une espèce.';
    if(!Number.isFinite(p.minG)||!Number.isFinite(p.maxG)||p.minG<=0||p.maxG<=0||p.minG>=p.maxG) return 'Le calibre minimum doit être inférieur au calibre maximum.';
    return '';
  }

  function zoneAllowed(row,p){
    return (p.zones.includes('BT') && row.Zone==='BT') || (p.zones.includes('GT') && (row.Zone==='GT'||row.Zone==='MG'));
  }

  function dynamicCommercialYield(row,p){
    const key = `${row.AN}|${row.Parcelle}|${row.Var}`;
    const t = MODEL.tubers[key];
    if(!t || !Number.isFinite(row.Nb_Pl_RecF) || !Number.isFinite(row.Densite) || row.Nb_Pl_RecF===0) return null;
    const commercial = t.good_weights_g.reduce((s,w)=>s + (w>=p.minG && w<=p.maxG ? w : 0),0);
    return commercial / row.Nb_Pl_RecF * row.Densite / 100;
  }

  function scaleRows(rows,key,invert=false){
    const groups = new Map();
    rows.forEach(r => {
      const gk=`${r.AN}|${r.Zone}|${r.Parcelle}|${r.Sp}`;
      if(!groups.has(gk)) groups.set(gk,[]);
      groups.get(gk).push(r);
    });
    for(const arr of groups.values()){
      const vals = arr.map(r=>r[key]).filter(Number.isFinite);
      if(!vals.length){arr.forEach(r=>r[`_${key}`]=null); continue;}
      const lo=Math.min(...vals), hi=Math.max(...vals), range=hi-lo;
      arr.forEach(r=>{
        const v=r[key];
        let s = Number.isFinite(v) ? (range===0 ? .5 : (v-lo)/range) : null;
        if(Number.isFinite(s) && invert) s=1-s;
        r[`_${key}`]=s;
      });
    }
  }

  function compute(p){
    const rows = MODEL.situations.filter(r=>p.species.includes(r.Sp) && zoneAllowed(r,p)).map(r=>({...r}));
    rows.forEach(r=>{ r['I1.2']=dynamicCommercialYield(r,p); });
    const byVar = new Map();
    rows.forEach(r=>{ if(!byVar.has(r.Var)) byVar.set(r.Var,[]); if(Number.isFinite(r['I1.1'])) byVar.get(r.Var).push(r['I1.1']); });
    const cvByVar = {};
    for(const [v,arr] of byVar){ const m=mean(arr), s=sd(arr); cvByVar[v]=Number.isFinite(m)&&m!==0&&Number.isFinite(s) ? s/m*100 : null; }
    rows.forEach(r=>r['I1.4']=cvByVar[r.Var]);

    scaleRows(rows,'I1.1'); scaleRows(rows,'I1.2'); scaleRows(rows,'I1.3',true); scaleRows(rows,'I1.4',true);
    scaleRows(rows,'I5.1',true); scaleRows(rows,'I5.2'); scaleRows(rows,'I5.3',true);

    rows.forEach(r=>{
      r['_I2.1']=Number.isFinite(r['I2.1']) ? 1-r['I2.1']/4 : null;
      r['_I2.2']=Number.isFinite(r['I2.2']) ? 1-r['I2.2']/4 : null;
      r['_I3.1']=Number.isFinite(r['I3.1']) ? r['I3.1']/100 : null;
      r['_I3.2']=Number.isFinite(r['I3.2']) ? r['I3.2'] : null;
      r['_I4.1']=Number.isFinite(p.colorPrefs[r.Couleur]) ? (p.colorPrefs[r.Couleur]-1)/4 : null;
      r['_I4.2']=Number.isFinite(r['I4.2']) ? r['I4.2']/3 : null;
      r.indicators = {
        I1:mean([r['_I1.1'],r['_I1.2'],r['_I1.3'],r['_I1.4']]),
        I2:mean([r['_I2.1'],r['_I2.2']]),
        I3:mean([r['_I3.1'],r['_I3.2']]),
        I4:mean([r['_I4.1'],r['_I4.2']]),
        I5:mean([r['_I5.1'],r['_I5.2'],r['_I5.3']])
      };
      const totalWeight = criteria.reduce((s,[id])=>s + p.weights[id],0);
      const weighted = criteria.reduce((s,[id])=>s + ((Number.isFinite(r.indicators[id]) ? r.indicators[id] : 0) * p.weights[id]),0);
      r.sitScore = weighted / totalWeight * 10;
    });

    const raw=[];
    [...new Set(rows.map(r=>r.Var))].forEach(code => {
      const vr=rows.filter(r=>r.Var===code);
      const sit=vr.map(r=>r.sitScore).filter(Number.isFinite);
      if(!sit.length || !genoByCode[code]) return;
      const indicators = Object.fromEntries(criteria.map(([id])=>[id, mean(vr.map(r=>r.indicators[id]).filter(Number.isFinite))*10]));
      const colorMode = Object.entries(vr.reduce((acc,r)=>{acc[r.Couleur]=(acc[r.Couleur]||0)+1; return acc;},{})).sort((a,b)=>b[1]-a[1])[0]?.[0] || null;
      const colorMatch = colorMode ? colorLabels[p.colorPrefs[colorMode]] : null;
      raw.push({
        code,
        score:mean(sit),
        indicators,
        nSituations:sit.length,
        genotype:genoByCode[code],
        type:traditional.has(code)?'Variété témoin':'Variété améliorée',
        meanYield: mean(vr.map(r=>r['I1.1']).filter(Number.isFinite)),
        cvYield: cvByVar[code],
        colorMode,
        colorMatch
      });
    });
    const ranked = raw.sort((a,b)=>b.score-a.score);
    ranked.forEach((x,i)=>x.rank=i+1);
    return {ranked,rows};
  }

  function tuberBreakdown(code,p,rows){
    const keys=[...new Set(rows.filter(r=>r.Var===code).map(r=>`${r.AN}|${r.Parcelle}|${r.Var}`))];
    let commercial=0, defects=0, small=0, large=0, total=0;
    keys.forEach(key => {
      const t=MODEL.tubers[key]; if(!t) return;
      defects += t.defect_weight_g; total += t.total_weight_g;
      t.good_weights_g.forEach(w => { if(w<p.minG) small += w; else if(w>p.maxG) large += w; else commercial += w; });
    });
    const denom = commercial + defects + small + large || total || 1;
    return {commercial, defects, small, large, total:denom, percentages:{commercial:commercial/denom*100, defects:defects/denom*100, small:small/denom*100, large:large/denom*100}};
  }

  function pieSvg(b, cls='pie'){
    const vals=[b.percentages.commercial,b.percentages.defects,b.percentages.small,b.percentages.large];
    let angle=-Math.PI/2, paths=''; const cx=55,cy=55,r=50;
    vals.forEach((v,i)=>{ if(v<=0)return; const a2=angle+v/100*Math.PI*2; if(v>=99.999){paths+=`<circle cx="55" cy="55" r="50" fill="${pieColors[i]}"/>`; angle=a2; return;} const x1=cx+r*Math.cos(angle), y1=cy+r*Math.sin(angle), x2=cx+r*Math.cos(a2), y2=cy+r*Math.sin(a2), largeArc=(a2-angle)>Math.PI?1:0; paths+=`<path d="M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2} Z" fill="${pieColors[i]}"/>`; angle=a2; });
    return `<svg class="${cls}" viewBox="0 0 110 110">${paths}<circle cx="55" cy="55" r="24" fill="white"/><text x="55" y="53" text-anchor="middle" font-size="8" font-weight="700">${fmt(b.percentages.commercial,0)}%</text><text x="55" y="63" text-anchor="middle" font-size="5.5">commercial.</text></svg>`;
  }

  function indicatorBars(item){
    return criteria.map(([id])=>`<div class="indicator-row"><span>${indicatorLabels[id]}</span><div class="bar"><i style="width:${clamp(item.indicators[id]*10,0,100)}%"></i></div><b>${fmt(item.indicators[id],1)}</b></div>`).join('');
  }

  function photoPath(code, suffix, ext='JPG'){ return `images/varieties/${code}_${suffix}.${ext}`; }
  function resilientImg(code,suffix,alt,cls=''){ const a=photoPath(code,suffix,'JPG'), b=photoPath(code,suffix,'jpg'); return `<img class="${cls}" src="${a}" alt="${escapeHtml(alt)}" onerror="if(!this.dataset.f){this.dataset.f=1;this.src='${b}';}else{this.parentNode && this.parentNode.classList.add('missing'); this.style.display='none';}">`; }

  function crbLink(item, className='link-button'){
    const entry = crbLinks[item.code];
    return entry ? `<a class="${className}" href="${entry.url}" target="_blank" rel="noopener">Voir sur Florilège (${entry.olga})</a>` : '';
  }

  function colorMention(item){
    if(!item.colorMode) return '';
    return `<span class="color-mention">Chair ${escapeHtml(colorLabelByKey[item.colorMode].toLowerCase())} · préférence utilisateur : ${escapeHtml(item.colorMatch || '—')}</span>`;
  }

  function varCard(item,p,rows){
    if(!item) return '<p>Aucune variété disponible.</p>';
    const g=item.genotype, b=tuberBreakdown(item.code,p,rows);
    const tuberPhoto=`images/tubers/${item.code}.webp`;
    const legend=[['Commercialisables',b.percentages.commercial],['Défauts',b.percentages.defects],['Trop petits',b.percentages.small],['Trop gros',b.percentages.large]];
    return `<article class="var-card"><div class="var-head"><img class="var-photo" src="${tuberPhoto}" alt="Tubercule ${escapeHtml(g.nom)}" onerror="this.outerHTML='<div class=&quot;var-photo photo-placeholder&quot;>Photo non disponible</div>'"><div><h3>${escapeHtml(g.nom)}</h3><div class="meta"><em>${escapeHtml(g.nom_scientifique)}</em> · ${escapeHtml(g.code_ou_origine)}<br>${escapeHtml(item.type)} · ${item.nSituations} situations scorées</div>${colorMention(item)}<div class="big-score">${fmt(item.score,2)} <small>/ 10</small></div></div></div><div class="indicator-list">${indicatorBars(item)}</div><div class="tuber-section"><strong>Répartition du poids des tubercules récoltés</strong><div class="tuber-grid">${pieSvg(b)}<div class="legend">${legend.map((x,i)=>`<div class="legend-row"><span><i style="display:inline-block;width:9px;height:9px;border-radius:2px;background:${pieColors[i]};margin-right:6px"></i>${x[0]}</span><b>${fmt(x[1],1)} %</b></div>`).join('')}<small>Calibre retenu : ${p.minG} g à ${fmt(p.maxG/1000,1)} kg.</small></div></div><div style="margin-top:12px">${varietyPhotoGrid(item.code)}</div></div><div class="download-row"><a class="link-button" href="${g.fiche_url_relative}" target="_blank" rel="noopener">Ouvrir la fiche variétale (PDF)</a>${crbLink(item)}</div></article>`;
  }

  function varietyPhotoGrid(code){
    return `<div class="photo-grid">
      <div class="thumb-card">${resilientImg(code,'FV',`Feuillage ${code}`)}<small>Végétation</small></div>
      <div class="thumb-card">${resilientImg(code,'TU',`Tubercule ${code}`)}<small>Tubercule</small></div>
      <div class="thumb-card">${resilientImg(code,'CO',`Chair ${code}`)}<small>Couleur de chair</small></div>
    </div>`;
  }

  function renderResults(result,p){
    state={results:result,prefs:p};
    q('#results').hidden=false;
    const z=p.zones.map(x=>x==='BT'?'Basse-Terre':'Grande-Terre + Marie-Galante').join(', ');
    const sp=p.species.map(x=>x==='Da'?'D. alata':'D. rotundata').join(', ');
    q('#selection-summary').innerHTML=`<span>${z}</span><span>${sp}</span><span>Calibre ${p.minG} g – ${fmt(p.maxG/1000,1)} kg</span><span>${result.ranked.length} génotypes classés</span>`;
    q('#ranking-body').innerHTML=result.ranked.map(item=>`<tr><td>${item.rank}</td><td><strong>${escapeHtml(item.genotype.nom)}</strong><br><small>${escapeHtml(item.genotype.code_ou_origine)}</small></td><td>${escapeHtml(item.genotype.espece)}</td><td>${item.type.replace('Variété ','')}</td><td><span class="score-pill">${fmt(item.score,2)}</span></td><td><a class="fiche-link" href="${item.genotype.fiche_url_relative}" target="_blank" rel="noopener">PDF</a>${crbLinks[item.code] ? ` · <a class="fiche-link" href="${crbLinks[item.code].url}" target="_blank" rel="noopener">Florilège</a>` : ''}</td></tr>`).join('');
    const improved=result.ranked.filter(x=>x.type==='Variété améliorée');
    const trad=result.ranked.filter(x=>x.type==='Variété témoin');
    q('#compare-improved').innerHTML=improved.map(x=>`<option value="${x.code}">${escapeHtml(x.genotype.nom)} — ${fmt(x.score,2)}</option>`).join('');
    q('#compare-traditional').innerHTML=trad.map(x=>`<option value="${x.code}">${escapeHtml(x.genotype.nom)} — ${fmt(x.score,2)}</option>`).join('');
    renderComparison();
    q('#results').scrollIntoView({behavior:'smooth',block:'start'});
  }

  function renderComparison(){
    if(!state.results) return;
    const {ranked,rows}=state.results; const p=state.prefs;
    const improved=ranked.find(x=>x.code===q('#compare-improved').value);
    const trad=ranked.find(x=>x.code===q('#compare-traditional').value);
    q('#comparison').innerHTML = varCard(improved,p,rows) + varCard(trad,p,rows);
    renderVisuals(improved,trad,rows,p);
  }

  function legendHtml(items){
    return `<div class="chart-legend">${items.filter(Boolean).map(item=>`<span class="chip"><i style="background:${item.type.includes('témoin')?chartColors.traditional:chartColors.improved};border:1px solid rgba(0,0,0,.15)"></i>${escapeHtml(item.genotype.nom)}</span>`).join('')}</div>`;
  }
  const svgFrame = (width,height,inner) => `<svg viewBox="0 0 ${width} ${height}" role="img">${inner}</svg>`;

  function radarChart(items, opts={}){
    const selected=items.filter(Boolean); if(selected.length<1) return '<p>Aucune donnée.</p>';
    const printMode = !!opts.printMode;
    const size=printMode?820:470, cx=size/2, cy=size/2, r=printMode?295:175;
    const tickFont=printMode?18:10, labelFont=printMode?24:13;
    let g='';
    [0.2,0.4,0.6,0.8,1].forEach(t=>{
      const pts=criteria.map((_,i)=>{ const ang=-Math.PI/2 + i*(Math.PI*2/criteria.length); return `${cx+r*t*Math.cos(ang)},${cy+r*t*Math.sin(ang)}`; }).join(' ');
      g += `<polygon points="${pts}" fill="none" stroke="#d5dfdb"/>`;
      if(t<1) g += `<text x="${cx+8}" y="${cy-r*t+14}" font-size="${tickFont}" fill="#677873">${fmt(t*10,0)}</text>`;
    });
    criteria.forEach(([id],i)=>{
      const ang=-Math.PI/2 + i*(Math.PI*2/criteria.length);
      const x=cx+r*Math.cos(ang), y=cy+r*Math.sin(ang);
      g += `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="#c5d4cf"/>`;
      const lx=cx+(r+(printMode?42:30))*Math.cos(ang), ly=cy+(r+(printMode?42:30))*Math.sin(ang);
      g += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="${labelFont}" font-weight="700" fill="#334a43">${escapeHtml(indicatorLabels[id])}</text>`;
    });
    selected.forEach(item=>{
      const color=item.type.includes('témoin')?chartColors.traditional:chartColors.improved;
      const pts=criteria.map(([id],i)=>{ const ang=-Math.PI/2 + i*(Math.PI*2/criteria.length); const rr=r*(item.indicators[id]/10); return `${cx+rr*Math.cos(ang)},${cy+rr*Math.sin(ang)}`; }).join(' ');
      g += `<polygon points="${pts}" fill="${color}" fill-opacity=".18" stroke="${color}" stroke-width="${printMode?4:3}"/>`;
      criteria.forEach(([id],i)=>{ const ang=-Math.PI/2 + i*(Math.PI*2/criteria.length); const rr=r*(item.indicators[id]/10); const x=cx+rr*Math.cos(ang), y=cy+rr*Math.sin(ang); g += `<circle cx="${x}" cy="${y}" r="${printMode?5:4}" fill="${color}"><title>${escapeHtml(item.genotype.nom)} — ${indicatorLabels[id]} : ${fmt(item.indicators[id],1)}/10</title></circle>`; });
    });
    return svgFrame(size,size,g)+legendHtml(selected);
  }

  function getYieldSeries(items,rows){
    const selected=items.filter(Boolean); const codes=new Set(selected.map(x=>x.code));
    const grouped=new Map();
    rows.filter(r=>codes.has(r.Var) && Number.isFinite(r['I1.1'])).forEach(r=>{
      const key=`${r.AN}|${r.Parcelle}|${r.Var}`;
      if(!grouped.has(key)) grouped.set(key,{AN:r.AN,Parcelle:r.Parcelle,Var:r.Var,vals:[]});
      grouped.get(key).vals.push(r['I1.1']);
    });
    const data=[...grouped.values()].map(d=>({site:`${parcelleNames[d.Parcelle]||d.Parcelle} ${d.AN}`, parc:d.Parcelle, year:d.AN, code:d.Var, value:mean(d.vals)}));
    const pairMap=new Map();
    data.forEach(d=>{ const key=`${d.year}|${d.parc}`; if(!pairMap.has(key)) pairMap.set(key,[]); pairMap.get(key).push(d); });
    const common=[...pairMap.values()].filter(arr=>selected.every(sel => arr.some(d=>d.code===sel.code))).flat();
    return {data: common.length ? common : data, commonOnly: !!common.length};
  }

  function yieldChart(items,rows, opts={}){
    const selected=items.filter(Boolean); if(!selected.length) return {html:'<p>Aucune donnée.</p>', note:''};
    const printMode = !!opts.printMode;
    const {data, commonOnly}=getYieldSeries(items,rows);
    if(!data.length) return {html:'<p>Aucune donnée de rendement disponible.</p>', note:''};
    const labels=[...new Set(data.map(d=>d.site))];
    const width=Math.max(printMode?1260:980, labels.length*(printMode?126:110)), height=printMode?600:450, left=82, right=36, top=52, bottom=printMode?176:118, plotW=width-left-right, plotH=height-top-bottom;
    const tickFont=printMode?17:11, labelFont=printMode?20:13, annoFont=printMode?18:12;
    const maxY=Math.max(...data.map(d=>d.value),1) * 1.22;
    const colW=plotW/labels.length, barW=Math.min(printMode?54:44, colW/(selected.length+0.6));
    let g='';
    for(let i=0;i<=5;i++){ const y=top+plotH-(plotH*i/5); const val=maxY*i/5; g += `<line x1="${left}" y1="${y}" x2="${left+plotW}" y2="${y}" stroke="#d8e2de"/><text x="${left-10}" y="${y+4}" text-anchor="end" font-size="${tickFont}" fill="#566762">${fmt(val,0)}</text>`; }
    g += `<line x1="${left}" y1="${top}" x2="${left}" y2="${top+plotH}" stroke="#8aa097"/><line x1="${left}" y1="${top+plotH}" x2="${left+plotW}" y2="${top+plotH}" stroke="#8aa097"/>`;
    labels.forEach((lab,idx)=>{
      const baseX=left+idx*colW+colW/2;
      selected.forEach((item,j)=>{
        const rec=data.find(d=>d.site===lab && d.code===item.code); if(!rec) return;
        const color=item.type.includes('témoin')?chartColors.traditional:chartColors.improved;
        const h=(rec.value/maxY)*plotH; const x=baseX - (selected.length*barW)/2 + j*barW; const y=top+plotH-h;
        g += `<rect x="${x}" y="${y}" width="${barW-6}" height="${h}" rx="2" fill="${color}" opacity=".82"><title>${escapeHtml(item.genotype.nom)}: ${fmt(rec.value,1)} t/ha à ${escapeHtml(lab)}</title></rect>`;
      });
      g += `<text x="${baseX}" y="${height-(printMode?82:58)}" text-anchor="end" transform="rotate(-28 ${baseX} ${height-(printMode?82:58)})" font-size="${printMode?16:tickFont}" fill="#445651">${escapeHtml(lab)}</text>`;
    });
    selected.forEach((item,idx)=>{
      const vals=data.filter(d=>d.code===item.code).map(d=>d.value); const avg=mean(vals); if(!Number.isFinite(avg)) return;
      const y=top+plotH-(avg/maxY)*plotH; const color=item.type.includes('témoin')?chartColors.traditional:chartColors.improved; const tx=left+plotW-10, ty=y-8-idx*(printMode?18:16);
      g += `<line x1="${left}" y1="${y}" x2="${left+plotW}" y2="${y}" stroke="${color}" stroke-dasharray="7 6" stroke-width="2"/>`;
      g += `<text x="${tx}" y="${ty}" text-anchor="end" font-size="${annoFont}" fill="${color}">Moyenne ${escapeHtml(item.genotype.nom)} : ${fmt(avg,1)} t/ha</text>`;
    });
        g += `<text x="18" y="${height/2}" transform="rotate(-90 18 ${height/2})" text-anchor="middle" font-size="${labelFont}" fill="#3b5049">Rendement (t/ha)</text>`;
    const note = commonOnly ? 'Seules les situations communes aux deux variétés dans la zone sélectionnée sont affichées afin de comparer des contextes équivalents.' : 'Les deux variétés ne sont pas toujours observées exactement dans les mêmes sites et années. Le graphique reste utile pour visualiser les ordres de grandeur, mais l’interprétation doit garder cette limite en tête.';
    return {html: svgFrame(width,height,g)+legendHtml(selected), note};
  }


  function riskChart(items,rows, opts={}){
    const selected=items.filter(Boolean); if(!selected.length) return {html:'<p>Aucune donnée.</p>', note:''};
    const printMode = !!opts.printMode;
    const allPoints = state.results.ranked.filter(v => Number.isFinite(v.meanYield) && Number.isFinite(v.cvYield)).map(v => ({...v, stabilityIndex: Math.max(0, 100 - v.cvYield)}));
    if(!allPoints.length) return {html:'<p>Aucune donnée de variabilité disponible.</p>', note:''};
    const width=printMode?1280:1040, height=printMode?640:500, left=104, right=86, top=46, bottom=printMode?126:104, plotW=width-left-right, plotH=height-top-bottom;
    const tickFont=printMode?18:12, axisFont=printMode?20:15, quadFont=printMode?18:12, labelFont=printMode?18:12;
    const maxX=Math.max(...allPoints.map(i=>i.meanYield),1)*1.12, maxY=Math.max(...allPoints.map(i=>i.stabilityIndex),55)*1.05;
    const medianX=allPoints.map(i=>i.meanYield).sort((a,b)=>a-b)[Math.floor(allPoints.length/2)];
    const medianY=allPoints.map(i=>i.stabilityIndex).sort((a,b)=>a-b)[Math.floor(allPoints.length/2)];
    let g='';
    for(let i=0;i<=5;i++){ const y=top+plotH-(plotH*i/5); const val=maxY*i/5; g += `<line x1="${left}" y1="${y}" x2="${left+plotW}" y2="${y}" stroke="#d8e2de"/><text x="${left-12}" y="${y+4}" text-anchor="end" font-size="${tickFont}" fill="#566762">${fmt(val,0)}</text>`; }
    for(let i=0;i<=5;i++){ const x=left+plotW*i/5; const val=maxX*i/5; g += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top+plotH}" stroke="#eef3f0"/><text x="${x}" y="${top+plotH+24}" text-anchor="middle" font-size="${tickFont}" fill="#566762">${fmt(val,0)}</text>`; }
    g += `<line x1="${left}" y1="${top}" x2="${left}" y2="${top+plotH}" stroke="#8aa097" stroke-width="1.4"/><line x1="${left}" y1="${top+plotH}" x2="${left+plotW}" y2="${top+plotH}" stroke="#8aa097" stroke-width="1.4"/>`;
    const crossX=left+(medianX/maxX)*plotW, crossY=top+plotH-(medianY/maxY)*plotH;
    g += `<line x1="${crossX}" y1="${top}" x2="${crossX}" y2="${top+plotH}" stroke="#94a6a0" stroke-dasharray="8 7" stroke-width="2"/><line x1="${left}" y1="${crossY}" x2="${left+plotW}" y2="${crossY}" stroke="#94a6a0" stroke-dasharray="8 7" stroke-width="2"/>`;
    // quadrants
    g += `<text x="${left+10}" y="${top+24}" font-size="${quadFont}" fill="#476255">Moins productif mais plus stable</text>`;
    g += `<text x="${left+plotW-10}" y="${top+24}" text-anchor="end" font-size="${quadFont}" fill="#476255">Plus productif et plus stable</text>`;
    g += `<text x="${left+10}" y="${top+plotH-12}" font-size="${quadFont}" fill="#476255">Moins productif et moins stable</text>`;
    g += `<text x="${left+plotW-10}" y="${top+plotH-12}" text-anchor="end" font-size="${quadFont}" fill="#476255">Plus productif mais moins stable</text>`;
    // axis arrows: x bottom, y left, with extra padding to avoid clipping
    const xArrowY = height-36;
    const xArrowX1 = left+10;
    const xArrowX2 = left+plotW-10;
    const yArrowX = 42;
    const yArrowY1 = top+plotH-8;
    const yArrowY2 = top+8;
    g = `<defs><marker id="arrow-thick" viewBox="0 0 12 12" refX="9" refY="6" markerWidth="8" markerHeight="8" orient="auto"><path d="M 0 0 L 12 6 L 0 12 z" fill="#476255"/></marker></defs>` + g;
    g += `<line x1="${xArrowX1}" y1="${xArrowY}" x2="${xArrowX2}" y2="${xArrowY}" stroke="#476255" stroke-width="4" marker-end="url(#arrow-thick)"/>`;
    g += `<text x="${xArrowX1}" y="${height-8}" font-size="${axisFont}" fill="#476255">Moins productif</text>`;
    g += `<text x="${xArrowX2}" y="${height-8}" text-anchor="end" font-size="${axisFont}" fill="#476255">Plus productif</text>`;
    g += `<line x1="${yArrowX}" y1="${yArrowY1}" x2="${yArrowX}" y2="${yArrowY2}" stroke="#476255" stroke-width="4" marker-end="url(#arrow-thick)"/>`;
    g += `<text x="20" y="${yArrowY1}" transform="rotate(-90 20 ${yArrowY1})" text-anchor="end" font-size="${axisFont}" fill="#476255">Moins stable</text>`;
    g += `<text x="20" y="${yArrowY2}" transform="rotate(-90 20 ${yArrowY2})" text-anchor="start" font-size="${axisFont}" fill="#476255">Plus stable</text>`;
    allPoints.forEach(item=>{
      const x=left+(item.meanYield/maxX)*plotW, y=top+plotH-(item.stabilityIndex/maxY)*plotH; const highlighted=selected.some(sel=>sel.code===item.code); const color=highlighted ? (item.type.includes('témoin')?chartColors.traditional:chartColors.improved) : '#b9c7c2'; const rr=highlighted ? (printMode?12:9) : (printMode?6.5:5.5);
      g += `<circle cx="${x}" cy="${y}" r="${rr}" fill="${color}" opacity="${highlighted?'.95':'.85'}" style="cursor:default"><title>${escapeHtml(item.genotype.nom)} — rendement moyen ${fmt(item.meanYield,1)} t/ha ; C.V. ${fmt(item.cvYield,1)} % ; indice de stabilité ${fmt(item.stabilityIndex,1)}</title></circle>`;
      if(highlighted){ g += `<text x="${x+12}" y="${y-12}" font-size="${labelFont}" font-weight="700" fill="${color}">${escapeHtml(item.genotype.nom)}</text>`; }
    });
    const extraLegend = `<div class="chart-legend"><span class="chip"><i style="background:#b9c7c2;border:1px solid rgba(0,0,0,.15)"></i>Autres variétés du filtre courant</span>${selected.filter(Boolean).map(item=>`<span class="chip"><i style="background:${item.type.includes('témoin')?chartColors.traditional:chartColors.improved};border:1px solid rgba(0,0,0,.15)"></i>${escapeHtml(item.genotype.nom)}</span>`).join('')}</div>`;
    return {html: svgFrame(width,height,g)+extraLegend, note:'Lecture conseillée : plus un point est à droite, plus le rendement moyen est élevé. Plus un point est haut, plus la variété est régulière entre situations. Le graphique utilise ici un indice de stabilité dérivé de la variabilité du rendement (plus il est élevé, plus le comportement est stable). En survolant un point du graphique dans la page web, vous pouvez afficher le nom de la variété ainsi que son rendement moyen et sa variabilité.'};
  }

  function adventicesChart(items,rows, opts={}){
    const selected=items.filter(Boolean); if(!selected.length) return {html:'<p>Aucune donnée.</p>', note:''};
    const printMode = !!opts.printMode;
    const series = selected.map(item=>{
      const vr=rows.filter(r=>r.Var===item.code);
      return {item,maxCover:mean(vr.map(r=>r['I5.2']).filter(Number.isFinite)),span:mean(vr.map(r=>r['I5.3']).filter(Number.isFinite))};
    }).filter(x=>Number.isFinite(x.maxCover) && Number.isFinite(x.span));
    if(!series.length) return {html:'<p>Aucune donnée adventices disponible.</p>', note:''};
    const width=printMode?1260:980,height=printMode?560:430,left=80,right=36,top=28,bottom=72,plotW=width-left-right,plotH=height-top-bottom;
    const tickFont=printMode?18:11, axisFont=printMode?20:13, annoFont=printMode?17:12;
    const maxY=100, maxX=Math.max(220,...series.map(x=>x.span+80));
    const maxMaxCover=Math.max(...series.map(s=>s.maxCover));
    let g='';
    for(let i=0;i<=5;i++){ const y=top+plotH-(plotH*i/5); const val=maxY*i/5; g += `<line x1="${left}" y1="${y}" x2="${left+plotW}" y2="${y}" stroke="#d8e2de"/><text x="${left-12}" y="${y+4}" text-anchor="end" font-size="${tickFont}" fill="#566762">${fmt(val,0)}</text>`; }
    for(let i=0;i<=5;i++){ const x=left+plotW*i/5; const val=maxX*i/5; g += `<line x1="${x}" y1="${top}" x2="${x}" y2="${top+plotH}" stroke="#eef3f0"/><text x="${x}" y="${height-18}" text-anchor="middle" font-size="${tickFont}" fill="#566762">${fmt(val,0)}</text>`; }
    g += `<line x1="${left}" y1="${top}" x2="${left}" y2="${top+plotH}" stroke="#8aa097" stroke-width="1.4"/><line x1="${left}" y1="${top+plotH}" x2="${left+plotW}" y2="${top+plotH}" stroke="#8aa097" stroke-width="1.4"/>`;
    series.forEach((r)=>{
      const color=r.item.type.includes('témoin')?chartColors.traditional:chartColors.improved; const pts=[]; const t50=r.span/2 + 35; const y50=r.maxCover/2;
      for(let x=0;x<=maxX;x+=3){ const slope=-4.394449154672439 / r.span; const y = r.maxCover/(1+Math.exp(slope*(x-t50))); pts.push(`${left+(x/maxX)*plotW},${top+plotH-(y/maxY)*plotH}`); }
      const x50=left+(t50/maxX)*plotW, y50px=top+plotH-(y50/maxY)*plotH, yMax=top+plotH-(r.maxCover/maxY)*plotH;
      g += `<polyline points="${pts.join(' ')}" fill="none" stroke="${color}" stroke-width="3.5"/>`;
      g += `<line x1="${left}" y1="${yMax}" x2="${left+plotW}" y2="${yMax}" stroke="${color}" stroke-dasharray="8 6" opacity=".7" stroke-width="2.2"/>`;
      g += `<line x1="${x50}" y1="${top+plotH}" x2="${x50}" y2="${y50px}" stroke="${color}" stroke-dasharray="8 6" opacity=".9" stroke-width="2.2"/>`;
      g += `<line x1="${left}" y1="${y50px}" x2="${x50}" y2="${y50px}" stroke="${color}" stroke-dasharray="8 6" opacity=".9" stroke-width="2.2"/>`;
      g += `<circle cx="${x50}" cy="${y50px}" r="5" fill="${color}"/>`;
      const isHigh = r.maxCover >= maxMaxCover - 0.01;
      const maxLabelY = isHigh ? Math.max(top+18, yMax-10) : Math.min(top+plotH-8, yMax+18);
      const t50LabelY = isHigh ? Math.max(top+18, y50px-10) : Math.min(top+plotH-8, y50px+18);
      g += `<text x="${left+plotW-10}" y="${maxLabelY}" text-anchor="end" font-size="${annoFont}" fill="${color}">${escapeHtml(r.item.genotype.nom)} · recouvrement max ${fmt(r.maxCover,0)} %</text>`;
      g += `<text x="${Math.min(left+plotW-20, x50+12)}" y="${t50LabelY}" font-size="${annoFont}" fill="${color}">50 % atteint vers ${fmt(t50,0)} jours</text>`;
    });
    g += `<text x="${width/2}" y="${height-4}" text-anchor="middle" font-size="${axisFont}" fill="#3b5049">Nombre de jours après émergence</text>`;
    g += `<text x="18" y="${height/2}" transform="rotate(-90 18 ${height/2})" text-anchor="middle" font-size="${axisFont}" fill="#3b5049">Recouvrement du sol (%)</text>`;
    const note='Chaque courbe résume la fermeture du couvert : le trait horizontal pointillé indique le recouvrement maximal moyen observé, tandis que le repère localisé près du pointillé vertical indique le moment où environ la moitié de ce recouvrement est atteinte.';
    return {html: svgFrame(width,height,g)+legendHtml(selected), note};
  }
  function renderVisuals(improved,trad,rows,p){
    const items=[improved,trad].filter(Boolean);
    q('#viz-radar').innerHTML = radarChart(items);
    const y=yieldChart(items,rows); q('#viz-yield').innerHTML = y.html; q('#viz-yield-note').textContent = y.note;
    const r=riskChart(items,rows); q('#viz-risk').innerHTML = r.html; q('#viz-risk-note').textContent = r.note;
    const a=adventicesChart(items,rows); q('#viz-adventices').innerHTML = a.html; q('#viz-adv-note').textContent = a.note;
  }

  function ratingStrip(v){ return `<span class="rating-strip level-${v}">${[1,2,3,4,5].map(i=>`<span class="${i<=v?'on':''}"></span>`).join('')}</span>`; }
  function colorsThumbsReport(p){ return `<div class="report-color-choices">${colors.map(([id,label,img])=>`<div class="thumb-card"><img src="images/colors/${img}" alt="${escapeHtml(label)}"><small>${escapeHtml(label)} — ${escapeHtml(colorLabels[p.colorPrefs[id]])}<br>${ratingStrip(p.colorPrefs[id])}</small></div>`).join('')}</div>`; }
  function dimensionThumbs(p){ return `<div class="report-dim-grid">${criteria.map(([id,label,img])=>`<div class="report-dim"><img src="images/ui/${img}" alt="${escapeHtml(label)}"><div><b>${escapeHtml(label)}</b><br>${ratingStrip(p.weights[id])}<br><span class="small-note">${importanceLabels[p.weights[id]]}</span></div></div>`).join('')}</div>`; }

  function reportCard(item,p,rows){
    if(!item) return '';
    const b=tuberBreakdown(item.code,p,rows), g=item.genotype;
    const legend=[['Commercialisables',b.percentages.commercial],['Défauts',b.percentages.defects],['Trop petits',b.percentages.small],['Trop gros',b.percentages.large]];
    return `<div class="report-card"><h3>${escapeHtml(g.nom)} — ${fmt(item.score,2)}/10</h3><p><em>${escapeHtml(g.nom_scientifique)}</em> · ${escapeHtml(g.code_ou_origine)} · ${escapeHtml(item.type)}</p><p>${colorMention(item)}</p>${indicatorBars(item)}<div class="report-pie">${pieSvg(b,'')}<div>${legend.map((x,i)=>`<p style="margin:3px 0"><span style="display:inline-block;width:9px;height:9px;background:${pieColors[i]};margin-right:5px"></span>${x[0]} : <b>${fmt(x[1],1)} %</b></p>`).join('')}</div></div><div class="report-photo-grid"><div>${resilientImg(item.code,'FV',`Feuillage ${item.code}`)}<small>Végétation</small></div><div>${resilientImg(item.code,'TU',`Tubercule ${item.code}`)}<small>Tubercule</small></div><div>${resilientImg(item.code,'CO',`Chair ${item.code}`)}<small>Couleur de chair</small></div></div><p class="report-note"><b>Ressources :</b> fiche variétale PDF ; ${crbLinks[item.code] ? `Florilège ${crbLinks[item.code].olga} (code historique ${crbLinks[item.code].code})` : 'pas de lien Florilège renseigné pour cette variété.'}</p></div>`;
  }

  function buildReport(){
    if(!state.results) return;
    const {ranked,rows}=state.results, p=state.prefs;
    const improved=ranked.find(x=>x.code===q('#compare-improved').value);
    const trad=ranked.find(x=>x.code===q('#compare-traditional').value);
    const items=[improved,trad].filter(Boolean);
    const radarHtml=radarChart(items,{printMode:true}), y=yieldChart(items,rows,{printMode:true}), r=riskChart(items,rows,{printMode:true}), a=adventicesChart(items,rows,{printMode:true});
    const z=p.zones.map(x=>x==='BT'?'Basse-Terre':'Grande-Terre et Marie-Galante').join(' + ');
    const sp=p.species.map(x=>x==='Da'?'Dioscorea alata':'Dioscorea rotundata').join(' + ');
    q('#report').innerHTML = `
      <section class="report-cover">
        <div class="report-cover-logo"><img src="images/logos/vapadonf_logo.png" alt="Logo VaPaDONF"></div>
        <h1>Rapport détaillé de votre recherche</h1>
        <p class="report-cover-subtitle">Outil d'aide au choix des variétés d'igname</p>
        <p class="report-cover-focus">Vous avez sélectionné pour comparaison : <b>${escapeHtml(improved?.genotype.nom || '—')}</b> (variété améliorée) et <b>${escapeHtml(trad?.genotype.nom || '—')}</b> (variété témoin).</p>
        <p class="report-cover-meta">Rapport généré localement depuis la version statique VaPaDONF · ${new Date().toLocaleDateString('fr-FR')}</p>
        <div class="report-toc">
          <h2>Sommaire</h2>
          <ol>
            <li>Rappel de vos préférences</li>
            <li>Classement des variétés</li>
            <li>Comparaison des deux variétés retenues</li>
            <li>Lecture globale des cinq dimensions</li>
            <li>Rendements par situation</li>
            <li>Productivité et régularité</li>
            <li>Capacité de couverture du sol</li>
            <li>Contexte du projet et références</li>
          </ol>
        </div>
      </section>
      <div class="page-break"></div>
      <section class="report-section"><h2>1. Rappel de vos préférences</h2><p class="report-comment"><b>Zone :</b> ${escapeHtml(z)} · <b>Espèce :</b> ${escapeHtml(sp)} · <b>Calibre retenu :</b> ${p.minG} g à ${fmt(p.maxG/1000,1)} kg.</p><p class="report-comment">Les vignettes ci-dessous rappellent les préférences utilisées dans le calcul.</p><div class="report-prefs">${dimensionThumbs(p)}${colorsThumbsReport(p)}</div></section>
      <section class="report-section"><h2>2. Classement des variétés</h2><p class="report-comment">Le tableau ci-dessous reprend le classement des variétés établi en fonction de vos préférences et de vos choix. La note affichée est la note calculée sur 10 à partir des pondérations utilisateur, sans réétalonnage du sous-ensemble filtré.</p><table class="report-table"><thead><tr><th>Rang</th><th>Variété</th><th>Espèce</th><th>Type</th><th>Score</th></tr></thead><tbody>${ranked.slice(0,10).map(x=>`<tr><td>${x.rank}</td><td>${escapeHtml(x.genotype.nom)}<br><small>${escapeHtml(x.genotype.code_ou_origine)}</small></td><td>${escapeHtml(x.genotype.espece)}</td><td>${x.type.replace('Variété ','')}</td><td>${fmt(x.score,2)}</td></tr>`).join('')}</tbody></table></section>
      <section class="report-section"><h2>3. Comparaison entre la variété améliorée et la variété traditionnelle</h2><p class="report-comment">Comparaison de la meilleure variété améliorée avec la meilleure variété traditionnelle dans les conditions spécifiées par l'utilisateur. La couleur de chair retenue par l'utilisateur intervient dans l'évaluation de la qualité du tubercule.</p><div class="report-grid">${reportCard(improved,p,rows)}${reportCard(trad,p,rows)}</div></section>
      <section class="report-section page-break"><h2>4. Lecture globale des cinq dimensions</h2><p class="report-comment">Le graphique radar compare les scores des deux variétés sur les cinq grandes dimensions évaluées : production, résistance, conservation, qualité et adventices.</p><div class="report-viz report-viz-radar">${radarHtml}</div></section>
      <section class="report-section"><h2>5. Rendements par situation</h2><p class="report-comment">Le graphique ci-dessous compare le rendement des deux variétés dans les situations retenues. Le trait pointillé indique le rendement moyen de chaque variété.</p><div class="report-viz">${y.html}</div><p class="report-note">${escapeHtml(y.note)}</p></section>
      <section class="report-section"><h2>6. Productivité et régularité</h2><p class="report-comment">Ce graphique aide à situer le compromis entre niveau de rendement et régularité du comportement en prenant comme repères l'ensemble des variétés du filtre courant.</p><div class="report-viz">${r.html}</div><p class="report-note">${escapeHtml(r.note)}</p></section>
      <section class="report-section"><h2>7. Adventices</h2><p class="report-comment">Le graphique suivant illustre la manière dont le couvert se ferme après émergence. Une fermeture plus rapide et un niveau maximal élevé peuvent aider à limiter le développement des adventices.</p><div class="report-viz">${a.html}</div><p class="report-note">${escapeHtml(a.note)}</p></section>
      <section class="report-section"><h2>8. Contexte du projet et références</h2><p class="report-comment">VaPaDONF valorise des données d'évaluation variétale historiques issues de la dynamique RITA autour des cultures racines et tubercules en Guadeloupe. L'objectif de l'outil est d'aider les techniciens et producteurs à raisonner le choix variétal à partir de plusieurs dimensions : production, résistance, conservation, qualité du tubercule et adventices.</p><p class="report-comment">Partenaires cités dans l'archive du projet : CIRAD, INRA/INRAE, Chambre d'agriculture de Guadeloupe, IT2, EPLEFPA et SICAPAG.</p><div class="report-partner-logos"><img src="images/logos/logo_cirad.png" alt="CIRAD"><img src="images/logos/logo_INRA.png" alt="INRA"><img src="images/logos/logo_CA_Guadeloupe.png" alt="Chambre d'agriculture de Guadeloupe"><img src="images/logos/logo_IT2.png" alt="IT2"><img src="images/logos/logo_EPLEFPA.png" alt="EPLEFPA"><img src="images/logos/logo_sicapag.png" alt="SICAPAG"></div><p class="report-comment">Référence historique : réimplémentation statique basée sur l'archive du développement R/Shiny initial, notamment le travail réalisé dans le cadre du stage de M2 de <b>Lesmond Elkana</b>. Dépôt GitHub historique : <span>github.com/elkana972/Projet_Rita</span>. Les ressources variétales externes renvoient désormais vers Florilège lorsque l'identifiant OLGA a pu être établi.</p></section>`;
    q('#report').setAttribute('aria-hidden','false');
  }
  function syncCalibre(source){
    const minNum=q('#calibre-min'), maxNum=q('#calibre-max'), minRange=q('#calibre-min-range'), maxRange=q('#calibre-max-range');
    let minG=Number(minNum.value), maxG=Number(maxNum.value)*1000;
    if(source==='minRange'){ minG=Number(minRange.value); minNum.value=minG; }
    if(source==='maxRange'){ maxG=Number(maxRange.value); maxNum.value=(maxG/1000).toFixed(1).replace(/\.0$/,''); }
    if(source==='minNum'){ minRange.value=minG; }
    if(source==='maxNum'){ maxRange.value=maxG; }
    if(minG>=maxG){ if(source.startsWith('min')) maxG=minG+100; else minG=Math.max(1,maxG-100); minNum.value=minG; maxNum.value=(maxG/1000).toFixed(1).replace(/\.0$/,''); minRange.value=minG; maxRange.value=maxG; }
    updateCalibreLabel();
  }
  function updateCalibreLabel(){
    const a=Number(q('#calibre-min').value), b=Number(q('#calibre-max').value);
    q('#calibre-label').textContent=`${a||'—'} g — ${Number.isFinite(b)?b.toLocaleString('fr-FR',{minimumFractionDigits:1,maximumFractionDigits:1}):'—'} kg`;
    const minV=Number(q('#calibre-min-range').value), maxV=Number(q('#calibre-max-range').value), minAll=1, maxAll=10000;
    q('#slider-fill').style.left=`${((minV-minAll)/(maxAll-minAll))*100}%`;
    q('#slider-fill').style.width=`${Math.max(0,((maxV-minAll)/(maxAll-minAll))*100 - ((minV-minAll)/(maxAll-minAll))*100)}%`;
  }
  function updateZoneMap(){ const zones=qa('input[name="zone"]:checked').map(x=>x.value); const img=q('#zone-map-image'); if(!img) return; let src='images/ui/map_none.svg'; if(zones.length===1 && zones[0]==='BT') src='images/ui/map_bt.svg'; else if(zones.length===1 && zones[0]==='GT') src='images/ui/map_gt.svg'; else if(zones.includes('BT') && zones.includes('GT')) src='images/ui/map_both.svg'; img.src=src; }
  function switchTab(name){ qa('.tab-button').forEach(btn=>{ const on=btn.dataset.tab===name; btn.classList.toggle('active',on); btn.setAttribute('aria-selected', on?'true':'false');}); qa('.tab-panel').forEach(p=>{ const on=p.id===`tab-${name}`; p.classList.toggle('active',on); p.hidden=!on;}); }

  initFields(); updateCalibreLabel(); updateZoneMap();
  q('#calibre-min').addEventListener('input',()=>syncCalibre('minNum')); q('#calibre-max').addEventListener('input',()=>syncCalibre('maxNum')); q('#calibre-min-range').addEventListener('input',()=>syncCalibre('minRange')); q('#calibre-max-range').addEventListener('input',()=>syncCalibre('maxRange')); qa('input[name="zone"]').forEach(el=>el.addEventListener('change',updateZoneMap));
  qa('.tab-button').forEach(btn=>btn.addEventListener('click',()=>switchTab(btn.dataset.tab)));
  q('#preferences').addEventListener('submit',e=>{ e.preventDefault(); const p=readPrefs(), err=validate(p); q('#form-message').textContent=err; if(err) return; const result=compute(p); if(!result.ranked.length){ q('#form-message').textContent='Aucun génotype ne dispose de suffisamment de données avec cette sélection.'; return; } q('#form-message').textContent=''; renderResults(result,p); });
  q('#reset').addEventListener('click',()=>{ q('#preferences').reset(); q('#calibre-min').value=300; q('#calibre-max').value=3; q('#calibre-min-range').value=300; q('#calibre-max-range').value=3000; q('#results').hidden=true; q('#form-message').textContent=''; state={results:null,prefs:null}; updateCalibreLabel(); updateZoneMap(); switchTab('global'); window.scrollTo({top:0,behavior:'smooth'}); });
  q('#compare-improved').addEventListener('change',renderComparison); q('#compare-traditional').addEventListener('change',renderComparison);
  const printNow = ()=>{ buildReport(); setTimeout(()=>window.print(), 100); };
  q('#print-report').addEventListener('click',printNow); q('#print-report-inline').addEventListener('click',printNow);
})();
