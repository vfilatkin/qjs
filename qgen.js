(function () {
  const MSG = msg => `[q.js]: ${msg}`;
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

  function ListTemplate(app, list) {
    return [
      `let List = Q(\n`,
      `  '${app}',\n`,
      `  '${list.id}', /* ${list.title} */\n`,
      `  {\n`,
      [...list.columns.map((col, i) => {
        return `    Column${i}: '${col.name}'  /* ${col.title}:${col.type} */`
      })].join(',\n'),
      '\n  }',
      '\n);',
    ].join('')
  }

  function QGen(app, listTitle) {
    return fetch(`/${app}/_api/lists/GetByTitle('${listTitle}')`, REQ.GET)
      .then(RJSON)
      .then(listData => {
        fetch(`/${app}/_api/lists/GetByTitle('${listTitle}')/fields`, REQ.GET)
          .then(RJSON)
          .then(filterContextColumns)
          .then(createContextColumns)
          .then(cols => {
            return List(listData.d, cols);
          })
          .then(list => console.log(ListTemplate(app,list)))
      })
  }

  window.QGen = QGen;
})();
