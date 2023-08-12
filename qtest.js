(function () {
  const getData = (resource, options) => {return { d:{ results:[] } }};
  const response = (resource, options) => { return { ok: true, json: () => getData(resource, options) }}
  const delay = ms => {
    return new Promise((resolve, reject) => { setTimeout(() => { resolve();}, ms);});
  }

  window.fetch = function(resource, options){
    return delay(1000).then(() => response(resource, options))
  }
})();