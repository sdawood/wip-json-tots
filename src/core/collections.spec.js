const coll = require('./collections');

const dataObject = {a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7, h: 8, i: 9, j: 10};
const dataIterable = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const dataIterator = () => dataIterable[coll.SymbolIterator]();

function* dataGenerator() {
    yield* dataIterator();
}

function* dataGeneratorOfPromises() {
    yield* dataIterable.map(coll.identityAsync);
}

async function* dataAsyncGenerator() {
    yield* dataIterator();
}

async function* dataAsyncGeneratorOfPromises() {
    yield* dataIterable.map(coll.identityAsync);
}

const _fn1 = x => x + 10;
const _fn2 = x => x * x;
const fn1 = coll.which(_fn1);
const fn2 = coll.which(_fn2);

const fn1Box = x => [fn1(x)];
const fn2Box = x => [fn2(x)];

const fn1Async = x => coll.identityAsync(fn1(x));
const fn2Async = x => coll.identityAsync(fn2(x));

const fn1AsyncBox = x => coll.identityAsync(fn1Box(x));
const fn2AsyncBox = x => coll.identityAsync(fn2Box(x));

const _predicateEven = x => x % 2 === 0;
const predicateEven = coll.which(_predicateEven);

const predicateEvenAsync = x => coll.identityAsync(predicateEven(x));

const resolveArgs = fn => async (...args) => {
    const resolvedArgs = [];
    for (const arg of args) {
        resolvedArgs.push(await arg);
    }
    return fn(...resolvedArgs);
};

// Transducers

const xform1 = coll.mapTransformer(fn1);
const xform2 = coll.mapTransformer(fn2);
const xform3 = coll.filterTransformer(predicateEven);

const xform1Box = coll.mapTransformer(fn1Box);
const xform2Box = coll.mapTransformer(fn2Box);

// Async Transducers

const xform1Async = coll.mapAsyncTransformer(fn1Async);
const xform2Async = coll.mapAsyncTransformer(fn2Async);
const xform3Async = coll.filterAsyncTransformer(predicateEvenAsync);

const xform1AsyncBox = coll.mapAsyncTransformer(fn1AsyncBox);
const xform2AsyncBox = coll.mapAsyncTransformer(fn2AsyncBox);

describe('sync', () => {
    describe('map', () => {
        it('maps a function over an enumerable -> object values', () => {
            const result = coll.map(fn1, dataObject);
            expect(result).toEqual(dataIterable.map(_fn1));
        });
        it('maps a function over an enumerable -> iterable', () => {
            const result = coll.map(fn1, dataIterable);
            expect(result).toEqual(dataIterable.map(_fn1));
        });
        it('maps a function over an enumerable -> iterator', () => {
            const result = coll.map(fn1, dataIterator());
            expect(result).toEqual(dataIterable.map(_fn1));
        });
        it('maps a function over an enumerable -> generator', () => {
            const result = coll.map(fn1, dataGenerator());
            expect(result).toEqual(dataIterable.map(_fn1));
        });
        it('maps a function over an enumerable -> generator of promises', async () => {
            const result = coll.map(resolveArgs(fn1), dataGeneratorOfPromises());
            const results = await Promise.all(result);
            expect(results).toEqual(dataIterable.map(_fn1));
        });
    });

    describe('filter', () => {
        it('maps a function over an enumerable -> object values', () => {
            const result = coll.filter(predicateEven, dataObject);
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
        it('filters a function over an enumerable -> iterable', () => {
            const result = coll.filter(predicateEven, dataIterable);
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
        it('filters a function over an enumerable -> iterator', () => {
            const result = coll.filter(predicateEven, dataIterator());
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
        it('filters a function over an enumerable -> generator', () => {
            const result = coll.filter(predicateEven, dataGenerator());
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });

        /*
         * filters an predicate function over an enumerable -> async-generator of Promises
         * filter won't work because inside filterTransfomer predicateFn(input) would return a Promise not a boolean
         * see: filterAsync for details
         */
    });

    describe('zipWith, zip', () => {
        it('zips two enumerators into one iterator applying fn([item1, item2]) that can be reduced(append)', () => {
            const expectedResult = [["1", "11"], ["2", "12"], ["3", "13"], ["4", "14"], ["5", "15"], ["6", "16"], ["7", "17"], ["8", "18"], ["9", "19"], ["10", "20"]];
            const enumerator2 = coll.iterator(coll.map(fn1, dataIterator()));
            const combinedIterator = coll.zipWith(dataGenerator(), enumerator2, (...args) => args.map(x => `${x}`));
            const result = coll.reduce(coll.append(), () => [], combinedIterator);
            expect(result).toEqual(expectedResult);
        });
        it('zips two enumerators into one iterator that can be reduced(append)', () => {
            const expectedResult = [[1, 11], [2, 12], [3, 13], [4, 14], [5, 15], [6, 16], [7, 17], [8, 18], [9, 19], [10, 20]];
            const enumerator2 = coll.iterator(coll.map(fn1, dataIterator()));
            const combinedIterator = coll.zip(dataGenerator(), enumerator2);
            const result = coll.reduce(coll.append(), () => [], combinedIterator);
            expect(result).toEqual(expectedResult);
        });
        it('zips two enumerators into one iterator that can be reduced(concat)', () => {
            const expectedResult = [1, 11, 2, 12, 3, 13, 4, 14, 5, 15, 6, 16, 7, 17, 8, 18, 9, 19, 10, 20];
            const enumerator2 = coll.iterator(coll.map(fn1, dataIterator()));
            const combinedIterator = coll.zip(dataGenerator(), enumerator2);
            const result = coll.reduce(coll.concat(), () => [], combinedIterator);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('take', () => {
        it('takes first n items from an enumerator', () => {
            const prefixEnumerator = coll.take(5, dataGenerator());
            expect(coll.reduce(coll.append(), () => [], prefixEnumerator)).toEqual(dataIterable.slice(0, 5))
        });
        it('handles n = 0', () => {
            const prefixEnumerator = coll.take(0, dataGenerator());
            expect(coll.reduce(coll.append(), () => [], prefixEnumerator)).toEqual([])
        });
        it('handles n < 0', () => {
            const prefixEnumerator = coll.take(-1, dataGenerator());
            expect(coll.reduce(coll.append(), () => [], prefixEnumerator)).toEqual([])
        });
        it('handles n > sequence length', () => {
            const prefixEnumerator = coll.take(100, dataGenerator());
            expect(coll.reduce(coll.append(), () => [], prefixEnumerator)).toEqual(dataIterable)
        });
        it('handles empty sequences', () => {
            const prefixEnumerator = coll.take(5, coll.empty());
            expect(coll.reduce(coll.append(), () => [], prefixEnumerator)).toEqual([])
        });
    });

    describe('skip', () => {
        it('skips first n items from an enumerator', () => {
            const suffixEnumerator = coll.skip(5, dataGenerator());
            expect(coll.reduce(coll.append(), () => [], suffixEnumerator)).toEqual(dataIterable.slice(5))
        });
        it('handles n = 0', () => {
            const suffixEnumerator = coll.skip(0, dataGenerator());
            expect(coll.reduce(coll.append(), () => [], suffixEnumerator)).toEqual(dataIterable)
        });
        it('handles n < 0', () => {
            const suffixEnumerator = coll.skip(-1, dataGenerator());
            expect(coll.reduce(coll.append(), () => [], suffixEnumerator)).toEqual(dataIterable)
        });
        it('handles n > sequence length', () => {
            const suffixEnumerator = coll.skip(100, dataGenerator());
            expect(coll.reduce(coll.append(), () => [], suffixEnumerator)).toEqual([])
        });
        it('handles empty sequences', () => {
            const suffixEnumerator = coll.skip(5, coll.empty());
            expect(coll.reduce(coll.append(), () => [], suffixEnumerator)).toEqual([])
        });
    });

    describe('partitionBy', () => {
        it('yields a partition iterator everytime the supplied function changes result', () => {
            const data = [0, 1, 2, 'a', 'b', 'c', 3, 'd', 'e', 4, 5, 6, 7, 'f'];
            const expectedResult = [[0, 1, 2], ["a", "b", "c"], [3], ["d", "e"], [4, 5, 6, 7], ["f"]];
            const partitionGen = coll.partitionBy(x => typeof x === 'string', data);
            const result = coll.map(iter => coll.map(coll.identity, iter), partitionGen);
            expect(result).toEqual(expectedResult);
        });
        it('yields a partition iterator with last-result metadata everytime the supplied function changes result', () => {
            const data = [0, 1, 2, 'a', 'b', 'c', 3, 'd', 'e', 4, 5, 6, 7, 'f'];
            const expectedResult = [false, true, false, true, false, true];
            const partitionGen = coll.partitionBy(x => typeof x === 'string', data);
            const result = coll.map(iter => iter.metadata(), partitionGen);
            expect(result).toEqual(expectedResult);
        });
    });

    describe('sticky a.k.a memorizeWhen', () => {
        const data1 =                    [1, 0, 0, 1, 1, 1, 0, 0, 1, 0, 1];
        const expected1_2_recharge =     [1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1]; // recharge: true, recharge sticky counter with every new positive hit
        const expected1_2_not_recharge = [1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 1]; // recharge: false, accidentally equal!!
        const data2 =                    [0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 1];
        const expected2_2_recharge =     [0, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1]; // recharge: true
        const expected2_2_not_recharge = [0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 1];
        const data3 =                    [0, 0, 1, 0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 1, 1];
        const expected3_3_recharge =     [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 1, 1, 1, 1, 0, 1, 1]; // recharge: true
        const expected3_3_not_recharge = [0, 0, 1, 1, 1, 0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1];

        describe('with recharge = false', () => {
            it('1) remembers the match-result n times, recharging the counter with every positive hit', () => {
                const stickyN = coll.sticky(2, {when: x => 1, recharge: true})(coll.identity);
                const result = coll.map(stickyN, data1);
                expect(result).toEqual(expected1_2_recharge);
            });
            it('2) remembers the match-result n times, recharging the counter with every positive hit', () => {
                const stickyN = coll.sticky(2, {when: x => 1, recharge: true})(coll.identity);
                const result = coll.map(stickyN, data2);
                expect(result).toEqual(expected2_2_recharge);
            });
            it('3) remembers the match-result n times, recharging the counter with every positive hit', () => {
                const stickyN = coll.sticky(3, {when: x => 1, recharge: true})(coll.identity);
                const result = coll.map(stickyN, data3);
                expect(result).toEqual(expected3_3_recharge);
            });
        });

        describe('with recharge = true', () => {
            it('1) remembers the match-result n times, skipping the function invocation while in `repeat` mode', () => {
                const stickyN = coll.sticky(2, {when: x => 1, recharge: false})(coll.identity);
                const result = coll.map(stickyN, data1);
                expect(result).toEqual(expected1_2_not_recharge);
            });
            it('2) remembers the match-result n times, skipping the function invocation while in `repeat` mode', () => {
                const stickyN = coll.sticky(2, {when: x => 1, recharge: false})(coll.identity);
                const result = coll.map(stickyN, data2);
                expect(result).toEqual(expected2_2_not_recharge);
            });
            it('3) remembers the match-result n times, skipping the function invocation while in `repeat` mode', () => {
                const stickyN = coll.sticky(3, {when: x => 1, recharge: false})(coll.identity);
                const result = coll.map(stickyN, data3);
                expect(result).toEqual(expected3_3_not_recharge);
            });
        });
    });

    describe('compose = step-function/append = reducing-function/reduce = pipeline-runner =~ transduce', () => {
        const expectedResult = [144, 196, 256, 324, 400];

        it('composes functions * right * to left', () => {
            const composedFn = coll.compose(fn2, fn1);
            const result = composedFn(5);
            expect(result).toEqual(225);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> object values', () => {
            const transducer = coll.compose(xform1, xform2, xform3);
            const reducingFn = transducer(coll.append(/*reducingFn*/));
            const result = coll.reduce(reducingFn, () => [], dataObject);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> iterable', () => {
            const transducer = coll.compose(xform1, xform2, xform3);
            const reducingFn = transducer(coll.append(/*reducingFn*/));
            // NOTE: alternative composition (1)

            // const transducer = coll.compose(xform1, xform2, xform3, coll.append);
            // const reducingFn = transducer(/*reducingFn*/);
            const result = coll.reduce(reducingFn, () => [], dataIterable);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> iterator', () => {
            const transducer = coll.compose(xform1, xform2, xform3);
            const reducingFn = transducer(coll.append(/*reducingFn*/));
            const result = coll.reduce(reducingFn, () => [], dataIterator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> generator', () => {
            const transducer = coll.compose(xform1, xform2, xform3);
            const reducingFn = transducer(coll.append(/*reducingFn*/));
            const result = coll.reduce(reducingFn, () => [], dataGenerator());
            expect(result).toEqual(expectedResult);
        });
    });

    describe('pipe = step-function/append = reducing-function/reduce = pipeline-runner =~ transduce', () => {
        const expectedResult = [144, 196, 256, 324, 400];

        it('pipes functions * left * to right', () => {
            const composedFn = coll.pipe(fn1, fn2);
            const result = composedFn(5);
            expect(result).toEqual(225);
        });
        it('transduce using piped transducers * right * to left, over an enumerable -> object values', () => {
            const transducer = coll.flip(coll.pipe)(xform1, xform2, xform3);
            const reducingFn = transducer(coll.append(/*reducingFn*/));
            const result = coll.reduce(reducingFn, () => [], dataObject);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using piped transducers * right * to left, over an enumerable -> iterable', () => {
            const transducer = coll.flip(coll.pipe)(xform1, xform2, xform3);
            const reducingFn = transducer(coll.append(/*reducingFn*/));
            // NOTE: alternative composition (1)

            // const transducer = coll.compose(xform1, xform2, xform3, coll.append);
            // const reducingFn = transducer(/*reducingFn*/);
            const result = coll.reduce(reducingFn, () => [], dataIterable);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using piped transducers * right * to left, over an enumerable -> iterator', () => {
            const transducer = coll.flip(coll.pipe)(xform1, xform2, xform3);
            const reducingFn = transducer(coll.append(/*reducingFn*/));
            const result = coll.reduce(reducingFn, () => [], dataIterator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using piped transducers * right * to left, over an enumerable -> generator', () => {
            const transducer = coll.flip(coll.pipe)(xform1, xform2, xform3);
            const reducingFn = transducer(coll.append(/*reducingFn*/));
            const result = coll.reduce(reducingFn, () => [], dataGenerator());
            expect(result).toEqual(expectedResult);
        });
    });

    describe('compose = step-function/concat = reducing-function/reduce = pipeline-runner =~ transduce', () => {
        const expectedResult = [144, 196, 256, 324, 400];

        it('composes functions * right * to left', () => {
            const composedFn = coll.compose(fn2Box, fn1Box);
            const result = composedFn(5);
            expect(result).toEqual([225]);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> object values', () => {
            const transducer = coll.compose(xform1Box, xform2Box, xform3);
            const reducingFn = transducer(coll.which(coll.concat(/*reducingFn*/)));
            const result = coll.reduce(reducingFn, () => [], dataObject);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> iterable', () => {
            const transducer = coll.compose(xform1Box, xform2Box, xform3);
            const reducingFn = transducer(coll.concat(/*reducingFn*/));
            const result = coll.reduce(reducingFn, () => [], dataIterable);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> iterator', () => {
            const transducer = coll.compose(xform1Box, xform2Box, xform3);
            const reducingFn = transducer(coll.concat(/*reducingFn*/));
            const result = coll.reduce(reducingFn, () => [], dataIterator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> generator', () => {
            const transducer = coll.compose(xform1Box, xform2Box, xform3);
            const reducingFn = transducer(coll.concat(/*reducingFn*/));
            const result = coll.reduce(reducingFn, () => [], dataGenerator());
            expect(result).toEqual(expectedResult);
        });
    });

    describe('compose= step-function/sum = reducing-function/reduce= pipeline-runner =~ transduce', () => {
        const expectedResult = 1321;
        const _sum = (a, b) => a + b;
        const sum = coll.which(_sum);

        it('transduce using composed transducers * left * to right, over an enumerable -> object values', () => {
            const transducer = coll.compose(xform1, xform2, xform3);
            const reducingFn = transducer(sum);
            const result = coll.reduce(reducingFn, undefined, dataObject);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> iterable', () => {
            const transducer = coll.compose(xform1, xform2, xform3);
            const reducingFn = transducer(sum);
            const result = coll.reduce(reducingFn, undefined, dataIterable);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> iterator', () => {
            const transducer = coll.compose(xform1, xform2, xform3);
            const reducingFn = transducer(sum);
            const result = coll.reduce(reducingFn, undefined, dataIterator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed transducers * left * to right, over an enumerable -> generator', () => {
            const transducer = coll.compose(xform1, xform2, xform3);
            const reducingFn = transducer(sum);
            const result = coll.reduce(reducingFn, undefined, dataGenerator());
            expect(result).toEqual(expectedResult);
        });
    });

    // describe('walk', () => {
    //    it('walks a document-tree DFT in-order', () => {
    //
    //    });
    // });
});

describe('async', () => {
    describe('mapAsync', () => {
        it('maps an async function over an enumerable -> object values', async () => {
            const result = await coll.mapAsync(fn1Async, dataObject);
            expect(result).toEqual(dataIterable.map(_fn1));
        });
        it('maps an async function over an enumerable -> iterable', async () => {
            const result = await coll.mapAsync(fn1Async, dataIterable);
            expect(result).toEqual(dataIterable.map(_fn1));
        });
        it('maps an async function over an enumerable -> iterator', async () => {
            const result = await coll.mapAsync(fn1Async, dataIterator());
            expect(result).toEqual(dataIterable.map(_fn1));
        });
        it('maps an async function over an enumerable -> generator', async () => {
            const result = await coll.mapAsync(fn1Async, dataGenerator());
            expect(result).toEqual(dataIterable.map(_fn1));
        });
        it('maps an async function over an enumerable -> async-generator of values', async () => {
            const result = await coll.mapAsync(fn1Async, dataAsyncGenerator());
            expect(result).toEqual(dataIterable.map(_fn1));
        });
        it('maps an async function over an enumerable -> async-generator of Promises', async () => {
            const result = await coll.mapAsync(fn1Async, dataAsyncGeneratorOfPromises());
            expect(result).toEqual(dataIterable.map(_fn1));
        });
    });

    describe('filterAsync', () => {
        it('maps an async function over an enumerable -> object values', async () => {
            const result = await coll.filterAsync(predicateEvenAsync, dataObject);
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
        it('filters an async function over an enumerable -> iterable', async () => {
            const result = await coll.filterAsync(predicateEvenAsync, dataIterable);
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
        it('filters an async function over an enumerable -> iterator', async () => {
            const result = await coll.filterAsync(predicateEvenAsync, dataIterator());
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
        it('filters an async function over an enumerable -> generator', async () => {
            const result = await coll.filterAsync(predicateEvenAsync, dataGenerator());
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
        it('filters an async function over an enumerable -> async-generator of values', async () => {
            const result = await coll.filterAsync(predicateEvenAsync, dataAsyncGenerator());
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
        it('filters an async function over an enumerable -> async-generator of Promises', async () => {
            const result = await coll.filterAsync(predicateEvenAsync, dataAsyncGeneratorOfPromises());
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
        it('filters a predicate function over an enumerable -> async-generator of Promises', async () => {
            const result = await coll.filterAsync(predicateEven, dataAsyncGeneratorOfPromises());
            expect(result).toEqual(dataIterable.filter(_predicateEven));
        });
    });

    describe('composeAsync = step-function/appendAsync = reducing-function/reduceAsync = pipeline-runner =~ transduce-async', () => {
        const expectedResult = [144, 196, 256, 324, 400];

        it('composes async functions * right * to left', async () => {
            const composedFn = await coll.composeAsync(fn2Async, fn1Async);
            const result = await composedFn(5);
            expect(result).toEqual(225);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> object values', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.appendAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataObject);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> iterable', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.appendAsync(/*reducingFn*/));
            // NOTE: alternative composition (1)

            // const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async, coll.appendAsync);
            // const reducingFnAsync = await transducerAsync(/*reducingFn*/);
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataIterable);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> iterator', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.appendAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataIterator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> generator', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.appendAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataGenerator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> async-generator of values', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.appendAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataAsyncGenerator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> async-generator of promises', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.appendAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataAsyncGeneratorOfPromises());
            expect(result).toEqual(expectedResult);
        });
    });

    describe('composeAsync = step-function/concatAsync = reducing-function/reduceAsync = pipeline-runner =~ transduce-async', () => {
        const expectedResult = [144, 196, 256, 324, 400];

        it('composes async functions * right * to left', async () => {
            const composedFn = await coll.composeAsync(fn2AsyncBox, fn1AsyncBox);
            const result = await composedFn(5);
            expect(result).toEqual([225]);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> object values', async () => {
            const transducerAsync = await coll.composeAsync(xform1AsyncBox, xform2AsyncBox, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.which(coll.concatAsync(/*reducingFn*/)));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataObject);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> iterable', async () => {
            const transducerAsync = await coll.composeAsync(xform1AsyncBox, xform2AsyncBox, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.concatAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataIterable);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> iterator', async () => {
            const transducerAsync = await coll.composeAsync(xform1AsyncBox, xform2AsyncBox, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.concatAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataIterator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> generator', async () => {
            const transducerAsync = await coll.composeAsync(xform1AsyncBox, xform2AsyncBox, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.concatAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataGenerator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> async-generator of values', async () => {
            const transducerAsync = await coll.composeAsync(xform1AsyncBox, xform2AsyncBox, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.concatAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataAsyncGenerator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> async-generator of promises', async () => {
            const transducerAsync = await coll.composeAsync(xform1AsyncBox, xform2AsyncBox, xform3Async);
            const reducingFnAsync = await transducerAsync(coll.concatAsync(/*reducingFn*/));
            const result = await coll.reduceAsync(reducingFnAsync, () => [], dataAsyncGeneratorOfPromises());
            expect(result).toEqual(expectedResult);
        });
    });

    describe('composeAsync = step-function/sum = reducing-function/reduceAsync = pipeline-runner =~ transduce-async', () => {
        const expectedResult = 1321;
        const _sum = (a, b) => a + b;
        const sum = coll.which(_sum);

        it('transduce using composed async transducers * left * to right, over an enumerable -> object values', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(sum);
            const result = await coll.reduceAsync(reducingFnAsync, undefined, dataObject);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> iterable', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(sum);
            const result = await coll.reduceAsync(reducingFnAsync, undefined, dataIterable);
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> iterator', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(sum);
            const result = await coll.reduceAsync(reducingFnAsync, undefined, dataIterator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> generator', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(sum);
            const result = await coll.reduceAsync(reducingFnAsync, undefined, dataGenerator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> async-generator of values', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(sum);
            const result = await coll.reduceAsync(reducingFnAsync, undefined, dataAsyncGenerator());
            expect(result).toEqual(expectedResult);
        });
        it('transduce using composed async transducers * left * to right, over an enumerable -> async-generator of promises', async () => {
            const transducerAsync = await coll.composeAsync(xform1Async, xform2Async, xform3Async);
            const reducingFnAsync = await transducerAsync(sum);
            const result = await coll.reduceAsync(reducingFnAsync, undefined, dataAsyncGeneratorOfPromises());
            expect(result).toEqual(expectedResult);
        });
    });
});
