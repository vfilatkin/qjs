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
      res[cKey] = getItems(cName.$cols, item[cName.$src].results)
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
      $exp.push(col.$src);
      Object.values(col.$cols).forEach(exCol => {
        $sel.push(`${col.$src}/${exCol}`);
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

  function Q(src, cols) {
    return {
      $cols: cols,
      $src: src,
      get: function (filter) {
        return fetch(
          `/${CFG.app}/_api/lists(guid'${src}')/items?$filter=Id eq 2379&${Query(cols)}`,
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