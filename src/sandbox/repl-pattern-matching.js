const classifier = (template, name = '_') => (matcher, index) => ({
    get [name]() {
        return this.match(template);
    },
    set [name](val) {
        this.cName = val.constructor.name;
        matcher.send(this[name], index);
    },
    match(other) {
        return this.cName ? this.cName === other.constructor.name : false;
    }
});

let N = classifier(0);
let S = classifier('');
let B = classifier(false);
let O = classifier({});
let A = classifier([]);

const matcher = () => ({
    matches: [],
    send(result, index) {
        this.matches[index] = result;
    },
    get result() {
        return this.matches.reduce((acc, input) => acc && input, true);
    }
})

// const m = matcher()
// const int = N(m, 0);
// const str = S(m, 1);
// console.log(m.result)
// int._ = 1;
// str._ = 0;
// console.log(int._)
// // m.send(true, 0);
// // m.send(true, 1);
// console.log(m.matches)
// console.log(m.result)

const match = (m, ...classifiers) => classifiers.map((c, index) => c(m, index))
let matcher1 = matcher();
let [int, str, bool] = match(matcher1, N, S, B);
// int._ = 1
// console.log(int._)

[int._, str._, bool._] = ['1', 'hello', true]
    [int._, str._, bool._] = [1, 'hello', true]
// console.log(matcher1.result)
// console.log(matcher1.matches)
    [int._, str._, bool._] = [1, 'hello', true]

    [int._, str._, bool._] = [1, 2, true]
console.log(matcher1.result)

// [int._, str._, bool._] = [1, 'hello', undefined]
// console.log(matcher1.result)

// [int._, str._, bool._] = [1, 'hello', null]
// console.log(matcher1.result)

// [int._, str._, bool._] = [1, 'hello', true]
// console.log(matcher1.result)

//===================================================================

