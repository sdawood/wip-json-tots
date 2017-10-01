const {rephs} = require('../transform-beta');

describe('#rephs', () => {
    describe('tokenization', () => {
        it('returns non placeholders wrapped in an atom', () => {
            const txt = 'hello world';
            const expected = {"@meta": 0, "reduced": true, "source": "hello world", "value": "hello world"};
            expect(rephs(txt)).toEqual(expected);
        });
        it('returns placeholder {operator?, path, pipes?}', () => {
            const txt = '{{x.y.z}}';
            // const expected = {value: txt, reduced: true};
            const expected = [{"@meta": 1, "path": "x.y.z", "reduced": false, "source": "{{x.y.z}}", "value": null}];
            expect(rephs(txt)).toEqual(expected);
        });
        it('destructures operators with group aliases', () => {
            const txt = '{*|+{x.y.z}}';
            const expected = [{
                "@meta": 1,
                "operators": {"@meta": 2, "enumerate": "*", "query": "+"},
                "path": "x.y.z",
                "reduced": false,
                "source": "{*|+{x.y.z}}",
                "value": null
            }];
            expect(rephs(txt)).toEqual(expected);
        });
        it('destructures pipes with increasing index', () => {
            const txt = '{...|**|+{x.y.z}| async:__:100 | *}';
            const expected = [{
                "@meta": 1,
                "operators": {"@meta": 2, "enumerate": "**", "inception": "...", "query": "+"},
                "path": "x.y.z",
                "pipes": {"$1": "async:__:100", "$2": "*", "@meta": 3},
                "reduced": false,
                "source": "{...|**|+{x.y.z}| async:__:100 | *}",
                "value": null
            }];
            expect(rephs(txt)).toEqual(expected);
        });
        /*============================== [ multiple placeholders ] ==============================*/
        it('handles multiple placeholders within a string template, reph-ing identical occurrences once', () => {
            const txt = 'hello {{contact.name.first}} {{contact.name.last}}, can I call you {{contact.name.first}}?';
            const expected = [{
                "@meta": 1,
                "path": "contact.name.first",
                "reduced": false,
                "source": "{{contact.name.first}}",
                "value": null
            }, {
                "@meta": 1,
                "path": "contact.name.last",
                "reduced": false,
                "source": "{{contact.name.last}}",
                "value": null
            }];
            expect(rephs(txt)).toEqual(expected);
        });

        it('handles multiple placeholders within a string template, with no collision of non-identical occurrences', () => {
            const txt = 'hello {{contact.name.first}} {{contact.name.last}}, can I call you {{contact.name.first} | upper}?';
            const expected = [{
                "@meta": 1,
                "path": "contact.name.first",
                "reduced": false,
                "source": "{{contact.name.first}}",
                "value": null
            }, {
                "@meta": 1,
                "path": "contact.name.last",
                "reduced": false,
                "source": "{{contact.name.last}}",
                "value": null
            }, {
                "@meta": 1,
                "path": "contact.name.first",
                "pipes": {"$1": "upper", "@meta": 3},
                "reduced": false,
                "source": "{{contact.name.first} | upper}",
                "value": null
            }];
            expect(rephs(txt)).toEqual(expected);
        });

        it('1) handles all supported operator/pipe combinations', () => {
            const txt = 'hello {.. | * | : | + {contact.name.first} | * | take:10 } {.4 | ** | #lname | + {contact.name.last} | trim:10:__}, can I call you {{contact.name.first}}?';
            const expected = [
                {
                    "@meta": 1,
                    "operators": {
                        "@meta": 2, "enumerate": "*", "inception": "..", "query": "+", "symbol": ":"
                    },
                    "path": "contact.name.first",
                    "pipes": {
                        "$1": "*", "$2": "take:10", "@meta": 3
                    }, "reduced": false, "source": "{.. | * | : | + {contact.name.first} | * | take:10 }", "value": null
                },
                {
                    "@meta": 1,
                    "operators": {
                        "@meta": 2, "enumerate": "**", "inception": ".4", "query": "+", "symbol": "#lname"
                    },
                    "path": "contact.name.last",
                    "pipes": {"$1": "trim:10:__", "@meta": 3},
                    "reduced": false,
                    "source": "{.4 | ** | #lname | + {contact.name.last} | trim:10:__}",
                    "value": null
                }, {
                    "@meta": 1,
                    "path": "contact.name.first",
                    "reduced": false,
                    "source": "{{contact.name.first}}",
                    "value": null
                }
            ];
            expect(rephs(txt)).toEqual(expected);
        });

    })
});