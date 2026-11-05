let sdkPromise;
export function loadNaverMaps(id) {
  if (sdkPromise) return sdkPromise;
  if (window.naver?.maps?.Map) return Promise.resolve(window.naver.maps);
  if (!sdkPromise) sdkPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.async = true;
    let settled = false;
    const timeout = setTimeout(() => finish(new Error('MAP_TIMEOUT')), 12000);
    const finish = error => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      delete window.historyMapReady;
      if (error) { script.remove(); reject(error); }
      else resolve(window.naver.maps);
    };
    window.historyMapReady = () => finish();
    window.navermap_authFailure = () => finish(new Error('MAP_AUTH_FAILED'));
    script.src = `https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=${encodeURIComponent(id)}&submodules=gl&callback=historyMapReady`;
    script.onerror = () => finish(new Error('MAP_LOAD_FAILED'));
    document.head.appendChild(script);
  }).catch(error => { sdkPromise = null; throw error; });
  return sdkPromise;
}
