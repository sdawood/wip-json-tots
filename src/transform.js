// estree-transducers: https://github.com/awto/estransducers
// lazy immutable sequences: https://github.com/benji6/imlazy

/**
 * We are basically piggy backing the JSON parsing, so we have no lex step
 * an good approximation is that we are transforming JSON AST -> JSON AST
 * some good patterns from parsing still apply, for example to deref the paths we can concatMap/map the leaves in many ways
 * 1) listeners
 * 2) visitors
 *
 * Or we simple use multiple passes
 * with the self #ref feature we would have to do multi pass transformation by all means
 * 1) deref, expand pipe, enumeration, async, etc into lenses pipelines or the like
 * 2) resolve dependency
 * 3) substitution
 *
 * each step can be though about as a transduce pipeline, either sync or async
 *
 */
const R = require('ramda');

const transform = R.curryN(2, (template, document) => {
    return R.applySpec(template)(document);
});

module.exports = {
    transform
};
