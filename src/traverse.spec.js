const {traversal} = require('./traverse');

const document = {
    a: [1,2,3],
    b: 4,
    c: [5,6],
    d: { e: [7,8], f: 9 , g: null},
    h: null
};

describe('traversal', () => {
    
    it('transforms by rejecting nil values by default', () => {
        const expectedDocument = {
            a: [1,2,3],
            b: 4,
            c: [5,6],
            d: { e: [7,8], f: 9}
        };
        expect(traversal(document)).toEqual(expectedDocument);
    });
        
    it('transforms by applying mappers pipeline to leaf values', () => {
        const expectedDocument = {
            a: ['10','20','30'],
            b: '40',
            c: ['50','60'],
            d: { e: ['70','80'], f: '90'}
        };
        expect(traversal(document, {mappers: [x => x * 10, x => `${x}`]})).toEqual(expectedDocument);
    })
});
