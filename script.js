(() => {
  const API='https://pokeapi.co/api/v2', TTL=15*60*1000, cache=new Map(), inflight=new Map();
  const pokeGateway={
    async get(path){
      const key=path.toLowerCase(), saved=cache.get(key);
      if(saved && Date.now()-saved.time<TTL)return saved.value;
      if(inflight.has(key))return inflight.get(key);
      const task=(async()=>{
        let response;
        try{response=await fetch(API+key)}catch{throw new Error('Sem conexão com a PokéAPI. Verifique sua internet e tente novamente.')}
        if(response.status===404)throw new Error('Pokémon não encontrado. Confira o nome ou número e tente novamente.');
        if(!response.ok)throw new Error('A PokéAPI está indisponível no momento. Tente novamente em instantes.');
        const value=await response.json();cache.set(key,{value,time:Date.now()});return value;
      })();
      inflight.set(key,task);
      try{return await task}finally{inflight.delete(key)}
    },
    pokemon(value){return this.get('/pokemon/'+encodeURIComponent(String(value).trim().toLowerCase()))},
    species(id){return this.get('/pokemon-species/'+id)},
    ability(value){return this.get('/ability/'+encodeURIComponent(value))},
    chain(url){return this.get(new URL(url).pathname.replace('/api/v2',''))}
  };
  const $=id=>document.getElementById(id), esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const pretty=s=>String(s).replace(/-/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
  const sprite=p=>p.sprites?.versions?.['generation-v']?.['black-white']?.animated?.front_default||p.sprites?.versions?.['generation-v']?.['black-white']?.front_default||p.sprites?.front_default||'';
  const imageTag=(p,alt)=>sprite(p)?`<img src="${esc(sprite(p))}" alt="${esc(alt)}" loading="lazy">`:'<span aria-label="Imagem indisponível">?</span>';
  const statNames={'hp':'HP','attack':'Ataque','defense':'Defesa','special-attack':'At. especial','special-defense':'Def. especial','speed':'Velocidade'};
  const types={normal:'Normal',fire:'Fogo',water:'Água',electric:'Elétrico',grass:'Planta',ice:'Gelo',fighting:'Lutador',poison:'Venenoso',ground:'Terra',flying:'Voador',psychic:'Psíquico',bug:'Inseto',rock:'Pedra',ghost:'Fantasma',dragon:'Dragão',dark:'Sombrio',steel:'Aço',fairy:'Fada'};
  const statValue=(p,key)=>p.stats.find(s=>s.stat.name===key)?.base_stat||0;
  const statsHtml=p=>p.stats.map(s=>`<div class="stat-row"><span>${esc(statNames[s.stat.name]||pretty(s.stat.name))}</span><span>${s.base_stat}</span><div class="bar" role="img" aria-label="${esc(statNames[s.stat.name]||s.stat.name)}: ${s.base_stat}"><span style="width:${Math.min(100,s.base_stat/255*100)}%"></span></div></div>`).join('');
  let allNames=[], currentNames=[], page=0, favoritesOnly=false, listToken=0, detailToken=0, battle=null;
  const PAGE_SIZE=18;
  let favorites;
  try{favorites=new Set(JSON.parse(localStorage.getItem('retro-pokedex-favorites')||'[]'))}catch{favorites=new Set()}
  function note(text){const el=$('message');el.textContent=text;el.classList.toggle('hidden',!text)}
  function view(name){document.querySelectorAll('.section').forEach(el=>el.classList.toggle('active',el.id===name));document.querySelectorAll('.navbtn').forEach(el=>el.classList.toggle('active',el.dataset.view===name));note('');if(name==='list')renderList();window.scrollTo({top:0,behavior:'smooth'})}
  document.querySelectorAll('[data-view]').forEach(btn=>btn.addEventListener('click',()=>view(btn.dataset.view)));
  async function loadIndex(){
    try{
      const data=await pokeGateway.get('/pokemon?limit=1302');
      allNames=data.results.map((r,i)=>({name:r.name,id:Number(r.url.match(/\/(\d+)\/?$/)?.[1]||i+1)}));
      currentNames=allNames.slice();renderList();
    }catch(e){note(e.message)}
  }
  async function filterList(){
    const token=++listToken, query=$('list-query').value.trim().toLowerCase(), type=$('type-filter').value;
    $('list-count').textContent='Buscando...';
    try{
      let items=allNames;
      if(type){const result=await pokeGateway.get('/type/'+type);items=result.pokemon.map(x=>({name:x.pokemon.name,id:Number(x.pokemon.url.match(/\/(\d+)\/?$/)?.[1]||0)})).filter(x=>x.id>0).sort((a,b)=>a.id-b.id)}
      if(token!==listToken)return;
      currentNames=items.filter(x=>(!query||x.name.includes(query)||String(x.id)===query)&&(!favoritesOnly||favorites.has(x.id)));
      page=0;renderList();
    }catch(e){if(token===listToken){$('card-grid').replaceChildren();$('list-count').textContent='';note(e.message)}}
  }
  async function renderList(){
    if(!allNames.length)return;
    const token=++listToken, start=page*PAGE_SIZE, items=currentNames.slice(start,start+PAGE_SIZE);
    $('list-count').textContent=`${currentNames.length} Pokémon encontrados`;
    $('page-indicator').textContent=`${page+1} / ${Math.max(1,Math.ceil(currentNames.length/PAGE_SIZE))}`;
    $('prev-page').disabled=page===0;$('next-page').disabled=start+PAGE_SIZE>=currentNames.length;
    const grid=$('card-grid');grid.replaceChildren();
    if(!items.length){grid.innerHTML='<div class="panel col-span-full">Nenhum Pokémon encontrado. Experimente outro termo ou filtro.</div>';return}
    items.forEach(x=>{const card=document.createElement('article');card.className='poke-card';card.innerHTML=`<button type="button" class="sprite-box" data-open="${x.id}" aria-label="Abrir ${esc(x.name)}"><span>...</span></button><div class="num">Nº ${String(x.id).padStart(4,'0')}</div><h3 class="pixel card-name">${esc(pretty(x.name))}</h3><div class="card-types">Carregando...</div><button type="button" class="btn small ghost mt-2" data-fav="${x.id}" aria-label="${favorites.has(x.id)?'Remover dos favoritos':'Adicionar aos favoritos'}">${favorites.has(x.id)?'★ SALVO':'☆ FAVORITO'}</button>`;grid.append(card)});
    await Promise.all(items.map(async x=>{try{const p=await pokeGateway.pokemon(x.id);if(token!==listToken)return;const card=grid.querySelector(`[data-open="${x.id}"]`)?.closest('.poke-card');if(!card)return;card.querySelector('.sprite-box').innerHTML=imageTag(p,`Sprite de ${p.name}`);card.querySelector('.card-types').innerHTML=p.types.map(t=>`<span class="pill">${esc(types[t.type.name]||pretty(t.type.name))}</span>`).join('')}catch{const card=grid.querySelector(`[data-open="${x.id}"]`)?.closest('.poke-card');if(card)card.querySelector('.card-types').textContent='Imagem ou tipos indisponíveis'}}));
  }
  $('card-grid').addEventListener('click',e=>{
    const open=e.target.closest('[data-open]'),fav=e.target.closest('[data-fav]');
    if(open)openDetail(open.dataset.open);
    if(fav)toggleFavorite(Number(fav.dataset.fav));
  });
  function toggleFavorite(id){
    if(favorites.has(id))favorites.delete(id);else favorites.add(id);
    try{localStorage.setItem('retro-pokedex-favorites',JSON.stringify([...favorites]))}catch{note('Não foi possível guardar favoritos neste navegador.')}
    document.querySelectorAll(`[data-fav="${id}"]`).forEach(btn=>{btn.textContent=favorites.has(id)?'★ SALVO':'☆ FAVORITO';btn.setAttribute('aria-label',favorites.has(id)?'Remover dos favoritos':'Adicionar aos favoritos')});
    if(favoritesOnly)filterList();
  }
  async function openDetail(value){
    const token=++detailToken;view('detail');$('detail-content').innerHTML='<h2 id="detail-title" class="pixel title">CARREGANDO...</h2>';
    try{
      const p=await pokeGateway.pokemon(value);
      if(token!==detailToken)return;
      const species=await pokeGateway.species(p.id);
      if(token!==detailToken)return;
      const flavor=species.flavor_text_entries.find(x=>x.language.name==='pt')||species.flavor_text_entries.find(x=>x.language.name==='en');
      const description=flavor?.flavor_text.replace(/[\n\f]+/g,' ')||'Descrição indisponível.';
      $('detail-content').innerHTML=`<div class="detail-grid"><div><div class="detail-img">${imageTag(p,`Sprite de ${p.name}`)}</div><button type="button" class="btn small ghost mt-4" data-fav="${p.id}">${favorites.has(p.id)?'★ SALVO':'☆ FAVORITO'}</button></div><div><p class="num">Nº ${String(p.id).padStart(4,'0')}</p><h2 id="detail-title" class="pixel title">${esc(pretty(p.name))}</h2><div>${p.types.map(t=>`<span class="pill">${esc(types[t.type.name]||pretty(t.type.name))}</span>`).join('')}</div><p><strong>Altura:</strong> ${(p.height/10).toLocaleString('pt-BR')} m &nbsp; <strong>Peso:</strong> ${(p.weight/10).toLocaleString('pt-BR')} kg</p><p><strong>Habitat:</strong> ${esc(species.habitat?pretty(species.habitat.name):'Não informado')} &nbsp; <strong>Taxa de captura:</strong> ${species.capture_rate}/255</p><p><strong>Características:</strong> ${esc(species.is_legendary?'Lendário':species.is_mythical?'Mítico':species.genera.find(x=>x.language.name==='en')?.genus||'Não informado')}</p><p class="leading-relaxed">${esc(description)}</p><h3 class="pixel mt-6" style="font-size:12px">ESTATÍSTICAS</h3>${statsHtml(p)}</div></div><div class="mt-7"><h3 class="pixel mb-4" style="font-size:12px">HABILIDADES</h3><div id="ability-info" class="grid md:grid-cols-2 gap-3"></div></div><div class="mt-7"><h3 class="pixel mb-4" style="font-size:12px">EVOLUÇÕES</h3><div id="evolution-info" class="evo-list">Carregando...</div></div>`;
      $('detail-content').querySelector('[data-fav]').addEventListener('click',()=>toggleFavorite(p.id));
      Promise.all(p.abilities.map(async a=>{try{const data=await pokeGateway.ability(a.ability.name);const entry=data.effect_entries.find(x=>x.language.name==='pt')||data.flavor_text_entries.find(x=>x.language.name==='pt')||data.effect_entries.find(x=>x.language.name==='en')||data.flavor_text_entries.find(x=>x.language.name==='en');return {name:a.ability.name,description:(entry?.short_effect||entry?.effect||entry?.flavor_text||'Descrição não disponível.').replace(/[\n\f]+/g,' ')}}catch{return{name:a.ability.name,description:'Descrição não disponível.'}}})).then(items=>{if(token!==detailToken)return;$('ability-info').innerHTML=items.map(a=>`<div class="border-2 border-[#243b31] p-3"><strong>${esc(pretty(a.name))}</strong><p class="mb-0 text-sm">${esc(a.description)}</p></div>`).join('')});
      if(species.evolution_chain?.url){try{
        const chain=await pokeGateway.chain(species.evolution_chain.url);const names=[];
        function walk(node){names.push(node.species.name);node.evolves_to.forEach(walk)}walk(chain.chain);
        const members=await Promise.all(names.map(n=>pokeGateway.pokemon(n).catch(()=>null)));
        if(token!==detailToken)return;
        $('evolution-info').innerHTML=members.map((m,i)=>m?`<button class="evo-item" type="button" data-evo="${m.id}">${imageTag(m,`Sprite de ${m.name}`)}<span class="block text-xs font-bold">${esc(pretty(m.name))}</span></button>`:`<span class="evo-item">${esc(pretty(names[i]))}</span>`).join('');
        $('evolution-info').querySelectorAll('[data-evo]').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.evo)));
      }catch{if(token===detailToken)$('evolution-info').textContent='Cadeia evolutiva indisponível no momento.'}}
      else $('evolution-info').textContent='Cadeia evolutiva indisponível.';
    }catch(e){if(token===detailToken){$('detail-content').innerHTML='<h2 id="detail-title" class="pixel title">NÃO FOI POSSÍVEL CARREGAR</h2><p>Tente novamente com outro nome ou número.</p>';note(e.message)}}
  }
  $('home-search').addEventListener('submit',e=>{e.preventDefault();openDetail($('home-query').value.trim())});
  $('random-btn').addEventListener('click',()=>openDetail(Math.floor(Math.random()*1025)+1));
  $('list-query').addEventListener('input',filterList);
  $('type-filter').addEventListener('change',filterList);
  $('favorites-filter').addEventListener('click',()=>{favoritesOnly=!favoritesOnly;$('favorites-filter').setAttribute('aria-pressed',String(favoritesOnly));$('favorites-filter').textContent=favoritesOnly?'★ MOSTRANDO SALVOS':'☆ FAVORITOS';filterList()});
  $('prev-page').addEventListener('click',()=>{if(page>0){page--;renderList()}});
  $('next-page').addEventListener('click',()=>{if((page+1)*PAGE_SIZE<currentNames.length){page++;renderList()}});
  $('compare-form').addEventListener('submit',async e=>{
    e.preventDefault();const btn=e.submitter;btn.disabled=true;$('compare-results').textContent='Consultando Pokémon...';
    try{const [a,b]=await Promise.all([pokeGateway.pokemon($('compare-a').value),pokeGateway.pokemon($('compare-b').value)]);
      $('compare-results').innerHTML=[a,b].map(p=>`<article class="panel compare-card"><div class="text-center">${imageTag(p,`Sprite de ${p.name}`)}<h3 class="pixel" style="font-size:12px">${esc(pretty(p.name))} #${p.id}</h3></div>${statsHtml(p)}<p class="font-bold">Total: ${p.stats.reduce((n,s)=>n+s.base_stat,0)}</p><button type="button" class="btn small ghost" data-compare-open="${p.id}">VER DETALHES →</button></article>`).join('');
      $('compare-results').querySelectorAll('[data-compare-open]').forEach(b=>b.addEventListener('click',()=>openDetail(b.dataset.compareOpen)));
    }catch(err){$('compare-results').textContent='Não foi possível concluir a comparação.';note(err.message)}finally{btn.disabled=false}
  });
  const BATTLE_LEVEL=50, moveBatchSize=12;
  const typeEffectiveness={
    normal:{rock:.5,ghost:0,steel:.5},fire:{fire:.5,water:.5,grass:2,ice:2,bug:2,rock:.5,dragon:.5,steel:2},
    water:{fire:2,water:.5,grass:.5,ground:2,rock:2,dragon:.5},electric:{water:2,electric:.5,grass:.5,ground:0,flying:2,dragon:.5},
    grass:{fire:.5,water:2,grass:.5,poison:.5,ground:2,flying:.5,bug:.5,rock:2,dragon:.5,steel:.5},
    ice:{fire:.5,water:.5,grass:2,ice:.5,ground:2,flying:2,dragon:2,steel:.5},
    fighting:{normal:2,ice:2,poison:.5,flying:.5,psychic:.5,bug:.5,rock:2,ghost:0,dark:2,steel:2,fairy:.5},
    poison:{grass:2,poison:.5,ground:.5,rock:.5,ghost:.5,steel:0,fairy:2},ground:{fire:2,electric:2,grass:.5,poison:2,flying:0,bug:.5,rock:2,steel:2},
    flying:{electric:.5,grass:2,fighting:2,bug:2,rock:.5,steel:.5},psychic:{fighting:2,poison:2,psychic:.5,dark:0,steel:.5},
    bug:{fire:.5,grass:2,fighting:.5,poison:.5,flying:.5,psychic:2,ghost:.5,dark:2,steel:.5,fairy:.5},
    rock:{fire:2,ice:2,fighting:.5,ground:.5,flying:2,bug:2,steel:.5},ghost:{normal:0,psychic:2,ghost:2,dark:.5},
    dragon:{dragon:2,steel:.5,fairy:0},dark:{fighting:.5,psychic:2,ghost:2,dark:.5,fairy:.5},
    steel:{fire:.5,water:.5,electric:.5,ice:2,rock:2,steel:.5,fairy:2},
    fairy:{fire:.5,fighting:2,poison:.5,dragon:2,dark:2,steel:.5}
  };
  const statusLabels={burn:'queimado',poison:'envenenado',toxic:'muito envenenado',paralysis:'paralisado',sleep:'adormecido',freeze:'congelado'};
  const stageStats={'attack':'attack','defense':'defense','special-attack':'special-attack','special-defense':'special-defense','speed':'speed','accuracy':'accuracy','evasion':'evasion'};
  const localized=(items,language)=>items?.find(x=>x.language.name===language)?.name;
  const battleStat=(base,hp)=>Math.floor((2*base+15)*BATTLE_LEVEL/100)+(hp?BATTLE_LEVEL+10:5);
  const stageMultiplier=stage=>stage>=0?(2+stage)/2:2/(2-stage);
  function typeMultiplier(attackType,defender){
    return defender.p.types.reduce((value,item)=>value*(typeEffectiveness[attackType]?.[item.type.name]??1),1);
  }
  function describeMove(move){
    const category=move.damage_class.name==='physical'?'Físico':move.damage_class.name==='special'?'Especial':'Status';
    const effect=move.effect_entries?.find(x=>x.language.name==='pt')||move.effect_entries?.find(x=>x.language.name==='en');
    const flavor=move.flavor_text_entries?.find(x=>x.language.name==='pt')||move.flavor_text_entries?.find(x=>x.language.name==='en');
    return {
      id:move.id,name:localized(move.names,'pt-br')||localized(move.names,'pt')||pretty(move.name),
      type:move.type.name,typeLabel:types[move.type.name]||pretty(move.type.name),category,
      damageClass:move.damage_class.name,power:move.power,dynamicPower:['flail','reversal'].includes(move.name),accuracy:move.accuracy,pp:move.pp,
      description:(effect?.short_effect||flavor?.flavor_text||'Descrição indisponível.').replace(/[\n\f]+/g,' '),
      effect:move.effect,meta:move.meta,statChanges:move.stat_changes||[],target:move.target.name
    };
  }
  async function loadMoves(pokemon){
    const learned=[];
    pokemon.moves.forEach(entry=>{
      const details=entry.version_group_details;
      const levelGroups=details.filter(detail=>detail.move_learn_method.name==='level-up'&&detail.level_learned_at<=BATTLE_LEVEL);
      if(levelGroups.length){
        const frlg=levelGroups.find(detail=>detail.version_group.name==='firered-leafgreen');
        learned.push({name:entry.move.name,level:frlg?.level_learned_at??Math.max(...levelGroups.map(detail=>detail.level_learned_at)),priority:frlg?0:1});
        return;
      }
      const laterLevelGroups=details.filter(detail=>detail.move_learn_method.name==='level-up');
      if(laterLevelGroups.length){
        learned.push({name:entry.move.name,level:Math.max(...laterLevelGroups.map(detail=>detail.level_learned_at)),priority:2});
        return;
      }
      if(details.some(detail=>['machine','egg','tutor'].includes(detail.move_learn_method.name))){
        learned.push({name:entry.move.name,level:0,priority:3});
      }
    });
    const seen=new Set(), candidates=learned.filter(move=>!seen.has(move.name)&&seen.add(move.name))
      .sort((a,b)=>a.priority-b.priority||b.level-a.level);
    const usable=[];
    for(let offset=0;offset<candidates.length&&usable.length<4;offset+=moveBatchSize){
      const batch=candidates.slice(offset,offset+moveBatchSize);
      const details=await Promise.all(batch.map(async candidate=>{
        try{return await pokeGateway.get('/move/'+encodeURIComponent(candidate.name))}catch{return null}
      }));
      details.filter(Boolean).forEach(detail=>{
        const valid=(detail.damage_class.name==='physical'||detail.damage_class.name==='special')
          ?(Number.isFinite(detail.power)&&detail.power>0)||['flail','reversal'].includes(detail.name)
          :detail.damage_class.name==='status'&&Boolean(detail.stat_changes?.length||detail.meta?.ailment?.name&&detail.meta.ailment.name!=='none');
        if(valid&&detail.pp>0)usable.push(describeMove(detail));
      });
    }
    if(usable.length<4)throw new Error(`Não foi possível encontrar quatro golpes válidos para ${pretty(pokemon.name)}. Tente outro Pokémon.`);
    return usable.slice(0,4).map(move=>({...move,currentPP:move.pp}));
  }
  function log(text){const p=document.createElement('p');p.textContent='▸ '+text;$('battle-log').prepend(p)}
  function moveInfoHtml(move){
    return `<strong>${esc(move.name)}</strong> • ${esc(move.typeLabel)} • ${esc(move.category)}<br> poder: ${move.dynamicPower?'Variável':move.power??'—'} | precisão: ${move.accuracy??'—'}% | PP: ${move.currentPP}/${move.pp}<br>${esc(move.description)}`;
  }
  function showMoveInfo(move){$('move-info').innerHTML=moveInfoHtml(move)}
  function renderBattle(){
    if(!battle)return;
    $('fighters').innerHTML=battle.players.map((f,i)=>{
      const ratio=f.hp/f.max;
      return `<div class="fighter ${battle.winner!==null&&battle.winner!==i?'is-defeated':''} ${battle.winner===null&&battle.turn===i?'is-active':''} ${battle.animation?.attacker===i?'is-attacking':''} ${battle.animation?.defender===i?'is-hit':''} ${battle.animation?.defender===i&&battle.animation?.superEffective?'is-super-effective':''}" data-fighter="${i}">
        ${imageTag(f.p,`Sprite de ${f.p.name}`)}
        <div class="fighter-info"><div class="pixel">JOGADOR ${i+1} • ${esc(pretty(f.p.name))} • NV. ${BATTLE_LEVEL}</div>
        <div class="hp-line"><span>HP</span><div class="bar" role="progressbar" aria-label="HP de ${esc(pretty(f.p.name))}" aria-valuenow="${f.hp}" aria-valuemin="0" aria-valuemax="${f.max}"><span class="${ratio<.2?'hp-low':ratio<.5?'hp-mid':''}" style="width:${Math.max(0,ratio*100)}%"></span></div></div>
        <small>${f.hp} / ${f.max} HP</small></div></div>`;
    }).join('');
    const turn=$('turn-label');
    turn.className=`pixel my-5 ${battle.winner===null?`turn-player-${battle.turn+1}`:''}`;
    turn.textContent=battle.winner!==null?`JOGADOR ${battle.winner+1} VENCEU! • ${pretty(battle.players[battle.winner].p.name)} É O CAMPEÃO!`:`VEZ DO JOGADOR ${battle.turn+1} • ${pretty(battle.players[battle.turn].p.name)}`;
    $('move-grid').innerHTML=battle.players[battle.turn].moves.map((move,index)=>`<button class="move-button type-${esc(move.type)}" type="button" data-move="${index}" ${battle.winner!==null||battle.busy||move.currentPP===0?'disabled':''} aria-label="${esc(move.name)}, tipo ${esc(move.typeLabel)}, PP ${move.currentPP} de ${move.pp}">
      <span class="move-name">${esc(move.name)}</span><span class="move-meta"><span class="move-type">${esc(move.typeLabel)}</span><span>PP ${move.currentPP}/${move.pp}</span></span></button>`).join('');
    $('move-area').classList.toggle('hidden',battle.winner!==null);
    $('restart').textContent=battle.winner!==null?'NOVA BATALHA ↻':'REINICIAR ↻';
    if(battle.selectedMove)showMoveInfo(battle.selectedMove);
    else showMoveInfo(battle.players[battle.turn].moves.find(move=>move.currentPP>0)||battle.players[battle.turn].moves[0]);
  }
  function makeFighter(p,moves){
    const stats={};p.stats.forEach(item=>{stats[item.stat.name]=battleStat(item.base_stat,item.stat.name==='hp')});
    return {p,moves,stats,hp:stats.hp,max:stats.hp,stages:{attack:0,defense:0,'special-attack':0,'special-defense':0,speed:0,accuracy:0,evasion:0},status:null};
  }
  $('battle-form').addEventListener('submit',async e=>{
    e.preventDefault();const btn=e.submitter;btn.disabled=true;battle=null;$('arena').classList.add('hidden');note('Carregando Pokémon e movimentos da PokéAPI...');
    try{
      const [a,b]=await Promise.all([pokeGateway.pokemon($('fighter-a').value),pokeGateway.pokemon($('fighter-b').value)]);
      const [movesA,movesB]=await Promise.all([loadMoves(a),loadMoves(b)]);
      const players=[makeFighter(a,movesA),makeFighter(b,movesB)];
      const turn=players[0].stats.speed===players[1].stats.speed?Math.floor(Math.random()*2):players[0].stats.speed>players[1].stats.speed?0:1;
      battle={players,turn,winner:null,busy:false,selectedMove:null};
      $('arena').classList.remove('hidden');$('battle-log').replaceChildren();
      log(`Batalha iniciada no nível ${BATTLE_LEVEL}! ${pretty(players[turn].p.name)} é mais veloz e começa.`);
      renderBattle();note('');
    }catch(err){note(err.message)}
    finally{btn.disabled=false}
  });
  $('move-grid').addEventListener('pointerover',e=>{
    const button=e.target.closest('[data-move]');if(button&&battle)showMoveInfo(battle.players[battle.turn].moves[Number(button.dataset.move)]);
  });
  $('move-grid').addEventListener('focusin',e=>{
    const button=e.target.closest('[data-move]');if(button&&battle)showMoveInfo(battle.players[battle.turn].moves[Number(button.dataset.move)]);
  });
  $('move-grid').addEventListener('click',e=>{
    const button=e.target.closest('[data-move]');if(button)performMove(Number(button.dataset.move));
  });
  function effectiveAccuracy(move,attacker,defender){
    const base=move.accuracy??100;
    return Math.min(100,base*stageMultiplier(attacker.stages.accuracy)/stageMultiplier(defender.stages.evasion));
  }
  function applyMoveEffects(move,attacker,defender){
    const selfTarget=move.target.includes('user')||move.target.includes('ally');
    const target=selfTarget?attacker:defender;
    let changed=false;
    move.statChanges.forEach(change=>{
      const stat=stageStats[change.stat.name];
      if(stat&&change.change){const before=target.stages[stat];target.stages[stat]=Math.max(-6,Math.min(6,before+change.change));changed=changed||before!==target.stages[stat]}
    });
    const ailment=move.meta?.ailment?.name, chance=move.meta?.ailment_chance||0;
    if(ailment&&ailment!=='none'&&!target.status&&Math.random()*100<chance){target.status=ailment;changed=true;log(`${pretty(target.p.name)} ficou ${statusLabels[ailment]||pretty(ailment)}!`)}
    if(move.statChanges.length)log(`${pretty(target.p.name)} ${changed?'teve seus atributos alterados!':'não pode mais alterar esses atributos!'}`);
    return changed;
  }
  function moveDamage(move,attacker,defender){
    const physical=move.damageClass==='physical', attackKey=physical?'attack':'special-attack', defenseKey=physical?'defense':'special-defense';
    let attack=attacker.stats[attackKey]*stageMultiplier(attacker.stages[attackKey]);
    if(physical&&attacker.status==='burn')attack*=.5;
    const defense=defender.stats[defenseKey]*stageMultiplier(defender.stages[defenseKey]);
    const hpRatio=attacker.hp/attacker.max;
    const power=move.dynamicPower?hpRatio>.6875?20:hpRatio>.3542?40:hpRatio>.2083?80:hpRatio>.1042?100:150:move.power;
    const raw=Math.floor(Math.floor(Math.floor((2*BATTLE_LEVEL/5+2)*power*attack/defense)/50)+2);
    const stab=attacker.p.types.some(type=>type.type.name===move.type)?1.5:1;
    const effectiveness=typeMultiplier(move.type,defender);
    const variation=(85+Math.floor(Math.random()*16))/100;
    return {damage:effectiveness===0?0:Math.max(1,Math.floor(raw*stab*effectiveness*variation)),effectiveness};
  }
  async function performMove(index){
    if(!battle||battle.winner!==null||battle.busy)return;
    const playerIndex=battle.turn,attacker=battle.players[playerIndex],defender=battle.players[1-playerIndex],move=attacker.moves[index];
    if(!move||move.currentPP<=0){log('Esse golpe não tem PP suficiente!');return}
    battle.busy=true;move.currentPP--;battle.selectedMove=move;
    battle.animation={attacker:playerIndex,defender:null,superEffective:false};
    log(`${pretty(attacker.p.name).toLocaleUpperCase('pt-BR')} USOU ${move.name.toLocaleUpperCase('pt-BR')}!`);
    if(Math.random()*100>=effectiveAccuracy(move,attacker,defender)){
      log('O ATAQUE ERROU!');
    }else if(move.damageClass==='status'){
      const changed=applyMoveEffects(move,attacker,defender);
      if(!changed)log('O ATAQUE NÃO CAUSOU DANO!');
    }else{
      const result=moveDamage(move,attacker,defender);
      if(result.effectiveness===0){log('NÃO TEVE EFEITO!');}
      else{
        defender.hp=Math.max(0,defender.hp-result.damage);
        battle.animation.defender=1-playerIndex;
        battle.animation.superEffective=result.effectiveness>1;
        if(result.effectiveness>1){log('O ATAQUE FOI SUPER EFETIVO!')}
        else if(result.effectiveness<1)log('NÃO FOI MUITO EFETIVO...');
        log(`${pretty(defender.p.name)} perdeu ${result.damage} pontos de HP!`);
        applyMoveEffects(move,attacker,defender);
      }
    }
    if(defender.hp===0){battle.winner=playerIndex;log(`JOGADOR ${playerIndex+1} VENCEU! ${pretty(attacker.p.name)} venceu a batalha!`)}
    renderBattle();
    await new Promise(resolve=>setTimeout(resolve,560));
    if(battle.winner===null)battle.turn=1-playerIndex;
    battle.animation=null;battle.selectedMove=null;battle.busy=false;renderBattle();
  }
  $('restart').addEventListener('click',()=>{battle=null;$('arena').classList.add('hidden');$('battle-log').replaceChildren();$('battle-form').scrollIntoView({behavior:'smooth',block:'center'})});
  Object.keys(types).forEach(key=>{const option=document.createElement('option');option.value=key;option.textContent=types[key];$('type-filter').append(option)});
  loadIndex();
  pokeGateway.pokemon(25).then(p=>{$('featured-name').textContent=`#${p.id} ${pretty(p.name)}`;$('featured-sprite').src=sprite(p);$('featured-sprite').alt=`Sprite de ${p.name}`}).catch(()=>{$('featured-name').textContent='Explore a Pokédex!'});
})();
