const {clone, flatten, countBy, keys, values, prop, map, reduce, pipe, toUpper, take, concat, flip} = require('ramda');

const append = flip(concat); // ramda philosophically doesn't append to a string!!! https://github.com/ramda/ramda/issues/1805

const transform = require('./proto-transform');
const coll = require('./core/collections');

const original = Object.freeze({
    id: 123,
    title: 'Bicycle 123',
    description: '123 description',
    bicycleType: 'Hybrid',
    brand: 'Brand-Company C',
    price: 500,
    color: ['Red', 'Black'],
    productCategory: 'Bicycle',
    inStok: true,
    quantityOnHand: null,
    relatedItems: [341, 472, 649],
    tags: {
        hot: {author: 'anonymousUser1', timestamp: '2016MMDDHHmmssSSS'},
        seasonal: {author: 'anonymousUser2', timestamp: '2017MMDDHHmmssSSS'},
        personalTransportation: {author: 'memberUser3', timestamp: '2015MMDDHHmmssSSS'}
    },
    pictures: [
        {
            view: 'front',
            images: [{big: 'http://example.com/products/123_front.jpg'}, {thumbnail: 'http://example.com/products/123_front_small.jpg'}]
        },
        {
            view: 'rear',
            images: [{big: 'http://example.com/products/123_rear.jpg'}, {thumbnail: 'http://example.com/products/123_rear_small.jpg'}]
        },
        {
            view: 'side',
            images: [{big: 'http://example.com/products/123_left_side.jpg'}, {thumbnail: 'http://example.com/products/123_left_side_small.jpg'}]
        }
    ],
    productReview: {
        fiveStar: [
            {
                author: 'user1@domain1.com',
                comment: "Excellent! Can't recommend it highly enough! Buy it!",
                score: 5,
                viewAs: ['*', '*', '*', '*', '*']
            },
            {
                author: 'user2@domain2.com',
                comment: 'Do yourself a favor and buy this.',
                score: 5,
                viewAs: ['*', '*', '*', '*', '*']
            }
        ],
        oneStar: [
            {
                author: 'user3@domain3.com',
                comment: 'Terrible product! Do no buy this.',
                score: 1,
                viewAs: ['*', '-', '-', '-', '-']
            }
        ]
    },
    comment: 'This product sells out quickly during the summer',
    'Safety.Warning': 'Always wear a helmet' // attribute name with `.`
});

describe('transform', () => {
    describe('simple interpolation', () => {
        const template = {
            name: '{{title}}',
            reviews: {
                high: '{{productReview.fiveStar[0].comment}}', // <- this is an arbitrary javascript property access expression, evaluated as `new Function('data', 'return data.' + ref + ';')(data)`;
                low: '{{productReview.oneStar[0].comment}}',
                disclaimer: 'Ad: {{comment}}'
            },
            safety: '{{Safety.Warning}}'
        };

        const expectedResult = {
            name: original.title,
            reviews: {
                high: original.productReview.fiveStar[0].comment,
                low: original.productReview.oneStar[0].comment,
                disclaimer: `Ad: ${original.comment}`
            },
            safety: original['Safety.Warning']
        };

        let result;
        let templateClone = clone(template);

        beforeEach(() => {
            result = transform(templateClone, original);
        });

        it('handles 1..* levels of nesting, and special characters in attribute names', () => {
            expect(result).toEqual(expectedResult);
        });

        it('does not mutate the template', () => {
            expect(templateClone).toEqual(template);
        });
    });

    describe.only('simple template array mapping interpolation', () => {
        const template = {
            name: '{{title}}',
            related: ['{{relatedItems}}', 'see also: {{valueOf()}}'], // <- this ends up calling new Function('data', 'return data.' + 'valueOf()' + ';') for each. TODO: can't do array element reference, using => identity(??) of what?, options: use @ to reference the current element in the for-each behavior?
            whatDoesThisDo: ['{{relatedItems}}',],
            reviews: {
                high: ['{{productReview.fiveStar}}', {
                    praise: '{{comment}}'
                }],
                low: ['{{productReview.oneStar}}', {
                    criticism: '{{comment}}'
                }],
                disclaimer: 'Ad: {{comment}}'
            },
            views: ['{{pictures}}', '[{{view}}]({{view.images.length}})'] // TODO: line:85, replace with /\{\{\}\}/g kinda regex and traverse
        };

        const expectedResult = {
            name: original.title,
            related: original.relatedItems.map(x => `see also: ${x}`),
            reviews: {
                high: original.productReview.fiveStar.map(x => ({praise: x.comment})),
                low: original.productReview.oneStar.map(x => ({criticism: x.comment})),
                disclaimer: `Ad: ${original.comment}`
            }
        };

        let result;
        let templateClone = clone(template);

        beforeEach(() => {
            result = transform(templateClone, original);
        });

        it('renders each array elements using the nested template, supporting straightforward enumeration', () => {
            expect(result).toEqual(expectedResult);
        });

        it('does not mutate the template', () => {
            expect(templateClone).toEqual(template);
        });
    });

    describe('nested template array mapping interpolation', () => {
        describe('with the intention of applying for-each', () => {
            const template = {
                name: '{{title}}',
                gallery: {
                    thumbnails: [ // <- TODO: if we call flatten here, 1) it won't be declarative, 2) the template engine won't recognize the array and won't work
                        '{{pictures}}', [ // <- TODO: this is identical to over(lensPath, transform) but currently works only with Array!!!
                            '{{images}}',
                            {
                                href: '{{thumbnail}}' // <- TODO: here we want to use either a filter expression ?(@.thumbnail) or an angular style safe navigation operator @.thumbnail?.attr
                            }
                        ]
                    ] // <- TODO: how to flatten the result [[], [], ...]. Any mapping here would apply for each nested array, but can't have a transform for the whole final result array, transducer?
                },
                reviews: {
                    high: ['{{productReview.fiveStar}}', {
                        praise: '{{comment}}'
                    }],
                    low: ['{{productReview.oneStar}}', {
                        criticism: '{{comment}}'
                    }],
                    disclaimer: 'Ad: {{comment}}'
                }
            };

            const expectedResult = {
                name: original.title,
                gallery: {thumbnails: flatten(original.pictures.map(({images}) => images.map(({thumbnail}) => ({href: thumbnail || ''}))))}, // <- TODO: transform by default converts undefined to ""
                // ^^^ TODO: it should be possible to flatten a nested transform
                // ^^^ TODO: it should be possible to ignore the keys with undefined/null/empty/!predicate values
                reviews: {
                    high: original.productReview.fiveStar.map(x => ({praise: x.comment})),
                    low: original.productReview.oneStar.map(x => ({criticism: x.comment})),
                    disclaimer: `Ad: ${original.comment}`
                }
            };

            let result;
            let templateClone = clone(template);

            beforeEach(() => {
                result = transform(templateClone, original);
            });

            it('renders each array elements using the nested template, supporting straightforward enumeration', () => {
                expect(result).toEqual(expectedResult);
            });

            it('does not mutate the template', () => {
                expect(templateClone).toEqual(template);
            });
        });
        describe('without the intention of applying for-each', () => {
            const template = {
                name: '{{title}}',
                gallery: {
                    thumbnails: [
                        '{{pictures}}', // <- TODO: currently the result is undesirable, it applies the second path to n times (n = pictures.length), and derefs from the root data!!!
                        // ^^^ TODO: use {{...pictures}} either to apply for each or to spread into a target array, e.g. for concating multiple lists/objects
                        // ^^^ TODO: OR: instead of {{interpolation}} use '(path)' to indicate that you want to handle/listen/output elements from derefing the path, Angular banana style, [(path)] would do both enumeration and for-each and possibly concatAll? banana in a box anyone?
                        '{{pictures[0].images}}' // <- TODO: say for some reason we want an array to contain pictures and front pictures, without triggering for-each
                        // ^^^ TODO: how to signal itention to apply path expression to the focused for-each, or just substituting the value into target array?
                        // ^^^ TODO: consider {{..images}} to signal context focused path expression?
                        // ^^^ TODO: OR '[sub-path]' adopting the input-template-parameters style of Angular, with the ability to do both [()]
                        // ^^^ TODO: adopting Angular [(path)] style would render {{path}} as a basic interpolation, removing ambiguity possibly
                        // ^^^ TODO: #tag() and [#tag()] would fit nicely, tagging the output-parameter, which can then be referenced in other places using [@tag] === input here by derefing the tag
                        // ^^^ TODO: #tag(regex-capture-group) feels natural in this syntax ++, see workspace/code-name-reactive-pipeline/src/sandbox/worx/tot.spec.js
                        // ^^^ TODO:repeated how to signal the start of a pipeline of functions if we drop the '=>fn()'?, in otherwords, how would the Pipe Syntax `value | fn:arg1:arg2` be represented in this case?
                    ]
                },
                reviews: {
                    high: ['{{productReview.fiveStar}}', {
                        praise: '{{comment}}'
                    }],
                    low: ['{{productReview.oneStar}}', {
                        criticism: '{{comment}}'
                    }],
                    disclaimer: 'Ad: {{comment}}'
                }
            };

            const expectedResult = {
                name: original.title,
                gallery: {
                    thumbnails: [original.pictures, original.pictures[0].images]
                },
                reviews: {
                    high: original.productReview.fiveStar.map(x => ({praise: x.comment})),
                    low: original.productReview.oneStar.map(x => ({criticism: x.comment})),
                    disclaimer: `Ad: ${original.comment}`
                }
            };

            let result;
            let templateClone = clone(template);

            beforeEach(() => {
                result = transform(templateClone, original);
            });

            it('renders each array elements using the nested template, supporting straightforward enumeration', () => {
                expect(result).toEqual(expectedResult);
            });

            it('does not mutate the template', () => {
                expect(templateClone).toEqual(template);
            });
        });
    });

    describe('nested template partials (external template reference)', () => {
        it('works', () => {
            throw new Error('Unsupported operation');
        });
    });

    describe('built-in transform functions', () => {
        const defaultSafetyWarning = 'www.domain.com/standard-safety-warning';
        const template = {
            name: '{{title}}',
            reviews: {
                high: '{{productReview.fiveStar[0].comment}}', // <- this is an arbitrary javascript property access expression, evaluated as `new Function('data', 'return data.' + ref + ';')(data)`;
                low: '{{productReview.oneStar[0].comment}}',
                disclaimer: 'Ad: {{comment}}'
            },
            safety: `=> either(Safety.Warning, "${defaultSafetyWarning}")` // <- TODO: template string doesn't work without the double quotes, the engine handles it as a path otherwise @line:164!!!
        };

        const expectedResult = {
            name: original.title,
            reviews: {
                high: original.productReview.fiveStar[0].comment,
                low: original.productReview.oneStar[0].comment,
                disclaimer: `Ad: ${original.comment}`
            },
            safety: defaultSafetyWarning
        };

        let result;
        let templateClone = clone(template);

        beforeEach(() => {
            result = transform(templateClone, original);
        });

        it('handles 1..* levels of nesting, and special characters in attribute names', () => {
            expect(result).toEqual(expectedResult);
        });

        it('does not mutate the template', () => {
            expect(templateClone).toEqual(template);
        });
    });

    describe('user-defined transform functions', () => {
        const fn = x => 'SIMILAR TO R.applySpec(data)';
        const template = {
            name: '{{title}}',
            nonDeclarative: fn,
            // gallery: {
            //     thumbnails: '=> flatten([ // <- TODO: we can't use a user defined flatten here, since the whole array mapping template is not a string hence the engine doesn't recognize
            //         '{{pictures}}', [
            //             '{{images}}',
            //             {
            //                 href: '{{thumbnail}}'
            //             }
            //         ]
            //     ]') // <- how to flatten the result [[], [], ...]. Any mapping here would apply for each nested array, but can't have a transform for the whole final result array
            // },
            reviews: {
                fiveStar: '{{productReview.fiveStar.length}}',
                oneStar: '{{productReview.oneStar.length}}',
                byScore: '=> byScore(productReview.oneStar, productReview.fiveStar)',
                // ^^^ TODO: instead of hard-coding the keys, we'd want to map over the values of the productReview map and apply an aggregation
                // average: '=> average(#byScore)', // <- TODO: here we'd want to use the byScore aggregation to calculate the average ideally, #ref self reference feature
                // ^^^ TODO: a #ref intended to be used as an intermediate result should be optionally included in the output or ignored based on a configurable flag
                average: '=> average(productReview)',
                disclaimer: 'Ad: {{comment}}'
            }
        };

        const byScore = (...args) => args.map(countBy(prop('score')));
        const average = reviews => reduce((acc, input) => {
            const score = keys(input)[0];
            return acc + parseInt(score) * input[score];
        }, 0, byScore(...values(reviews)));



        const expectedResult = {
            name: original.title,
            nonDeclarative: 'SIMILAR TO R.applySpec(data)',
            reviews: {
                fiveStar: original.productReview.fiveStar.length,
                oneStar: original.productReview.oneStar.length,
                byScore: byScore(original.productReview.oneStar, original.productReview.fiveStar),
                average: average(original.productReview),
                disclaimer: `Ad: ${original.comment}`
            }
        };

        let result;
        let templateClone = clone(template);

        beforeEach(() => {
            result = transform(templateClone, original, {byScore, average, fn});
        });

        it('renders each array elements using the nested template, supporting straightforward enumeration', () => {
            expect(result).toEqual(expectedResult);
        });

        it('does not mutate the template', () => {
            expect(templateClone).toEqual(template);
        });
    });

    describe('pipeline of transform functions', () => {
        // see: https://angular.io/guide/pipes, https://angular.io/guide/pipes#pure-and-impure-pipes
        // TODO: a pipe function receives data first fn(data):a:b, e.g. Angular Pipe, then args, or data last? fn:a:b(data), or let the user choose fn::a:b vs fn:a:b:: where :: is the target arg position for data
        describe('pipleline application to a single template reference', () => {
            const template = {
                name: '{{title | toUpper | take:5 | append:"..."}}',
                reviews: {
                    high: '{{productReview.fiveStar[0].comment}}', // <- this is an arbitrary javascript property access expression, evaluated as `new Function('data', 'return data.' + ref + ';')(data)`;
                    low: '{{productReview.oneStar[0].comment}}',
                    disclaimer: 'Ad: {{comment}}'
                }
            };

            const expectedResult = {
                name: pipe(toUpper, take(5), append("..."))(original.title),
                reviews: {
                    high: original.productReview.fiveStar[0].comment,
                    low: original.productReview.oneStar[0].comment,
                    disclaimer: `Ad: ${original.comment}`
                }
            };

            let result;
            let templateClone = clone(template);

            beforeEach(() => {
                result = transform(templateClone, original);
            });

            it('applies the transformation pipeline to a single attribute using the | operator', () => {
                expect(result).toEqual(expectedResult);
            });

            it('does not mutate the template', () => {
                expect(templateClone).toEqual(template);
            });
        });
        describe('pipleline application to a traversal of array', () => {
            const template = {
                name: '{{title | toUpper | take(5) | concat("...")}}',
                reviews: {
                    high: '{{productReview.fiveStar[0].comment}}', // <- this is an arbitrary javascript property access expression, evaluated as `new Function('data', 'return data.' + ref + ';')(data)`;
                    low: '{{productReview.oneStar[0].comment}}',
                    disclaimer: 'Ad: {{comment}}'
                },
                // related: ['{{relatedItems}}', '{{valueOf()}}'],
                related: [
                    '{{relatedItems}}', // <- TODO: @line:132 `node.length === 2`, seriously!!!
                    '{{valueOf()}}',// TODO: here we want the elements as is, which syntax is best, still thinking `@`? {{valueOf()}} is a disaster, when pipe works use => identity maybe?
                    '=> url(item, "www.domain/item/")', // <- TODO: what is a good syntax for function invocation? Angular-2? EDN style '[fn ...args]', [path, '|', fn1:[x]:arg1:arg2, fn2::arg1:arg2, ...]
                    '=> take(5)',
                    '=> append("...")'
                ]
            };

            const expectedResult = {
                name: pipe(toUpper, take(5), append("..."))(original.title),
                reviews: {
                    high: original.productReview.fiveStar[0].comment,
                    low: original.productReview.oneStar[0].comment,
                    disclaimer: `Ad: ${original.comment}`
                },
                related: original.relatedItems.map(pipe(ri => `www.domain/item/${ri}`, take(10), append("...")))
            };

            let result;
            let templateClone = clone(template);

            beforeEach(() => {
                result = transform(templateClone, original);
            });

            it('applies the transformation pipeline to a single attribute using the | operator', () => {
                expect(result).toEqual(expectedResult);
            });

            it('does not mutate the template', () => {
                expect(templateClone).toEqual(template);
            });
        });
        describe('pipleline application to a traversal of object values', () => {
            const template = {
                name: '{{title | toUpper | take(5) | concat("...")}}',
                reviews: {
                    high: '{{productReview.fiveStar[0].comment}}', // <- this is an arbitrary javascript property access expression, evaluated as `new Function('data', 'return data.' + ref + ';')(data)`;
                    low: '{{productReview.oneStar[0].comment}}',
                    disclaimer: 'Ad: {{comment}}'
                }
            };

            const expectedResult = {
                name: pipe(toUpper, take(5), append("..."))(original.title),
                reviews: {
                    high: original.productReview.fiveStar[0].comment,
                    low: original.productReview.oneStar[0].comment,
                    disclaimer: `Ad: ${original.comment}`
                }
            };

            let result;
            let templateClone = clone(template);

            beforeEach(() => {
                result = transform(templateClone, original);
            });

            it('applies the transformation pipeline to a single attribute using the | operator', () => {
                expect(result).toEqual(expectedResult);
            });

            it('does not mutate the template', () => {
                expect(templateClone).toEqual(template);
            });
        });
    });

    describe('simple template object mapping interpolation', () => {
        const template = {
            name: '{{title}}',
            reviews: {
                high: ['{{productReview.fiveStar}}', {
                    praise: '{{comment}}'
                }],
                low: ['{{productReview.oneStar}}', {
                    criticism: '{{comment}}'
                }],
                disclaimer: 'Ad: {{comment}}',
                tagsByYear: [
                    '{{tags}}', // <- TODO: enumerate objects and iterables alike
                    { // <- for each value
                        timestamp: '{{timestamp}}' //  <- TODO: need a shorthand '{{:timestamp}}' === { timestamp: '{{timestamp}}'}
                    }
                    // <- TODO: wouldn't it be useful to apply a sort or aggregate here for the result iterable?
                    // <- TODO if we want a list of timestamps, we would have to next for-each templates and end up with [[ts1], [ts2]], pipe to flatten?
                ]
            }
        };

        const expectedResult = {
            name: original.title,
            reviews: {
                high: original.productReview.fiveStar.map(x => ({praise: x.comment})),
                low: original.productReview.oneStar.map(x => ({criticism: x.comment})),
                disclaimer: `Ad: ${original.comment}`
            },
            tagsByYear: map(({timestamp}) => ({timestamp}), [...coll.iterator(original.tags)]) // TODO: (sad-face) Ramda doesn't map over iterators/generators: https://github.com/ramda/ramda/issues/1809
        };

        let result;
        let templateClone = clone(template);

        beforeEach(() => {
            result = transform(templateClone, original);
        });

        it('renders each object value using the nested template, supporting straightforward enumeration', () => {
            expect(result).toEqual(expectedResult);
        });

        it('does not mutate the template', () => {
            expect(templateClone).toEqual(template);
        });
    });

    describe('nested template object mapping interpolation', () => {
        const template = {
            name: '{{title}}',
            reviews: {
                high: ['{{productReview.fiveStar}}', {
                    praise: '{{comment}}'
                }],
                low: ['{{productReview.oneStar}}', {
                    criticism: '{{comment}}'
                }],
                disclaimer: 'Ad: {{comment}}',
                tagsByYear: [
                    '{{tags}}', // <- TODO: enumerate objects and iterables alike
                    [
                        '{{timestamp}}',
                        // pipe into identity() implicitly
                    ]
                    // <- TODO: wouldn't it be useful to apply a sort or aggregate here for the result iterable?
                    // <- TODO if we want a list of timestamps, we would have to next for-each templates and end up with [[ts1], [ts2]], pipe to flatten?
                ]
            }
        };

        const expectedResult = {
            name: original.title,
            reviews: {
                high: original.productReview.fiveStar.map(x => ({praise: x.comment})),
                low: original.productReview.oneStar.map(x => ({criticism: x.comment})),
                disclaimer: `Ad: ${original.comment}`
            },
            tagsByYear: map(({timestamp}) => timestamp, [...coll.iterator(original.tags)]) // TODO: (sad-face) Ramda doesn't map over iterators/generators: https://github.com/ramda/ramda/issues/1809
        };

        let result;
        let templateClone = clone(template);

        beforeEach(() => {
            result = transform(templateClone, original);
        });

        it('renders each object value using the nested template, supporting straightforward enumeration', () => {
            expect(result).toEqual(expectedResult);
        });

        it('does not mutate the template', () => {
            expect(templateClone).toEqual(template);
        });
    });

    describe('template self #ref vars', () => {
        it('works', () => {
            throw new Error('Unsupported operation');
        });
    });
});
