/* eslint-disable max-statements-per-line,semi,no-unused-expressions,no-extra-parens */
const _ = require('lodash');
const jp = require('jsonpath');

// functional debugging 101, peek into function names
/**
 * debugging decorator that logs function name when the decorated function is invoked
 * @param fn: can be a function defined with the `function` keyword, or `let foo = () => {}; foo = which(foo);`
 */
const which = (fn, {input = true, output = true, stringify = true} = {}) => (...args) => {
    console.log(`${fn.name || 'function'}(${input ? args : '...'})`);
    const result = fn(...args);
    if (output) console.log(`${fn.name || 'function'} :: (${input ? args : '...'}) -> ${stringify ? JSON.stringify(result, null, 0) : result}`);
    return result;
};

/**
 * debugging plug, insert within a pipe or compose pipeline to peek at the cascading argument
 * @param x
 * @returns {*}
 */
const peek = x => {
    console.log(x);
    return x;
};

/**
 * Functional building blocks with zero dependencies
 * identity, pipe, compose, empty, append, map, filter, reduce, transformers, transducers
 * NOTE: map, filter, reduce can handle iterator/generator, lodash and ramda currently don't
 * mapAsync, filterAsync, reduceAsync can handle async generators, lodash and ramda, transducers-js and transducers.js currently don't
 **/
// Combinators: https://gist.github.com/Avaq/1f0636ec5c8d6aed2e45
const I = x => x;
const K = x => y => x;
const A = f => x => f(x);
const T = x => f => f(x);
const W = f => x => f(x)(x);
const C = f => y => x => f(x)(y);
const B = f => g => x => f(g(x));
const S = f => g => x => f(x)(g(x));
const P = f => g => x => y => f(g(x))(g(y));
const Y = f => (g => g(g))(g => f(x => g(g)(x)));

const identity = I;
const identityAsync = x => Promise.resolve(x);
const lazy = K;

const empty = function* () {
};

const pipe = (...fns) => fns.reduceRight((f, g) => (...args) => f(g(...args)));

const compose = (...fns) => fns.reduce((f, g) => (...args) => f(g(...args)));

const composeAsync = (...fns) => reduceAsync((fn1, fn2) => async (...args) => fn1(await fn2(...args)), undefined, fns);

const flip = fn => (...args) => fn(...args.reverse());


/** ----- FUTURE ----- **/
// When the runtime supports async/generator functions without transpiling, we can check if a function is a generator or is async by using foo instanceof AsyncFunctionType for example
const GeneratorFunctionType = (function* () {
}).constructor;
const AsyncFunctionType = (async function () {
}).constructor;

/** ----- FUTURE ----- **/

const SymbolIterator = Symbol.iterator;
const SymbolAsyncIterator = Symbol.asyncIterator;

const isFunction = f => typeof f === 'function';
const isIterable = o => o && isFunction(o[SymbolIterator]);
const isIterator = o => o && isFunction(o['next']);
const isEnumerable = o => isIterable(o) || isIterator(o);
const isGenerator = o => isEnumerable(o) && isFunction(o['return']);
const isAsyncGenerator = o => o && isFunction(o[SymbolAsyncIterator]);

const isNil = x => x == null; // `==` works for null || undefined
// const isNumber = x => typeof x === 'number';
const objectTag = o => Object.prototype.toString.call(o);
const isDate = o => objectTag(o) === '[object Date]';
const isRegExp = o => objectTag(o) === '[object RegExp]';
const isError = o => objectTag(o) === '[object Error]';
const isBoolean = o => objectTag(o) === '[object Boolean]';
const isNumber = o => objectTag(o) === '[object Number]';
const isString = o => objectTag(o) === '[object String]';
const isArray = Array.isArray || (o => objectTag(o) === '[object Array]');
const isObject = o => o && o.constructor === Object;

const isEmptyValue = x => isNil(x) || !isNumber(x) && !isFunction(x) && Object.keys(x).length === 0; // works for null, undefined, '', [], {}
// const isObject = o => o && (typeof o === 'object' || !isFunction(o));
// const isArray = o => Array.isArray(o);
const isContainer = o => isObject(o) || isArray(o);

/**
 * returns entries generator/iterator, with [key, value] pairs similar to Map.entries() or with [value, key] pairs, similar to Ramda.mapObjIndexed
 *
 * HINT: this is more flexible than https://lodash.com/docs/4.17.4#toPairs, also returns an iterator not a concrete Array, which is wasteful
 * @param o: object or object like reference
 * @param values: if true, returns a generator of values only, false (default) returns a generator of key-value pairs or value-key pairs
 * @param kv: if true, returns an iterator of [key, value] pairs similar to Map.entries()
 * if false, returns an iterator [value, key] pairs, similar to Ramda.mapObjIndexed
 * @default: true
 */
function* entries(o, values = false, kv = true) {
    const entryKeys = Object.keys(o);
    if (values) {
        yield* entryKeys.map(k => o[k]);
    } else {
        kv ? yield* zip(entryKeys, entryKeys.map(k => o[k])) : yield* zip(entryKeys.map(k => o[k]), entryKeys);
    }
}

/**
 * Babel corner case workaround
 *
 * when a generator (say of 10 values) is partially destructured, it prematurely terminates
 * example:
 * ```
 * const [a, b] = generator; // generator has more than two values
 * generator.next(); // {done: true, value: undefined}
 *
 * // while an iterator resumes as expected
 *
 * const [a, b] = iterator; // iterator has more than two values
 * iterator.next(); // {done: false, value: nextValue}
 * ```
 * @param generator
 * @returns {Iterator}
 */
function toIterator(generator, indexed = false) {
    return {
        [Symbol.iterator]() {
            return this;
        },
        next() {
            const {value, done} = generator.next();
            this.index = done ? this.index : this.index != null ? this.index + 1 : 0;
            return indexed ? {value: [value, this.index], done} : {value, done};
        }
    };
}

function iterator(o, {indexed = false, kv = false, metadata = lazy({})} = {}) {
    let iter;
    if (isGenerator(o)) { // generator only
        iter = toIterator(o, indexed);
    } else if (isIterator(o)) { // iterator (generator would have passed)
        iter = indexed ? toIterator(o, indexed) : o;
    } else if (isIterable(o)) { // iterable (NOTE: iterator and generator would have passed the test as well)
        iter = indexed ? toIterator(o[Symbol.iterator](), indexed) : o[Symbol.iterator]();
    } else if (isObject(o)) {
        iter = toIterator(entries(o, !indexed, kv));
    } else {
        iter = empty();
    }
    iter.metadata = isFunction(o.metadata) ? o.metadata : metadata; // pipe existing metadata() to the new supplied one?
    return iter;
}

/**
 * zip generator that works with iterables, iterators and generators
 *
 * Lodash and ramda only support concrete arrays!
 *
 * @param enumerator1: enumerator, i.e. iterable, iterator or generator
 * @param enumerator2: enumerator, i.e. iterable, iterator or generator
 * @param fn: pair transform function of arity 2
 */
function* zipWithGen(enumerator1, enumerator2, fn = (x1, x2) => [x1, x2]) {
    let count = 0;
    enumerator1 = iterator(enumerator1);
    enumerator2 = iterator(enumerator2);
    for (const e1 of enumerator1) {
        const {value: e2, done} = enumerator2.next();
        if (done) return count;
        yield fn(e1, e2); // cater for mutable and immutable collections
        count++;
    }
}

const zipWith = (enumerator1, enumerator2, fn) => iterator(zipWithGen(enumerator1, enumerator2, fn));
const zip = (enumerator1, enumerator2) => zipWith(enumerator1, enumerator2);

function* takeGen(n, enumerator) {
    let {value, done} = enumerator.next();
    while (!done && n-- > 0) {
        yield value;
        ({value, done} = enumerator.next());
    }
}

const take = (n, enumerator) => iterator(takeGen(n, enumerator)); // TODO: implement take as a stateful transformer/transducer for composability

function* skipGen(n, enumerator) {
    let done = false;
    while (!done && n-- > 0) {
        console.log('skipGen::', n);
        ({done} = enumerator.next());
    }
    yield* enumerator;
}

const skip = (n, enumerator) => iterator(skipGen(n, enumerator)); // TODO: implement take as a stateful transformer/transducer for composability


function partition(collection, predicate, matchesKey = 'matches', rejectsKey = 'rejects', optional = true) {
    const [truthy, falsey] = _.partition(collection, predicate);
    let result = {};
    if (optional) {
        if (!_.isEmpty(truthy)) {
            result[matchesKey] = truthy;
        }
        if (!_.isEmpty(falsey)) {
            result[rejectsKey] = falsey;
        }
    } else {
        result = {[matchesKey]: truthy, [rejectsKey]: falsey};
    }
    return result;
}

function* partitionBy(fn, data) {
    const NONE = {};
    const iter = iterator(data);
    let buffer = [];
    let memory = NONE;
    let lastResult;
    let newResult;
    for (const value of iter) {
        lastResult = memory;
        newResult = fn(value);
        memory = newResult;
        if ((lastResult === NONE) || (lastResult === newResult)) {
            buffer.push(value);
        } else {
            yield iterator(buffer, {metadata: lazy(lastResult)});
            buffer = [];
            buffer.push(value);
        }
    }
    if (buffer.length > 0) {
        yield iterator(buffer, {metadata: lazy(newResult)});
    }
}

const sticky = (n, {when = identity, recharge = true} = {}) => fn => {
    let count = 0;
    let result;
    let memory;
    return (...args) => {
        if (!count) { // not repeating
            result = fn(...args);
            memory = result;
            count = when(result) === memory ? n - 1 : count;
        } else { // repeating
            if (recharge) {
                result = fn(...args);
                count = when(result) === result ? n : count; // recharge sticky counter with every new positive hit
            }
            result = memory;
            count--;
        }
        return result;
    }
};

/**
 * This is lenses rude cousin, it mutates the path in the document you give it using x.value property get/set
 * @param  document -> path -> accessor::get|set|apply|map
 */
const accessor = document => (path, {name = 'value', empty = identity} = {}) => ({
    get [name]() {
        return jp.value(document, path) || this.empty();
    }, // pure
    set [name](val) {
        jp.value(document, path, val);
    }, // mutates
    empty(fn = empty) {
        return fn();
    }, // pure
    apply(fn) {
        return this[name] = fn(this[name]);
    }, // mutates
    map(fn) {
        return fn(this[name] || this.empty());
    } // pure
});

/**
 * Implements reduce for iterables
 *
 * Uses the for-of to reduce an iterable, accepting a reducing function
 * @param iterable
 * @param reducingFn: function of arity 2, (acc, input) -> new acc
 * @param initFn: produces the initial value for the accumulator
 * @returns {Accumulator-Collection}
 */
function reduce(reducingFn, initFn, enumerable) {
    let result;
    const iter = iterator(enumerable);

    if (!initFn) {
        const [initValue] = iter;
        initFn = lazy(initValue);
    }
    result = initFn();

    for (const value of iter) {
        result = reducingFn(result, value);
    }
    return result;
}

const flatten = enumerable => reduce(cat(), () => [], enumerable);

/**
 * Implements reduce for async-generators instead of iterables or reduce for an async reducingFn
 *
 * Uses the for-await-of to reduce an async-generator, accepting an async reducing function
 * @param enumerable: async-generator: async function* asyncGen(), or fall back to iterable/iterator if forAwait = false
 * @param reducingFn: async function of arity 2, (acc, input) -> new acc
 * @param initFn: produces the initial value for the accumulator
 * @param async: if true, iterator is considered to be an async-generator, instructs reduce to use for-await-of, else uses for-of
 * HINT: an async reducing function is won't complain if an iterator is passed in place of the enumerable
 * HINT: an async reducing function is a candidate trap for async-throttling/rate-limiting/quota-limiting
 * @returns {Promise<Accumulator-Collection>}
 */
const reduceAsync = async (reducingFn, initFn, enumerable) => {
    let result;
    const isAsync = isAsyncGenerator(enumerable);
    const iter = isAsync ? enumerable : iterator(enumerable); // treat this argument as an iterable;

    if (!initFn) {
        if (isAsync) {
            initFn = lazy((await iter.next()).value);
        } else {
            const [initValue] = iter;
            initFn = lazy(initValue);
        }
    }

    result = initFn();
    if (isAsync) {
        for await (const value of iter) { // see: https://babeljs.io/docs/plugins/syntax-async-generators/
            result = await reducingFn(await result, await value);
        }
    } else {
        for (const value of iter) {
            result = await reducingFn(await result, await value);
        }
    }
    return result;
};

// append is a transducer fn
// append:: fn -> acc -> x -> acc
const append = (reducingFn, {factory = identity} = {}) => (acc, input) => factory([...acc, input]);

const appendAsync = (reducingFn, {factory = identity} = {}) =>
    async (acc, input) =>
        factory([...(await acc), input]); // `await acc` is just a precaution, reduceAsync() already await for previous result from the reducing function

// cat is a transducer fn
// cat:: fn -> acc -> x -> acc
const cat = (reducingFn, {factory = identity} = {}) => (acc, input) => factory([...acc, ...input]);

const catAsync = (reducingFn, {factory = identity} = {}) =>
    async (acc, input) =>
        factory([...(await acc), ...input]); // `await acc` is just a precaution, reduceAsync() already await for previous result from the reducing function

// mapcat is a transducer fn
// mapcat:: fn -> acc -> x -> acc
const mapcat = fn => compose(mapTransformer(fn), cat);

const mapcatAsync = fn => composeAsync(mapAsyncTransformer(fn), catAsync);

// update is a transducer fn
// update:: fn -> acc -> x -> acc
const update = (reducingFn, {factory = identity} = {}) => (acc, [key, value]) => factory({...acc, [key]: value});
const mapUpdate = (fn, iterable) => reduce(compose(mapTransformer(fn), update)(/*reducingFn*/), () => ({}), iterable);

/**
 * Implements map transform for iterables, stub for ramda.map, should be removed when ramda is introduced.
 *
 * Uses the for-of to map over an iterable, accepting a transform function
 * @param iterable
 * @param mappingFn: function of arity 1, x -> y
 * @param initFn: produces the initial value for the result collection
 * @returns {Accumulator-Collection}
 */
const mapTransformer = mappingFn => reducingFn => (acc, input) => reducingFn(acc, mappingFn(input));
const map = (fn, iterable) => reduce(compose(mapTransformer(fn), append)(/*reducingFn*/), () => [], iterable);

const mapAsyncTransformer = mappingFn => reducingFn => async (acc, input) => reducingFn(acc, await mappingFn(input));
const mapAsync = async (fn, enumerable) => reduceAsync(
    await (await composeAsync(mapAsyncTransformer(fn), appendAsync))(/*reducingFn*/),
    () => [],
    enumerable);

const filterTransformer = predicateFn => reducingFn => (acc, input) => predicateFn(input) ? reducingFn(acc, input) : acc;
const filter = (fn, iterable) => reduce(compose(filterTransformer(fn), append)(/*reducingFn*/), () => [], iterable);

const filterAsyncTransformer = predicateFn => reducingFn => async (acc, input) => await predicateFn(input) ? reducingFn(acc, input) : acc;
const filterAsync = async (fn, enumerable) => reduceAsync(
    await (await composeAsync(filterAsyncTransformer(fn), appendAsync))(/*reducingFn*/),
    () => [],
    enumerable);

module.exports = {
    which,
    peek,
    empty,
    identity,
    identityAsync,
    K,
    lazy: K,
    always: K,
    constant: K,
    flip,
    pipe,
    compose,
    composeAsync,
    SymbolIterator,
    SymbolAsyncIterator,
    isEmptyValue,
    isString,
    isNumber,
    isObject,
    isArray,
    isFunction,
    isContainer,
    isIterable,
    isIterator,
    isEnumerable,
    isGenerator,
    isAsyncGenerator,
    iterator,
    toIterator,
    entries,
    // walk,
    zipWith,
    zip,
    take,
    skip,
    partition,
    partitionBy,
    flatten,
    sticky,
    memorizeWhen: sticky,
    accessor,
    append,
    appendAsync,
    cat,
    concat: cat,
    mapcat,
    concatMap: mapcat,
    catAsync,
    concatAsync: catAsync,
    mapcatAsync,
    concatMapAsync: mapcatAsync,
    update,
    mapUpdate,
    reduce,
    reduceAsync,
    mapTransformer,
    mapAsyncTransformer,
    map,
    mapAsync,
    filterTransformer,
    filterAsyncTransformer,
    filter,
    filterAsync
};
