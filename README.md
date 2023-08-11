# Q.js
A small client library for MS SharePoint REST interop.
## How to create
1. Open MS SharePoint site. 
2. Copy qgen.js content.
3. Use command QGen(APP__NAME, LIST__TITLE) to create query template.
```js
QGen('myApp', 'List0');
```

## How to use
Here is an quick example of how to use query.
```js
/* Query template generated by qgen.js */
const List0Query = Q(
  'List0-UnreadableId', /* xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx */
  'SP.Data.List0ListItem'
  {
    Id:'ID',
    Name: 'OData_List0_UnreadableColumnName', /*OData__x0000__x0000__x0000__x0000__x00 */
    Expanded: TestExpand
  }
);

const TestExpand = Q(
  /* If column expanded the source must be column name. */
  'OData_List1_UnreadableExpandedColumnName',
  'SP.Data.List1ListItem',
  {
    Id:'ID',
    Name: 'OData_List1_UnreadableColumnName',
  }  
);

List0Query.get(`${List0Query.Name} eq 'Bob'`)
```