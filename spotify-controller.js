/* Authoritative Spotify controller. Search-song navigation is app-controlled. */
(()=>{
  'use strict';
  const byId=id=>document.getElementById(id);
  const status=message=>{const node=byId('spotifyStatus');if(node)node.textContent=message};
  const controller={queue:[],baseQueue:[],index:-1,contextUri:null,busy:false,shuffle:false};

  async function ready(){
    if(!state.spotify.player){
      if(typeof loadSDK==='function')loadSDK();
      throw new Error('Spotify player is loading. Tap Enable Player once it is ready.');
    }
    if(!state.spotify.deviceId)throw new Error('Spotify player is still connecting.');
    try{await state.spotify.player.activateElement()}catch{}
    if(!state.spotify.activated){
      await api('/me/player',{method:'PUT',body:JSON.stringify({device_ids:[state.spotify.deviceId],play:false})});
      state.spotify.activated=true;
      const login=byId('spotifyLoginBtn');if(login)login.textContent='Player Enabled';
    }
    return state.spotify.deviceId;
  }

  async function refreshUi(){
    try{const s=await state.spotify.player?.getCurrentState();if(s&&typeof renderSpotifyState==='function')renderSpotifyState(s)}catch{}
  }

  function buildVisibleTrackQueue(selected){
    const tracks=(state.spotify.items||[]).filter(x=>x?.kind==='track'&&x?.uri);
    const unique=[];const seen=new Set();
    for(const track of tracks){
      if(!seen.has(track.uri)){seen.add(track.uri);unique.push(track)}
    }
    if(selected?.uri&&!seen.has(selected.uri))unique.unshift(selected);
    return unique;
  }

  async function playQueueIndex(index){
    const deviceId=await ready();
    if(!controller.queue.length)throw new Error('No song queue is loaded. Search for songs and play one first.');
    const bounded=Math.max(0,Math.min(controller.queue.length-1,index));
    const selected=controller.queue[bounded];
    const uris=controller.queue.map(x=>x.uri);
    await api('/me/player/play?device_id='+encodeURIComponent(deviceId),{
      method:'PUT',
      body:JSON.stringify({uris,offset:{position:bounded},position_ms:0})
    });
    controller.index=bounded;
    controller.contextUri=null;
    status('Playing '+(selected?.name||'song')+'…');
    setTimeout(refreshUi,450);
  }

  async function play(item){
    if(!item||controller.busy)return;
    controller.busy=true;
    try{
      if(item.kind==='track'){
        controller.baseQueue=buildVisibleTrackQueue(item);
        controller.queue=[...controller.baseQueue];
        controller.index=Math.max(0,controller.queue.findIndex(x=>x.uri===item.uri));
        if(controller.shuffle)applyShuffle(item.uri);
        await playQueueIndex(controller.index);
      }else{
        const deviceId=await ready();
        controller.queue=[];
        controller.baseQueue=[];
        controller.index=-1;
        controller.contextUri=item.uri;
        await api('/me/player/play?device_id='+encodeURIComponent(deviceId),{
          method:'PUT',
          body:JSON.stringify({context_uri:item.uri,offset:{position:0},position_ms:0})
        });
        status('Playing '+(item.name||'selection')+'…');
        setTimeout(refreshUi,450);
      }
    }catch(error){
      console.error('Spotify play failed',error);
      status(error.message||'Spotify playback failed.');
    }finally{controller.busy=false}
  }

  async function syncQueueIndexFromPlayer(){
    if(!controller.queue.length)return;
    try{
      const playback=await state.spotify.player?.getCurrentState();
      const uri=playback?.track_window?.current_track?.uri;
      const found=controller.queue.findIndex(x=>x.uri===uri);
      if(found>=0)controller.index=found;
    }catch{}
  }

  async function skip(direction){
    if(controller.busy)return;
    controller.busy=true;
    try{
      await ready();
      await syncQueueIndexFromPlayer();

      // For search/recent-song results, explicitly start the prior/next URI.
      // This avoids Spotify Connect's inconsistent next/previous behavior.
      if(controller.queue.length){
        const delta=direction==='previous'?-1:1;
        const target=controller.index+delta;
        if(target<0){status('Already at the first song');return;}
        if(target>=controller.queue.length){status('Already at the last song');return;}
        await playQueueIndex(target);
        return;
      }

      // Album/playlist contexts can use Spotify's native context navigation.
      const deviceId=state.spotify.deviceId;
      const endpoint=direction==='previous'?'/me/player/previous':'/me/player/next';
      await api(endpoint+'?device_id='+encodeURIComponent(deviceId),{method:'POST'});
      status(direction==='previous'?'Previous song':'Next song');
      setTimeout(refreshUi,350);
    }catch(error){
      console.error('Spotify navigation failed',error);
      status(error.message||'Could not change songs. Start a song from the visible song results first.');
    }finally{controller.busy=false}
  }


  function shuffleArray(items){
    const copy=[...items];
    for(let i=copy.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      [copy[i],copy[j]]=[copy[j],copy[i]];
    }
    return copy;
  }

  function updateShuffleButton(){
    const button=byId('shuffleBtn');if(!button)return;
    button.classList.toggle('active',controller.shuffle);
    button.setAttribute('aria-pressed',String(controller.shuffle));
    button.title=controller.shuffle?'Turn shuffle off':'Turn shuffle on';
  }

  function applyShuffle(currentUri){
    if(!controller.baseQueue.length)return;
    const current=controller.baseQueue.find(x=>x.uri===currentUri)||controller.queue[controller.index]||controller.baseQueue[0];
    const rest=controller.baseQueue.filter(x=>x.uri!==current?.uri);
    controller.queue=current?[current,...shuffleArray(rest)]:shuffleArray(rest);
    controller.index=0;
  }

  async function toggleShuffle(){
    if(controller.busy)return;
    controller.busy=true;
    try{
      await ready();
      await syncQueueIndexFromPlayer();
      const currentUri=controller.queue[controller.index]?.uri;
      controller.shuffle=!controller.shuffle;
      if(controller.baseQueue.length){
        if(controller.shuffle)applyShuffle(currentUri);
        else{
          controller.queue=[...controller.baseQueue];
          controller.index=Math.max(0,controller.queue.findIndex(x=>x.uri===currentUri));
        }
      }else{
        await api('/me/player/shuffle?state='+String(controller.shuffle)+'&device_id='+encodeURIComponent(state.spotify.deviceId),{method:'PUT'});
      }
      updateShuffleButton();
      status(controller.shuffle?'Shuffle on':'Shuffle off');
    }catch(error){
      controller.shuffle=!controller.shuffle;
      updateShuffleButton();
      console.error('Spotify shuffle failed',error);
      status(error.message||'Could not change shuffle.');
    }finally{controller.busy=false}
  }

  async function toggle(){
    try{await ready();await state.spotify.player.togglePlay();setTimeout(refreshUi,250)}
    catch(error){console.error(error);status(error.message||'Could not play or pause Spotify.')}
  }

  let muted=false;
  let volumeBeforeMute=0.7;
  async function toggleMute(){
    try{
      await ready();
      const current=await state.spotify.player.getVolume();
      if(!muted){
        volumeBeforeMute=current>0.01?current:volumeBeforeMute;
        await state.spotify.player.setVolume(0);
        muted=true;
      }else{
        await state.spotify.player.setVolume(volumeBeforeMute||0.7);
        muted=false;
      }
      const button=byId('muteSpotifyBtn');
      if(button){
        button.setAttribute('aria-pressed',String(muted));
        button.textContent=muted?'🔇 Unmute':'🔊 Mute';
      }
      status(muted?'Spotify muted':'Spotify unmuted');
    }catch(error){console.error(error);status(error.message||'Could not change Spotify volume.')}
  }

  function replaceButton(id,handler){
    const old=byId(id);if(!old)return;
    const fresh=old.cloneNode(true);old.replaceWith(fresh);
    fresh.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
  }

  function bind(){
    try{playSpotify=play}catch(error){console.warn('Could not replace playSpotify route',error)}
    replaceButton('playPauseBtn',toggle);
    replaceButton('muteSpotifyBtn',toggleMute);
    window.SpotifyController={
      play,
      previous:()=>skip('previous'),
      next:()=>skip('next'),
      toggle,
      mute:toggleMute,
      shuffle:toggleShuffle,
      ready,
      debug:()=>({...controller,queue:controller.queue.map(x=>({name:x.name,uri:x.uri})),baseQueue:controller.baseQueue.map(x=>({name:x.name,uri:x.uri}))})
    };
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',bind,{once:true});
  else bind();
})();
