/*BEGIN collections module ============================================================*/
// functional debugging 101, peek into function names
/**
 * debugging decorator that logs function name when the decorated function is invoked
 * @param fn: can be a function defined with the `function` keyword, or `let foo = () => {}; foo = which(foo);`
 */
const which = fn => (...args) => {
    console.log(`${fn.name}(${args})`);
    return fn(...args);
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

const identity = x => x;
const identityAsync = x => Promise.resolve(x);
const lazy = x => () => x;
const always = x => () => x;

const empty = function* () {};

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

const isIterable = o => o && typeof o[SymbolIterator] === 'function';
const isIterator = o => o && typeof o['next'] === 'function';
const isEnumerable = o => isIterable(o) || isIterator(o);
const isGenerator = o => isEnumerable(o) && typeof o['return'] === 'function';
const isAsyncGenerator = o => o && typeof o[SymbolAsyncIterator] === 'function';

const isNumber = x => typeof x === 'number';
const isObject = o => o && (typeof o === 'object' || typeof o !== 'function');
const isArray = o => Array.isArray(o);
const isContainer = o => isObject(o) || isArray(o);

// function toIterator(generator) {
//     return {
//         [Symbol.iterator]() {
//             return this;
//         },
//         next() {
//             return generator.next();
//         }
//     };
// }

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
        iter = indexed ? toIterator(o[Symbol.iterator](), indexed): o[Symbol.iterator]();
    } else if (isObject(o)) {
        iter = toIterator(entries(o, !indexed, kv));
    } else {
        iter = empty();
    }
    iter.metadata = metadata;
    return iter;
}

function* entries(o, values = false, kv = true) {
    const entryKeys = Object.keys(o);
    if (values) {
        yield* entryKeys.map(k => o[k]);
    } else {
        kv ? yield* zip(entryKeys, entryKeys.map(k => o[k])) : yield* zip(entryKeys.map(k => o[k]), entryKeys);
    }
}
function* zipWithGen(enumerable1, enumerable2, fn = (x1, x2) => [x1, x2]) {
    let count = 0;
    enumerable1 = iterator(enumerable1);
    enumerable2 = iterator(enumerable2);
    for (const e1 of enumerable1) {
        const {value: e2, done} = enumerable2.next();
        if (done) return count;
        yield fn(e1, e2); // cater for mutable and immutable collections
        count++;
    }
}

const zipWith = (enumerable1, enumerable2, fn) => iterator(zipWithGen(enumerable1, enumerable2, fn));
const zip = (enumerable1, enumerable2) => zipWith(enumerable1, enumerable2);
/*END collections module ============================================================*/

const document = {
    root_obj1: {
        root_obj1_obj1: {
            root_obj1_obj2_arr1: [0, 1, 2]
        },
        root_obj1_arr1: [
            {root_obj1_arr1_0_obj1: {root_obj1_arr1_0_obj1_item1: 0}},
            {root_obj1_arr1_1_obj1: {root_obj1_arr1_1_obj1_item1: 0}}
        ]
    },
    root_arr1: [0, 1, 2],
    root_arr2: [[{root_arr3_0_0: 0}], [{root_arr3_1_0: 0}], [{root_arr3_2_0: 0}]]
}

const data = [0, 1, 2, 3, 4, 5]
// const iter = toIterator(iterator(data), true)
// console.log(iter.next())
// console.log(iter.next())
// console.log(iter.next())
// console.log(iter.next())
// console.log(iter.next())
// console.log(iter.next())
// console.log(iter.next())
// console.log(iter.next())
for(const entry of toIterator(iterator(data), true)) {
    console.log(entry)
}

function* walk(document, root = '$') {
    const entryIter = iterator(document);
    const path = [root];
    for ([k, v] of entryIter) {
        if (isContainer(v)) {
            yield* iterator(v, {indexed: true, metadata: () => ({root, parent: [...path, k]})})
        } else {
            yield v;
        }
    }
}

// function* gen(n, {tag = n, dft = true, to = 0} = {}) {
//   while(n > 0) {
//     if (to === 0) console.log(`gen(${tag})`);
//     yield n;
//     if (to === 1) console.log(`gen(${tag})`);
//     yield* gen(--n, {tag: `${tag}-${n}`, dft, to});
//     if (to === 2) console.log(`gen(${tag})`);
//   }
//   return;
// }

// for (const i of gen(4)) {
//   console.log('for-of.next', i);
// }
// const g = gen(4, {to: 1});
// console.log(g.next())
// console.log(g.next())
// console.log(g.next())
// console.log(g.next())
// console.log(g.next())
// console.log(g.next())
// console.log(g.next())
// console.log(g.next())