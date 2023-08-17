let QRes, QResp;
(function () {

  const CFG = {
    resources: []
  };

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
    console.log(resource, options);
    return { 
      ok: true, 
      json: () => getData(resource, options) 
    }
  }

  window.fetch = function(resource, options){
    return delay(1000).then(() => response(resource, options))
  }
})();

