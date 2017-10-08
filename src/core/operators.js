// const curry = require('curry');
const jp = require('jsonpath');

const F = require('./functional-pipelines');
const bins = require('./builtins');
const sx = require('../util/strings');

const regex = {
    safeDot: /\.(?![\w\.]+")/,
    memberOrDescendant: /^[\[\.]/
};

const jpify = path => path.startsWith('$') ? path : regex.memberOrDescendant.test(path) ? `$${path}` : `$.${path}`;

const deref = sources => (ast, {meta = 1, source = 'origin'} = {}) => {
    const values = jp.query(sources[source] || {}, jpify(ast.path));
    return {...ast, '@meta': meta, value: values};
};

const query = (ast, {meta = 2} = {}) => {
    let queryOp = values => values.pop();

    if (jp.value(ast, '$.operators.query')) {
        const regex = /\+(\d*)/;
        let {take} = sx.tokenize(regex, ast.operators.query, {tokenNames: ['take']});
        queryOp = bins.take(take);
    }
    // return F.withOneSlot(F.take)(take, F.__);
    return {...ast, '@meta': meta, value: queryOp(ast.value)};
};

const constraints = sources => (ast, {meta = 2} = {}) => {
    const ops = {
        '?': ast => (_, defaultValue) => ast.value !== undefined ? ast : (defaultValue !== undefined ? {...ast, value: defaultValue} : F.compose(query, deref(sources))(ast, {meta, source: 'default'})),
        '!': ast => (altSource, defaultValue) => {
            let result = ast;
            if (ast.value === undefined) {
                result = !F.isEmptyValue(altSource) ? F.compose(query, deref(sources))(ast, {meta, source: altSource}) : {...result, value: undefined};
                result = result.value !== undefined ? result : (defaultValue !== undefined ? {...result, value: defaultValue} : {...result, value: null})
            }
            return result;
        }
    };

    const [op, eq, ...app] = ast.operators.constraints;
    const args = eq ? F.pipes(bins.split(':'), bins.take(2), lst => F.map(bins.trim, lst))(app.join('')) : [];
    const result = ops[op](ast)(...args);

    return {...result, '@meta': meta};
};

const constraintsOperator = sources => F.composes(constraints(sources), bins.has('$.operators.constraints'));

const symbol = ({tags, context}) => (ast, {meta = 2} = {}) => {
    const ops = {
        ':' : '',
        '#' : ast => tag => { const path = F.isEmptyValue(tag) ? jp.stringify(context.path) : jpify(tag); jp.value(tags, path, ast.value); return {...ast, tag: path}; }
    };

    const [op, ...tag] = ast.operators.symbol;
    const result = ops[op](ast)(tag.join('').trim());
    return {...result, '@meta': meta};
};

const symbolOperator = ({tags, context}) => F.composes(symbol({tags, context}), bins.has('$.operators.symbol'));

const applyAll = ({meta, sources, tags, context}) => F.composes(symbolOperator({tags, context}), constraintsOperator(sources), query, deref(sources));


module.exports = {
    query,
    constraints: constraintsOperator,
    symbol: symbolOperator,
    enumerate: '',
    inception: '',
    applyAll
};
