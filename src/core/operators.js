// const curry = require('curry');
const jp = require('jsonpath');

const F = require('./functional-pipelines');
const sx = require('../util/strings');

const slice = (...args) => iterable => iterable.slice(...args);
const split = delimiter => str => str.split(delimiter);
const of = key => o => o[key] !== undefined ? o[key] : F.reduced(o);
const has = path => o => (jp.value(o, path) !== undefined) ? o : F.reduced(o);

const query = (ast, {meta = 2} = {}) => {
    let queryOp = values => values.pop();

    if (ast.operators.query) {
        const regex = /\+(\d*)/;
        let {take} = sx.tokenize(regex, ast.operators.query, {tokenNames: ['take']});
        queryOp = values => [...F.take(parseInt(take), values)];
    }
    // return F.withOneSlot(F.take)(take, F.__);
    return {...ast, meta, value: queryOp(ast.value)};
};

const constraints = (ast, {meta = 2} = {}) => {
    let [op, eq, ...app] = ast.operators.constraints;


};

const constraintsOp = F.compose(constraints, has('$.operators.constraints'));


module.exports = {
    query,
    constraints: constraintsOp,
    slice,
    split,
    of,
    has
};

