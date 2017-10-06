// const curry = require('curry');
const jp = require('jsonpath');

const coll = require('./collections');
const sx = require('../util/strings');

const slice = (...args) => iterable => iterable.slice(...args);
const split = delimiter => str => str.split(delimiter);
const of = key => o => o[key] !== undefined ? o[key] : coll.reduced(o);
const has = path => o => (jp.value(o, path) !== undefined) ? o : coll.reduced(o);

const query = ast => {
    const regex = /\+(\d*)/;
    let {take} = sx.tokenize(regex, ast.operators.query, {tokenNames: ['take']});
    // return coll.withOneSlot(coll.take)(take, coll.__);
    return {...ast, value: [...coll.take(parseInt(take))]};
};

const queryOp = coll.compose(query, has('$.operators.query'));

const constraints = ast => {
    const iter = coll.iterator(ast.operators.constraints);
    const [operator] = iter;

};

const constraintsOp = coll.compose(query, has('$.operators.constraints'));


module.exports = {
    query: queryOp,
    constraints: constraintsOp,
    slice,
    split,
    of,
    has
};

