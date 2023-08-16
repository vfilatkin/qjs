(function () {
  'use sctict';

  const CFG = {
    app: null,
    digest: null
  }

  const
    GET = {
      method: 'GET',
      headers: { 'Accept': 'application/json; odata=verbose' },
      credentials: 'include'
    },
    POST = body => ({
      method: 'POST',
      headers: {
        'accept': 'application/json; odata=verbose',
        'content-type': 'application/json; odata=verbose',
        'contentType': 'application/json;charset=utf-8',
        'X-RequestDigest': CFG.digest,
      },
      body: body,
      credentials: 'include'
    }),
    POST__BATCH = (bID, body) => ({
      method: 'POST',
      headers: {
        'Accept': 'application/json; odata=verbose',
        'content-type': 'multipart/mixed;boundary="batch_' + bID + '"',
        'X-RequestDigest': CFG.digest,
      },
      body: body,
      credentials: 'include'
    });

  function reqDigest() {
    return fetch(`/${CFG.app}/_api/contextinfo`, POST())
      .then(resJSON)
      .then(r => {
        r = r.d.GetContextWebInformation;
        CFG.digest = r.FormDigestValue;
        console.log(CFG.digest);
        let t = setTimeout(() => {
          CFG.digest = null;
          clearTimeout(t);
        }, r.FormDigestTimeoutSeconds * 1000)
      })
  }

  function resJSON(resp) {
    if (resp.ok) {
      return resp.json();
    }
    else {
      resp.text().then(e => console.error(JSON.parse(e).error.message.value))
    }
  }

  function resItem(cKeys, cNames, item) {
    let res = {};
    cKeys.forEach((cKey, i) => {
      let cName = cNames[i];
      if (typeof cName === 'string')
        return res[cKey] = item[cName];
      res[cKey] = resItems(cName[1].$cols, item[cName[0]].results)
    });
    return res;
  }

  function resItems(cols, items) {
    let
      cKeys = Object.keys(cols),
      cNames = Object.values(cols);
    return items.map(item => resItem(cKeys, cNames, item))
  }

  function reqItem(cols, item, type) {
    let req = {}, iKeys = Object.keys(item);
    iKeys.forEach(key => {
      return req[cols[key]] = item[key];
    });
    req.__metadata = { type: type };
    return req;
  }

  function reqItems(cols, items, type) {
    return items.map(item => reqItem(cols, item, type))
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
      $sel.length > 0 ? '$select=' + $sel.join() : undefined,
      $exp.length > 0 ? '$expand=' + $exp.join() : undefined
    ].filter(p => p !== undefined).join('&');
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

    console.log(body.join('\r\n'));
    return POST__BATCH(bID, body.join('\r\n'));
  }

  function optToStr(opt, cols) {
    let str = '', $sel = $select(cols), keys = Object.keys(opt);
    str = '?' + keys.map(k => {
      return `$${k}=${opt[k]}`;
    }).join('&');
    return str ? str + '&' + $sel : '?' + $sel;
  }

  function Q(src, cols, type) {
    return {
      $cols: cols,
      $src: src,
      $type: type,
      ...cols
    }
  }

  /* qType - for batch request only. */
  Q.create = function (ref, data) {
    return {
      qType: 1,   
      ref: ref,
      data: data
    }
  }

  function post(Q) {
    let q = () => fetch(
      `/${CFG.app}/_api/lists(guid'${Q.ref.$src}')/items`,
      POST(JSON.stringify(reqItem(Q.ref.$cols, Q.data, Q.ref.$type)))
    )
      .then(resJSON)
      .then(r => resItem(Object.keys(Q.ref.$cols), Object.values(Q.ref.$cols), r.d));
    if (CFG.digest) return q();
    return reqDigest().then(q);
  }

  Q.get = function (L, O) {
    return fetch(
      `/${CFG.app}/_api/lists(guid'${L.$src}')/items${optToStr(O, L.$cols)}`,
      GET
    )
      .then(resJSON)
      .then(r => resItems(L.$cols, r.d.results));
  }


  Q.post = function (Q) {
    if (Q.length) return
    return post(Q);
  }

  Q.config = function (cfg) {
    CFG.app = cfg.app;
  }

  window.Q = Q;
})();