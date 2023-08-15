(function () {
  'use sctict';
  const MSG = msg => `[q.js]: ${msg}`;

  const CFG = {
    app: null,
    digest: null
  }

  const REQ = {
    GET: () => ({
      method: 'GET',
      headers: new Headers({ 'Accept': 'application/json; odata=verbose' }),
      credentials: 'include'
    }),
    POST: body => ({
      method: 'POST',
      headers: new Headers({
        'accept': 'application/json; odata=verbose',
        'content-type': 'application/json; odata=verbose',
        'type': 'POST',
        'contentType': 'application/json;charset=utf-8'
      }),
      body: body,
      credentials: 'include'
    }),
    POST__BATCH: (digest, bID, body) => ({
      method: 'POST',
      headers: { 'X-RequestDigest': digest, 'content-type': 'multipart/mixed;boundary="batch_' + bID + '"' },
      body: body,
      credentials: 'include'
    })
  }

  function rDigest(){
    return fetch(`/${CFG.app}/_api/contextinfo`, REQ.POST())
    .then(rJSON)
    .then(r => {
      r = r.d.GetContextWebInformation;
      CFG.digest = r.FormDigestValue;
      console.log(CFG.digest);
      let t = setTimeout(()=>{
        CFG.digest = null;
        clearTimeout(t);
      }, r.FormDigestTimeoutSeconds * 1000)
    })
  }

  function UUID() {
    var d = new Date().getTime();
    var uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
    });
    return uuid;
  };

  function $batch(ePoint, items) {
    const bID = UUID();
    const cSID = UUID();
    const body = [
      '--batch_' + bID,
      'Content-Type: multipart/mixed; boundary="changeset_' + cSID + '"',
      'Content-Transfer-Encoding: binary',
      ''
    ];
    const w = data => body.push(data);
    for (let i = 0, iL = items.length; i < iL; i++) {
      let item = items[i];
      w('--changeset_' + cSID);
      w('Content-Type: application/http');
      w('Content-Transfer-Encoding: binary');
      w('');
      w('POST ' + ePoint + ' HTTP/1.1');
      w('Content-Type: application/json;odata=verbose');
      w('');
      w(JSON.stringify(item));
      w('');
    }
    w('--changeset_' + cSID + '--');
    w('--batch_' + bID + '--');
  
    return  REQ.POST__BATCH(CFG.digest, bID, body.join('\r\n'));
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

  function query(cols) {
    return $select(cols).filter(p => p !== undefined).join('&')
  }

  function Q(src, cols , type) {
    return {
      $cols: cols,
      $src: src,
      $type: type,
      get: function(filter) {
        return fetch(
          `/${CFG.app}/_api/lists(guid'${src}')/items?$filter=${filter}&${query(cols)}`,
          REQ.GET()
        )
          .then(rJSON)
          .then(r => getItems(this.$cols, r.d.results));
      },
      post: function (item){
        let q = () => fetch(`/${CFG.app}/_api/lists(guid'${src}')/items`, REQ.POST(JSON.stringify(item)));
        if(CFG.digest) return q();
        rDigest().then(q);
      },
      batch: function(items) {
        let q = () => fetch(`/${CFG.app}/_api/$batch`, REQ.POST($batch(`/${CFG.app}/_api/lists(guid'${src}')/items`, items)));
        if(CFG.digest) return q();
        rDigest().then(q);
      },
      ...cols
    }
  }

  Q.config = function (cfg) {
    CFG.app = cfg.app;
  }

  window.Q = Q;
})();