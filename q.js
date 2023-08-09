(function () {
  const MSG = msg => `[q.js]: ${msg}`;
  const NON__EXPANDABLE = { "Boolean": true, "Lookup": true, "Note": true, "Choice": true };
  const LOOKUP__TYPES = { "Lookup": true, "LookupMulti": true };
  const REQ = {
    GET: { method: 'GET', headers: new Headers({ 'Accept': 'application/json; odata=verbose' }), credentials: 'include' }
  }

  function RJSON(response) {
    if (response.ok) {
      return response.json();
    }
    else {
      response.text().then(e => console.error(JSON.parse(e).error.message.value))
    }
  }

  function arrayToObject(array, key) {
    let obj = {};
    array.forEach(item => obj[item[key]] = item)
    return obj;
  }

  function List(lData, lColumns) {
    return {
      title: lData.Title,
      id: lData.Id,
      columns: lColumns
    }
  }

  function Column(cData) {
    return {
      title: cData.Title,
      id: cData.Id,
      name: cData.EntityPropertyName,
      type: cData.TypeAsString,
      description: cData.Description,
      choices: cData.Choices ? cData.Choices.results : undefined,
      lookupList: cData.LookupList ? cData.LookupList.substring(1, cData.LookupList.length - 1) : undefined,
      readOnly: cData.ReadOnly ? cData.ReadOnly : undefined,
      required: cData.Required ? cData.Required : undefined,
      maxValue: cData.MaximumValue ? cData.MaximumValue : undefined,
      minValue: cData.MinimumValue ? cData.MinimumValue : undefined,
      maxLength: cData.MaxLength ? cData.MaxLength : undefined,
      validationFormula: cData.ValidationFormula ? cData.ValidationFormula : undefined,
      validationMessage: cData.ValidationMessage ? cData.ValidationMessage : undefined
    }
  }

  function filterContextColumns(data) {
    return data.d.results.filter(col => col.CanBeDeleted === true || col.EntityPropertyName === 'ID');
  }

  function createContextColumns(data) {
    return data.map(col => Column(col));
  }

  function filterContextLists(data) {
    return data.d.results.filter(list => list.Hidden === false);
  }

  function getAllListColumnsAsync(data) {
    return Promise.all(data.map(
      listData => fetch(listData.Fields.__deferred.uri, REQ.GET)
        .then(RJSON)
        .then(filterContextColumns)
        .then(createContextColumns)
        .then(cols => {
          let list = List(listData, arrayToObject(cols, 'title'))
          CTX.listsMap[list.id] = list.title;
          return list
        })
    ));
  }

  let CTX = {
    app: '',
    data: {},
    listsMap: {}
  };

  function toItem(L, iData) {
    let item = {};
    Object.values(L.columns).forEach(col => {
      let
        colData = iData[col.name],
        exColList = getLookup(col);
      if (colData) {
        switch (col.type) {
          case 'Lookup':
            colData = toItem(exColList, colData);
            break;
          case 'LookupMulti':
            colData = getItems(exColList, colData.results)
            break;
          default:
            colData = colData;
        }
        item[col.alias ? col.alias : col.title] = colData;
      }
    });
    return item;
  }

  function getItems(list, results) {
    return results.map(iData => {
      return toItem(list, iData)
    })
  }

  function skipToken(startItem, pageSize) {
    return `$skiptoken=${encodeURIComponent(`Paged=TRUE&p_ID=${startItem}`)}&$top=${pageSize}`;
  }

  function createSelect(L, R) {
    let
      exCol = [];
    R.select = '$select=' + Object.keys(L.columns).map(colKey => {
      let col = L.columns[colKey];
      if (!LOOKUP__TYPES[col.type]) return col.name;
      exCol.push(col.name);
      let colList = CTX.data[CTX.listsMap[col.lookupList]];
      return Object.keys(colList.columns)
        .filter(exColKey => {
          if (!NON__EXPANDABLE[colList.columns[exColKey].type]) return true;
        })
        .map(exColKey => {
          return col.name + '\/' + colList.columns[exColKey].name;
        }).join();
    }).join();
    return exCol.length > 0 ? exCol : false;
  }

  function objectName(obj) {
    return Object.keys(obj)[0];
  }

  const getLookup = col => CTX.data[CTX.listsMap[col.lookupList]];

  function handleSelect(L, R) {
    if (!R.select) return;
    if (typeof R.select === 'string') return R.select;
    let
      exCols = [],
      nExCol = [],
      col;
    R.select = '$select=' + R.select.map(cKey => {
      if (typeof cKey === 'string') {
        col = L.columns[cKey];
        if (!col) return cKey;
        return col.name;
      }
      let colName = objectName(cKey);
      col = L.columns[colName];
      let colList = getLookup(col);
      exCols.push(col.name);
      return Array.from(cKey[colName])
        .filter(exColKey => {
          let
            exCol = colList.columns[exColKey],
            exColType = exCol ? exCol.type : undefined;
          if (!NON__EXPANDABLE[exColType]) return true;
          nExCol.push(exColKey + ":" + exColType);
        })
        .map(key => {
          let exCol = colList.columns[key];
          let exColName = exCol ? exCol.name : key;
          return col.name + '\/' + exColName;
        }).join();
    }).join();
    if (nExCol.length > 0) console.warn(MSG("Non-expandable columns was removed from query - " + nExCol.join() + '.'))
    return exCols.length > 0 ? exCols : false;
  }

  function replaceOperators(ex) {
    return ex.replace(/\</g, 'lt')
      .replace(/\<\=/g, 'le')
      .replace(/\>/g, 'gt')
      .replace(/\>\=/g, 'ge')
      .replace(/\=\=/g, 'eq')
      .replace(/\!\=/g, 'ne');
  }

  function handleFilter(L, R) {
    if (!R.filter) return;
    if (typeof R.filter === 'string') return R.filter;
    R.filter = '$filter=' + R.filter.map(col => {
      if (typeof col !== 'object') throw MSG('Filter parameter must be object');
      let key = objectName(col);
      let colName = L.columns[key];
      colName = colName ? colName.name : key;
      return colName + ' ' + replaceOperators(col[key]);
    }).join();
  }

  function initRequest(L, R) {
    let exp = handleSelect(L, R) || createSelect(L, R);
    if (exp) {
      R.expand = '$expand=' + exp.join();
    }
    handleFilter(L, R);
    return R;
  }

  function Q(app, callback) {
    CTX.app = app;
    return fetch(`/${app}/_api/lists`, REQ.GET)
      .then(RJSON)
      .then(filterContextLists)
      .then(getAllListColumnsAsync)
      .then(data => CTX.data = arrayToObject(data, 'title'))
      .then(() => callback())
  }

  Q.get = function (R) {
    let L = CTX.data[R.list];
    R = initRequest(L, R);
    return function (r) {
      r = r ? initRequest(L, r) : R;
      let url = `/${CTX.app}/_api/lists(guid'${L.id}')/items?${[r.filter ||= R.filter, r.select ||= R.select, r.expand ||= R.expand].filter(x => x !== undefined).join('&')}`;
      return fetch(url, REQ.GET).then(RJSON).then(r => getItems(L, r.d.results));
    }
  }

  Q.config = function() {
    let config = '';
    Object.keys(CTX.data).forEach(listKey => {
      let list = CTX.data[listKey];
      config += `Q.L('${listKey}', null);\n`;
      Object.keys(list.columns).forEach(colKey => {
        let col = list.columns[colKey];
        config += `Q.C('${colKey}', ${col.alias ? `'${col.alias}'` : 'null'});\n`;
      })
    })
    return config;
  }

  let configuredList;

  Q.L = function (list, alias) {
    configuredList = list;
    CTX.data[configuredList].alias = alias;
  }

  Q.C = function (col, alias) {
    CTX.data[configuredList].columns[col].alias = alias;
  }

  window.Q = Q;
})();

/*
  //Example.
  function Qconfig() {
    Q.L('List Title', 'ListAlias');
    Q.C('Column Name', 'ColumnAlias');
    //...
  }

  Q('APP', () => {
    Qconfig();
  }).then(() => {
    let getList = Q.get({ list: 'List Title' });
    getList({ filter: [{ "Id": `== 0` }] }).then(data => console.log(data));
  })
*/
