const R = require('ramda');

const mapListIndexed = R.addIndex(R.map);
const mapIndexed = fn => document => R.is(Array, document) ? mapListIndexed(fn, document) : R.mapObjIndexed(fn, document)

/**
 * traversal (not to be confused with ramda traverse())
 * recursively descend the document branches, applying filter/reject to nodes and map pipeline to leaves
 *
 * @param document: JSON like data document
 * @param reject: Array|Object node reject predicate, @default: isNil
 * @param filter: Array|Object node filter predicate, @default: always(true)
 * @param mappers: leaves map pipeline, @default: identity
 * @returns {new transformed object}
 */
function traversal(document, {key = '$', root = document, reject = R.isNil, filter = R.always(true), mappers = [R.identity]} = {}) {
    return R.ifElse(
        R.either(R.is(Array), R.is(Object)),
        R.pipe(
            R.reject(reject),
            R.filter(filter),
            mapIndexed((x, key, root) => traversal(x, {key, root, reject, filter, mappers}))
        ),
        R.pipe(...mappers)
    )(document);
}

module.exports = {
    traversal,
    mapIndexed
};

