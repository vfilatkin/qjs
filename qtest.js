let QRes, QResp;
(function () {

  const CFG = {
    resources: []
  };

  const DATABASE = {};

  function handleURLParams(url){
    let params = {};
    Array.from(url.searchParams.entries()).forEach(p => params[p[0]] = p[1])
    return params;
  }

  function handleURL(url){
    try { url = new URL(url); } catch { url = new URL('http://local' + url); };
    return {
      url: url,
      params: handleURLParams(url)
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

  let delay = ms => { 
    return new Promise((resolve, reject) => { 
      setTimeout(() => { resolve();}, ms);
    });
  }

  let response = (resource, options) => {
    console.log('URL:', resource);
    console.log('OPTIONS:', options);
    console.log('URL_ODATA:', handleURL(resource));
    return { 
      ok: true, 
      json: () => getData(resource, options),
      text: () => getData(resource, options)
    }
  }

  window.fetch = function(resource, options){
    return delay(1000).then(() => response(resource, options))
  }
})();

