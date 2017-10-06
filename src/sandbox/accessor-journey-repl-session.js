'use strict';

// Destructring/iteration/enumeration/transducing myth, reality and fantasies
// =============================================================
// Nope, didn't happen Alex
// http://2ality.com/2015/01/es6-destructuring.html#rest-operator
// let [x, ...[y, z]] = ['a', 'b', 'c'];
// =============================================================
// But this happened
// http://2ality.com/2015/01/es6-destructuring.html#you-can-assign-to-more-than-just-variables
// let obj = {};
// let arr = [];

// ({ foo: obj.prop, bar: arr[0] } = { foo: 123, bar: true });

// console.log(obj); // {prop:123}
// console.log(arr); // [true]
// =============================================================
// let's make it a fantasy
// baby step (1) destrucer into a configurable object property
// const identity = x => x;
// const sink = document => (path, {name = '$', empty = identity} = {}) => ({
//     get [name]() {
//         // return jp.value(document, path) || this.empty();
//     }, // pure
//     set [name](val) {
//       console.log(`set(${name}, ${path}, ${val})`);
//         // jp.value(document, path, val);
//         obj[path] = val
//     }, // mutates
//     empty(fn = empty) {
//         return fn();
//     }, // pure
//     apply(fn) {
//         return this[name] = fn(this[name]);
//     }, // mutates
//     map(fn) {
//         return fn(this[name] || this.empty());
//     } // pure
// });

// let obj = {};
// let arr = [];
// const propSink = sink(obj)('prop');

// ({ foo: propSink.$, bar: arr[0] } = { foo: 123, bar: true });

// console.log(obj); // {prop:123}
// console.log(arr); // [true]
// =============================================================
// baby step (2) destructure into a configurable object property
// const identity = x => x;
// const sink = document => (path, {name = '$', empty = identity} = {}) => ({
//     get [name]() {
//         // return jp.value(document, path) || this.empty();
//     }, // pure
//     set [name](val) {
//       console.log(`set(${name}, ${path}, ${val})`);
//         // jp.value(document, path, val);
//         obj[path] = val
//     }, // mutates
//     empty(fn = empty) {
//         return fn();
//     }, // pure
//     apply(fn) {
//         return this[name] = fn(this[name]);
//     }, // mutates
//     map(fn) {
//         return fn(this[name] || this.empty());
//     } // pure
// });

// let obj = {};
// let arr = [];
// const propSink = sink(obj)('prop');

// ({ foo: propSink.$, bar: arr[0] } = { foo: 123, bar: true });

// console.log(obj); // {prop:123}
// console.log(arr); // [true]
// =============================================================
// baby step (3) destructure into a configurable object property path
// legos
// const path = ['x', 'y', 'z']
// const obj = {a: {b: {c: 'READ'}}}
// const pathLen = path.length;


const identity = x => x;
const isNumber = x => typeof x === 'number';
const always = x => () => x;

const propReader = (acc, p) => acc ? acc[p] : undefined;
const propWriter = (value, path, { map = identity } = {}) => (acc, p, index, path) => {
    console.log('propWriter', value, path.length, acc, p, index);
    return index + 1 === path.length ? (acc[p] = map(value)) && acc[p] : acc[p] ? acc[p] : (isNumber(path[index + 1]) ? acc[p] = [] : acc[p] = {}) && acc[p];
};
// console.log(path.reduce(propReader, obj))
// console.log(path.reduce(propWriter('WRITE', pathLen), obj))
// console.log(obj)

const accessor = document => (pathArray, { name = '$', empty = identity, map = identity, predicate = always(true) } = {}) => ({
    get [name]() {
        console.log(`get(${name}, ${pathArray})`);
        return pathArray.reduce(propReader, obj);
    }, // pure
    set [name](val) {
        console.log(`set(${name}, ${path}, ${val})`);
        if (predicate(val)) pathArray.reduce(propWriter(val, pathArray), document);
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

let obj = { x: { y: { z: 'DELETE ME' } } };
let arr = ['overwriteme', 'leaveme', 'overwriteme', 'nestmeAsArray', 'nestmeAsObject'];
const arr0 = accessor(arr)(['0']);
const arr2 = accessor(arr)(['2']);
const arr3 = accessor(arr)(['2', '0']); // TODO
const arr4 = accessor(arr)(['2', 'k1']); // TODO
const abc = accessor(obj)(['a', 0, 0, 'c', 0, 0]);
const xyz = accessor(obj)(['x', 'y', 'z']);
var _foo$bar$baz$intoArr$ = { foo: 123, bar: true, baz: 'arr[2] new value', intoArr: 'into array', intoMap: 'intom map' };
abc.$ = _foo$bar$baz$intoArr$.foo;
arr0.$ = _foo$bar$baz$intoArr$.bar;
arr2.$ = _foo$bar$baz$intoArr$.baz;
arr3.$ = _foo$bar$baz$intoArr$.intoArr;
arr4.$ = _foo$bar$baz$intoArr$.intoMap;


console.log(obj);
console.log(abc.$); // {prop:123}
console.log(arr); // [true]