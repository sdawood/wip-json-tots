const R = require('ramda');

const {transform} = require('./transform');

const document = {
    a: [1, 2, 3],
    b: 4,
    c: [5, 6],
    d: {e: [7, 8], f: 9, g: null},
    h: null
};

describe('transform', () => {
    const template = {
        a_sum: R.over(R.lensPath(['a']), R.sum),
        b: R.over(R.lensPath(['b']), R.identity),
        c: R.over(R.lensPath(['c']), R.identity),
        d: R.over(R.lensPath(['d']), R.identity),
        h: R.over(R.lensPath(['h']), R.identity)
    };

    it('transforms by using lensePath(s)', () => {
        const expectedDocument = {
            a_sum: 6,
            b: 4,
            c: [5, 6],
            d: {e: [7, 8], f: 9, g: null},
            h: null
        };
        expect(transform(template, document)).toEqual(expectedDocument);
    });
});


