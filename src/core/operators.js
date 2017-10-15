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
    const document = sources[source];
    let values;
    if (F.isNil(document)) {
        values = [];
    } else if (!F.isContainer(document)) {
        meta = 0;
        values = [document]; // literal value
    } else {
        values = jp.query(document, jpify(ast.path));
    }
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

const constraints = ({sources, tagHandlers, config}) => (ast, {meta = 2} = {}) => {
    const ops = {
        '?': ast => (_, defaultSource = 'default', defaultValue) => ast.value !== undefined ? ast : (defaultValue !== undefined ? {
            ...ast,
            value: defaultValue
        } : F.compose(query, deref(sources))(ast, {meta, source: defaultSource})),
        '!': ast => (isAltLookup, altSource, ...args) => {
            let result = ast;
            if (isAltLookup) {
                result = !F.isEmptyValue(altSource) ? F.compose(query, deref(sources))(ast, {
                    meta,
                    source: altSource
                }) : {...result, value: null};
                const [defaultValue] = args;
                result = result.value !== undefined ? result : (
                    defaultValue !== undefined ? {
                        ...result,
                        value: defaultValue
                    } : {
                        ...result, value: null
                    }
                )
            } else {
                result = {
                    ...result,
                    value: (altSource && tagHandlers[altSource]) ? tagHandlers[altSource](ast.value, ...args) : null
                };
            }
            return result;
        }
    };

    let [op, eq, ...app] = ast.operators.constraints;
    app = (eq && eq !== '=') ? [eq, ...app] : app; // if first char is not = put it back with the `application` string
    const args = eq ? F.pipes(bins.split(':'), bins.take(2), lst => F.map(bins.trim, lst))(app.join('')) : [];
    const result = ops[op](ast)(eq === '=', ...args);

    return {...result, '@meta': meta};
};

const constraintsOperator = ({sources, tagHandlers}) => F.composes(constraints({
    sources,
    tagHandlers
}), bins.has('$.operators.constraints'));

const symbol = ({tags, context}) => (ast, {meta = 2} = {}) => {
    const ops = {
        ':': '',
        '#': ast => tag => {
            const path = F.isEmptyValue(tag) ? jp.stringify(context.path) : jpify(tag);
            jp.value(tags, path, ast.value);
            return {...ast, tag: path};
        }
    };

    const [op, ...tag] = ast.operators.symbol;
    const result = ops[op](ast)(tag.join('').trim());
    return {...result, '@meta': meta};
};

const symbolOperator = ({tags, context}) => F.composes(symbol({tags, context}), bins.has('$.operators.symbol'));

const enumerate = (ast, {meta = 4} = {}) => {
    const ops = {
        '*': ast => ({...ast, value: [...F.iterator(ast.value)]}),
        // '**': ast => ({...ast, value: [...F.iterator(ast.value, {indexed: true, kv: true})]}) // TODO: do scenarios of ** python style k/v pairs expansion fit with jsonpath?
        '**': ast => ({...ast, value: [...F.iterator(ast.value)]})
    };

    const [i, ik = ''] = ast.operators.enumerate;
    const result = ops[i + ik](ast);
    return {...result, '@meta': meta};
};

const enumerateOperator = F.composes(enumerate, bins.has('$.operators.enumerate'));

const applyAll = ({meta, sources, tags, tagHandlers, context, config}) => F.composes(
    enumerateOperator,
    symbolOperator({tags, context}),
    constraintsOperator({sources, tagHandlers, config}),
    query,
    deref(sources)
);

const inception = ast => {
    const [dot, repeat, ...rest] = ast.operators.inception;
    const $depth = repeat !== '.' ? parseInt([repeat, ...rest].join(''), 10) : rest.length + 1;
    return {...ast, $depth};
};

const inceptionOperator = F.composes(inception, bins.has('$.operators.inception'));

module.exports = {
    deref,
    query,
    constraints: constraintsOperator,
    symbol: symbolOperator,
    enumerate: enumerateOperator,
    inception: inceptionOperator,
    applyAll
};
