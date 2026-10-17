/* This candidate has no network backend. Do not mutate or migrate existing saves. */
(() => {
  'use strict';
  const nativeFetch = window.fetch.bind(window);
  window.fetch = (input, options) => {
    const address = new URL(typeof input === 'string' ? input : input.url, location.href);
    if (address.protocol === 'blob:' || address.protocol === 'data:' || address.origin === location.origin) {
      return nativeFetch(input, options);
    }
    return Promise.reject(new Error('本地测试候选尚未接入联网服务；游戏与存档仍可离线使用。'));
  };
  if (navigator.sendBeacon) navigator.sendBeacon = () => false;
  let active=true,generation=0;
  const streams=new Set();
  if(navigator.mediaDevices?.getUserMedia){
    const getMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia=async constraints=>{
      if(!active)throw new Error('应用已暂停，未开始采集。');
      const token=generation,stream=await getMedia(constraints);
      if(!active||token!==generation){stream.getTracks().forEach(track=>track.stop());throw new Error('采集请求已取消。');}
      streams.add(stream);return stream;
    };
  }
  window.CatOfflineMedia={get generation(){return generation;},suspend(){if(!active)return;active=false;generation++;for(const stream of streams)stream.getTracks().forEach(track=>track.stop());streams.clear();},resume(){active=true;}};
  window.CatOfflineBuild = Object.freeze({ protocolVersion: 1, deviceAdapter: 'not-integrated', network: 'offline', localSocial: 'prototype' });
})();
