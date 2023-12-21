const CFG = {
  app: null,
  digest: null
},

GET = {
  method: 'GET',
  headers: { 'Accept': 'application/json; odata=verbose' },
  credentials: 'include'
},

POST = (body, type) => ({
  method: type === 1 ? 'POST' : type === 2 ? 'MERGE' : 'DELETE',
  headers: {
    'accept': 'application/json; odata=verbose',
    'content-type': 'application/json; odata=verbose',
    'contentType': 'application/json;charset=utf-8',
    'X-RequestDigest': CFG.digest,
    ...(type > 1 && { 'IF-MATCH': '*' })
  },
  body: body,
  credentials: 'include'
}),

URL__ITEMS = id => `/${CFG.app}/_api/lists(guid'${id}')/items`,
URL__BATCH = () => `/${CFG.app}/_api/$batch`,
ERR = res => res.text().then(e => console.error(JSON.parse(e).error.message.value));

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
  if (res.ok) return res.json();
  ERR(res);
}

function resItem(cKeys, cNames, item) {
  let res = {};
  cKeys.forEach((cKey, i) => {
    let cName = cNames[i];
    if (typeof cName === 'string')
      return res[cKey] = item[cName];
    res[cKey] = resItems(cName[1].cols, item[cName[0]].results)
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

function prepOpnEndPoint(opn) {
  let eP = URL__ITEMS(opn.ref.src);
  return opn.type === 1 ? eP : eP + `(${opn.id})`;
}

function prepOpnData(opn) {
  return opn.data && JSON.stringify(reqItem(opn.ref.cols, opn.data, opn.ref.type));
}

function $select(cols) {
  let $sel = [], $exp = [];
  Object.values(cols).forEach(col => {
    if (typeof col === 'string')
      return $sel.push(col);
    let exColKey = col[0];
    let exColData = col[1];
    $exp.push(col[0]);
    Object.values(exColData.cols).forEach(exCol => {
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

function batchBody(ops) {
  const bID = UUID();
  const cSID = UUID();
  const body = [
    '--batch_' + bID,
    'Content-Type: multipart/mixed; boundary="changeset_' + cSID + '"',
    'Content-Transfer-Encoding: binary',
    ''
  ];
  const w = data => body.push(data);
  for (let i = 0, iL = ops.length; i < iL; i++) {
    let opn = ops[i], ref = opn.ref;
    w('--changeset_' + cSID);
    w('Content-Type: application/http');
    w('Content-Transfer-Encoding: binary');
    w('');
    switch (opn.type) {
      case 1:
        w(`POST ${URL__ITEMS(ref.src)} HTTP/1.1`);
        w('Content-Type: application/json;odata=verbose');
        break;
      case 2:
        w(`MERGE ${URL__ITEMS(ref.src)}(${opn.id}) HTTP/1.1`);
        w('Content-Type: application/json;odata=verbose');
        w('Accept: application/json;odata=verbose');
        w('IF-MATCH: *');
        break;
      case 3:
        w(`DELETE ${URL__ITEMS(ref.src)}(${opn.id}) HTTP/1.1`);
        w('Content-Type: application/json;odata=verbose');
        w('Accept: application/json;odata=verbose');
        w('IF-MATCH: *');
      default:
        break;
    }
    w('');
    if (opn.data) {
      w(prepOpnData(opn));
      w('');
    }
  }
  w('--changeset_' + cSID + '--');
  w('--batch_' + bID + '--');

  return {
    method: 'POST',
    headers: {
      'Accept': 'application/json; odata=verbose',
      'content-type': 'multipart/mixed;boundary="batch_' + bID + '"',
      'X-RequestDigest': CFG.digest,
    },
    body: body.join('\r\n'),
    credentials: 'include'
  };
}

function rProp(str) {
  return str.split(':')[1].trim()
}

function batchResData(bRes, ops) {
  let boundary = bRes.substring(0, 52);
  bRes = bRes.split(boundary);
  bRes = bRes.slice(1, bRes.length - 1);
  return ops.map((opn,i) => {
    let
      res = bRes[i].split(/\r\n/g),
      resData = {
        status: (res[4] = res[4].split(/\s/g), { protocol: res[4][0], code: +res[4][1]}),
        contentType: rProp(res[5]),
      };
    switch (opn.type) {
      case 1:
        resData.eTag = rProp(res[6]);
        resData.location = rProp(res[7]);
        resData.body = rProp(res[9]);
        break;
      case 2:
        resData.eTag = rProp(res[6]);
        break;
    }
    return resData;
  })
}

function batchImpl(ops) {
  let q = () => fetch(URL__BATCH(), batchBody(ops))
    .then(res => res.ok ? res.text() : ERR(res))
    .then(text => batchResData(text, ops));
  if (CFG.digest) return q();
  return reqDigest().then(q);
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
    cols: cols,
    src: src,
    type: type,
    ...cols
  }
}

/* qType - for batch request only. */
Q.create = function (ref, data) {
  return {
    type: 1,
    ref: ref,
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

function postImpl(opn) {
  let q = () => fetch(prepOpnEndPoint(opn), POST(prepOpnData(opn), opn.type))
    .then(resJSON)
    .then(r => resItem(Object.keys(opn.ref.cols), Object.values(opn.ref.cols), r.d));
  if (CFG.digest) return q();
  return reqDigest().then(q);
}

Q.get = function (ref, opt) {
  return fetch(
    URL__ITEMS(ref.src) + optToStr(opt, ref.cols),
    GET
  )
    .then(resJSON)
    .then(r => resItems(ref.cols, r.d.results));
}

Q.post = function (data) {
  if (data.length) return batchImpl(data)
  return postImpl(data);
}

Q.config = function (cfg) {
  CFG.app = cfg.app;
}

export default Q;