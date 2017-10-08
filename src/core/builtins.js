const jp = require('jsonpath');
const F = require('./functional-pipelines');

const trim = str => str.trim();
const split = delimiter => str => str.split(delimiter);
const of = key => o => o[key] !== undefined ? o[key] : F.reduced(o);
const has = path => o => (jp.value(o, path) !== undefined) ? o : F.reduced(o);

module.exports = {
    /* array */
    take: take => values => [...F.take(parseInt(take), values)],
    /* array/string/iterable */
    slice: F.slice,
    /* string */
    trim,
    split,
    /* mapping with reduced() support */
    of,
    has,
    flatten: F.flatten,
};
