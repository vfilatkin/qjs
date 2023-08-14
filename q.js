(function () {
  'use sctict'
  const MSG = msg => `[q.js]: ${msg}`;
  const REQ = {
    GET: { method: 'GET', headers: new Headers({ 'Accept': 'application/json; odata=verbose' }), credentials: 'include' }
  }

  function rJSON(resp) {
    if (resp.ok) {
      return resp.json();
    }
    else {
      resp.text().then(e => console.error(JSON.parse(e).error.message.value))
    }
  }

  function getItem(cKeys, cNames, item) {
    let res = {};
    cKeys.forEach((cKey, i) => {
      let cName = cNames[i];
      if (typeof cName === 'string')
        return res[cKey] = item[cName];
      res[cKey] = getItems(cName[1].$cols, item[cName[0]].results)
    });
    return res;
  }

  function getItems(cols, items) {
    let
      cKeys = Object.keys(cols),
      cNames = Object.values(cols);
    return items.map(item => getItem(cKeys, cNames, item))
  }

  const CFG = {
    app: null,
  }

  function $select(cols) {
    let $sel = [], $exp = [];
    Object.values(cols).forEach(col => {
      if (typeof col === 'string')
        return $sel.push(col);
      let exColKey = col[0];
      let exColData = col[1];
      $exp.push(col[0]);
      Object.values(exColData.$cols).forEach(exCol => {
        $sel.push(`${exColKey}/${exCol}`);
      })
    })
    return [
      $sel.length > 0 ? '$select=' + $sel.join(): undefined,
      $exp.length > 0 ? '$expand=' + $exp.join() : undefined
    ];
  }

  function Query(cols) {
    return $select(cols).filter(p => p !== undefined).join('&')
  }

  function Q(src, cols , type) {
    return {
      $cols: cols,
      $src: src,
      $type: type,
      get: function (filter) {
        return fetch(
          `/${CFG.app}/_api/lists(guid'${src}')/items?$filter=${filter}&${Query(cols)}`,
          REQ.GET
        )
          .then(rJSON)
          .then(r => getItems(this.$cols, r.d.results));
      },
      ...cols
    }
  }

  Q.config = function (cfg) {
    CFG.app = cfg.app;
  }

  window.Q = Q;
})();