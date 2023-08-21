let QRes, QResp;
(function () {
  const CFG = {
    resources: []
  };

  const DATABASE = {};

  function URLParams(url){
    let params = {};
    Array.from(url.searchParams.entries()).forEach(p => params[p[0]] = p[1])
    return params;
  }

  function URLEndpoint(url){
    return url.pathname.split(/\//g).slice(3);
  }

  function URLData(url){
    try { url = new URL(url); } catch { url = new URL('http://local' + url); };
    return {
      endpoint: URLEndpoint(url),
      params: URLParams(url)
    }
  }

  const contextinfo = {
    GetContextWebInformation: {
      FormDigestValue: 'VERY__UNIQUE__DIGEST__VALUE',
      FormDigestTimeoutSeconds: 1800
    }
  }

  function tryGetList(endpoint){
    return DATABASE[endpoint.split(/\'/g)[1]];
  }

  function handleListQuery(list, url){
    if(url.endpoint[1] === 'items') return list.data;
  }

  function handleEndpoint(url, data){
    url = URLData(url);
    let endpoint = url.endpoint;
    switch(endpoint[0]){
      case 'contextinfo':
        return contextinfo;
      case '$batch':
        return console.warn('$batch is not implemented yet.')
      default:
        return handleListQuery(tryGetList(endpoint[0]), url) 
    }
  }

  QRes = (resource, data) => {
    CFG.resources.push({resource: resource, data: data});
  }

  QResp = data => {
    return data.length? {d: {results: data}} : {d:data}
  }

  let handleResource = (resource, options) => {
    for (const rData of CFG.resources){
      if (rData.resource(resource, options)) return rData.data();
    }
  }

  let getData = (resource, options) => handleResource(resource, options);

  function delay(ms) { 
    return new Promise((resolve, reject) => { 
      setTimeout(() => { resolve();}, ms);
    });
  }

  function response(resource, options) {
    console.log('RESPONSE:', handleEndpoint(resource, options))
    return { 
      ok: true, 
      json: () => getData(resource, options),
      text: () => getData(resource, options)
    }
  }

  function toItem(ref, item){
    let entry = {};
    Object.keys(ref.cols).forEach(key => {
      let col = ref.cols[key];
      if(typeof col === 'string') return entry[col] = item[key];
      return entry[col[0]] = toItems(col[1], item[key])
    });
    return entry;
  }

  function toItems(ref, items){
    return items.map(item => toItem(ref, item));
  }

  (function(){
    if(Q) {
      Q.fill = function (ref, items) {
        items = toItems(ref, items)
        DATABASE[ref.src] = {ref: ref, type: ref.type, data: items};
      }
    } else {
      throw '[QTest.js]: Q.js was not initialized.'
    }
    window.fetch = function(resource, options){
      return delay(1000).then(() => response(resource, options))
    }
  })();
})();

