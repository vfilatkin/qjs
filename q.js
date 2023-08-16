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
      .then(res => {
        res = res.d.GetContextWebInformation;
        CFG.digest = res.FormDigestValue;
        let t = setTimeout(() => {
          CFG.digest = null;
          clearTimeout(t);
        }, res.FormDigestTimeoutSeconds * 1000)
      })
  }

  function resJSON(res) {
    if (res.ok) {
      return res.json();
    }
    else {
      res.text().then(e => console.error(JSON.parse(e).error.message.value))
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
  Q.create = function (act, data) {
    return {
      type: 1,
      ref: act,
      data: data
    }
  }
  Q.update = function (ref, id, data) {
    return {
      type: 2,
      ref: ref,
      id: id,
      data: data
    }
  }
  Q.delete = function (ref, id) {
    return {
      type: 3,
      ref: ref,
      id: id,
    }
  }

  const URL__ITEMS = id => `/${CFG.app}/_api/lists(guid'${id}')/items`;

  function prepOpnEndPoint(opn) {
    let eP = URL__ITEMS(opn.ref.$src);
    return opn.type === 1 ? eP : eP + `(${opn.id})`;
  }

  function prepOpnData(opn) {
    /*TODO: Add headers for UPDATE and DELETE requests.*/
    return POST(JSON.stringify(reqItem(opn.ref.$cols, opn.data, opn.ref.$type)));
  }

  function postImpl(opn) {
    let q = () => fetch(prepOpnEndPoint(opn), prepOpnData(opn))
      .then(resJSON)
      .then(r => resItem(Object.keys(opn.ref.$cols), Object.values(opn.ref.$cols), r.d));
    if (CFG.digest) return q();
    return reqDigest().then(q);
  }

  Q.get = function (ref, opt) {
    return fetch(
      URL__ITEMS(ref.$src) + optToStr(opt, ref.$cols),
      GET
    )
      .then(resJSON)
      .then(r => resItems(ref.$cols, r.d.results));
  }

  Q.post = function (opn) {
    if (opn.length) return
    return postImpl(opn);
  }

  Q.config = function (cfg) {
    CFG.app = cfg.app;
  }

  window.Q = Q;
})();