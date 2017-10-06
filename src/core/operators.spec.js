const coll = require('./collections');
let {slice, split, of, has} = require('./operators');
slice = coll.which(slice)
split = coll.which(split)
of = coll.which(of)
has = coll.which(has)

describe('operators', () => {
    describe('reduced', () => {

    });
    describe('query', () => {
        it('gracefully handles no parameters', () => {
            const operatorStr = '?';
            let result = coll.pipes(slice(1), split('='), slice(1), of(0))(operatorStr);
            expect(result).toEqual([]);
            result = coll.pipes(slice(1), split('='), slice(1), of(0), split(':'))(operatorStr);
            expect(result).toEqual([]);
        });
        it('extracts the parameters', () => {
            const operatorStr = '?=default:10:20:30';
            const result = coll.pipes(slice(1), split('='), slice(1), of(0), split(':'))(operatorStr);
            expect(result).toEqual(["default", "10", "20", "30"]);
        })
    });
    describe('constraints', () => {

    });
    describe('symbol', () => {

    });
    describe('enumerate', () => {

    });
    describe('inception', () => {

    });
});