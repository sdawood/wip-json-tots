/* eslint-disable no-template-curly-in-string */
const strings = require('./strings');

const templateWithStringKeys = 'Welcome user: ${lastName} ... ${firstName} ... ${lastName}';
const templateWithStringKeysDoubleQuoted = 'Welcome user: "${lastName}" ... "${firstName}" ... "${lastName}"';
const templateWithStringKeysSingleQuoted = "Welcome user: '${lastName}' ... '${firstName}' ... '${lastName}'";
const templateWithDoubleQuotedStringKeys = 'Welcome user: ${"lastName"} ... ${"firstName"} ... ${"lastName"}';
const templateWithSingleQuotedStringKeys = "Welcome user: ${'lastName'} ... ${'firstName'} ... ${'lastName'}";

const renderValuesMap = {
    firstName: 'James',
    lastName: 'Bond'
};
const renderValuesList = ['Bond', 'James'];

describe('lazyTemplateTag', () => {
    describe('lazyTemplateTag with string keys', () => {
        it('create a template function that accepts a Map arguments', () => {
            // const template = strings.lazyTag`${templateWithStringKeys}`; // this doesn't work // http://exploringjs.com/es6/ch_template-literals.html#sec_implementing-tag-functions, 8.5.3 Can I load a template literal from an external source?
            const template = strings.lazyTemplateTag`Welcome user: ${'lastName'} ... ${'firstName'} ... ${'lastName'}`;
            expect(template(renderValuesMap)).toEqual("Welcome user: Bond ... James ... Bond");
        });
    });

    describe('lazyTemplateTag with integer keys', () => {
        it('create a template function that accepts a List arguments', () => {
            const template = strings.lazyTemplateTag`Welcome user: ${0} ... ${1} ${0}`;
            expect(template(...renderValuesList)).toEqual("Welcome user: Bond ... James Bond");
        });
    });
});

describe('lazyTemplate creates a template function that accepts a Map arguments', () => {
    describe('with default placeholder == ${.*}', () => {
        it('when called with a string', () => {
            const template = strings.lazyTemplate(templateWithStringKeys);
            expect(template(renderValuesMap)).toEqual("Welcome user: Bond ... James ... Bond");
        });

        it('when called with a string', () => {
            const template = strings.lazyTemplate(templateWithStringKeysDoubleQuoted);
            expect(template(renderValuesMap)).toEqual("Welcome user: \"Bond\" ... \"James\" ... \"Bond\"");
        });

        it('when called with a string', () => {
            const template = strings.lazyTemplate(templateWithStringKeysSingleQuoted);
            expect(template(renderValuesMap)).toEqual("Welcome user: 'Bond' ... 'James' ... 'Bond'");
        });

        it('when called with a string with "key"s', () => {
            const template = strings.lazyTemplate(templateWithDoubleQuotedStringKeys);
            expect(template(renderValuesMap)).toEqual("Welcome user: Bond ... James ... Bond");
        });

        it("when called with a string with 'key's", () => {
            const template = strings.lazyTemplate(templateWithSingleQuotedStringKeys);
            expect(template(renderValuesMap)).toEqual("Welcome user: Bond ... James ... Bond");
        });

        it('when called a template with no parameters', () => {
            // NOTE: template string renders with 'string literal'
            expect(() => strings.lazyTemplate(`Welcome user: ${'lastName'} ... ${'firstName'} ... ${'lastName'}`)).toThrow();
        });
    });
    describe('with custom placeholder == {{.*}}', () => {
        const templateWithStringKeys = 'Welcome user: {{lastName}} ... {{firstName}} ... {{lastName}}';
        const templateWithStringKeysDoubleQuoted = 'Welcome user: "{{lastName}}" ... "{{firstName}}" ... "{{lastName}}"';
        const templateWithStringKeysSingleQuoted = "Welcome user: '{{lastName}}' ... '{{firstName}}' ... '{{lastName}}'";
        const templateWithDoubleQuotedStringKeys = 'Welcome user: {{"lastName"}} ... {{"firstName"}} ... {{"lastName"}}';
        const templateWithSingleQuotedStringKeys = "Welcome user: {{'lastName'}} ... {{'firstName'}} ... {{'lastName'}}";
        const options = {placeholder: {open: '{{', close: '}}'}};

        it('when called with a string', () => {
            const template = strings.lazyTemplate(templateWithStringKeys, options);
            expect(template(renderValuesMap)).toEqual("Welcome user: Bond ... James ... Bond");
        });

        it('when called with a string', () => {
            const template = strings.lazyTemplate(templateWithStringKeysDoubleQuoted, options);
            expect(template(renderValuesMap)).toEqual("Welcome user: \"Bond\" ... \"James\" ... \"Bond\"");
        });

        it('when called with a string', () => {
            const template = strings.lazyTemplate(templateWithStringKeysSingleQuoted, options);
            expect(template(renderValuesMap)).toEqual("Welcome user: 'Bond' ... 'James' ... 'Bond'");
        });

        it('when called with a string with "key"s', () => {
            const template = strings.lazyTemplate(templateWithDoubleQuotedStringKeys, options);
            expect(template(renderValuesMap)).toEqual("Welcome user: Bond ... James ... Bond");
        });

        it("when called with a string with 'key's", () => {
            const template = strings.lazyTemplate(templateWithSingleQuotedStringKeys, options);
            expect(template(renderValuesMap)).toEqual("Welcome user: Bond ... James ... Bond");
        });

        it('when called a template with no parameters', () => {
            // NOTE: template string renders with 'string literal'
            expect(() => strings.lazyTemplate(`Welcome user: ${'lastName'} ... ${'firstName'} ... ${'lastName'}`)).toThrow();
        });
    });
});

describe('tokenize', () => {
    describe('non repeating capture groups', () => {
        const text = 'fhname/2020/07/17/01/type-1-2020-07-17-01-03-06-6f6765f9-0e4f-4949-bd9a-ce72be9dfe30';
        const regex = /^(.*?)\/(\d{4}\/\d{2}\/\d{2}\/\d{2})\/(.*)(?=-\d+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})-(\d+)-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})-(.*)$/; //https://regex101.com/r/yQ6Dyn/1
        const regexStr = '^(.*?)\\/(\\d{4}\\/\\d{2}\\/\\d{2}\\/\\d{2})\\/(.*)(?=-\\d+-\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2})-(\\d+)-(\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2})-(.*)$';
        const attributeName = ['fhname', 'rangeStart', 'deliveryStreamName', 'deliveryStreamVersion', 'timestamp', 'uuid'];
        describe('when called with regex string', () => {
            // NOTE: to get properly escaped regex string, create a regex using /your-regex-here/ then use .source()

            it('defaults to $index of capture group when attributeNames are not provided', () => {
                expect(strings.tokenize(regexStr, text)).toEqual({
                    $1: 'fhname',
                    $2: '2020/07/17/01',
                    $3: 'type',
                    $4: '1',
                    $5: '2020-07-17-01-03-06',
                    $6: '6f6765f9-0e4f-4949-bd9a-ce72be9dfe30'
                });
            });

            it('uses attribute names as keys when attributeNames are provided', () => {
                expect(strings.tokenize(regexStr, text, attributeName)).toEqual({
                    deliveryStreamName: 'type',
                    rangeStart: '2020/07/17/01',
                    fhname: 'fhname',
                    timestamp: '2020-07-17-01-03-06',
                    uuid: '6f6765f9-0e4f-4949-bd9a-ce72be9dfe30',
                    deliveryStreamVersion: '1'
                });
            });

            it('uses partial attribute names as keys when partial attributeNames are provided', () => {
                expect(strings.tokenize(regexStr, text, [attributeName[0], undefined, attributeName[2]])).toEqual(expect.objectContaining({
                    fhname: 'fhname',
                    deliveryStreamName: 'type'
                }));
            });
        });

        describe('when called with RegExp instance', () => {
            it('defaults to $index of capture group when attributeNames are not provided', () => {
                expect(strings.tokenize(regex, text)).toEqual({
                    $1: 'fhname',
                    $2: '2020/07/17/01',
                    $3: 'type',
                    $4: '1',
                    $5: '2020-07-17-01-03-06',
                    $6: '6f6765f9-0e4f-4949-bd9a-ce72be9dfe30'
                });
            });

            it('uses attribute names as keys when attributeNames are provided', () => {
                expect(strings.tokenize(regex, text, attributeName)).toEqual({
                    deliveryStreamName: 'type',
                    rangeStart: '2020/07/17/01',
                    fhname: 'fhname',
                    timestamp: '2020-07-17-01-03-06',
                    uuid: '6f6765f9-0e4f-4949-bd9a-ce72be9dfe30',
                    deliveryStreamVersion: '1'
                });
            });

            it('uses partial attribute names as keys when partial attributeNames are provided', () => {
                expect(strings.tokenize(regex, text, [attributeName[0], undefined, attributeName[2]])).toEqual(expect.objectContaining({
                    fhname: 'fhname',
                    deliveryStreamName: 'type'
                }));
            });
        });
    });
    describe('template {ops{path expressions}pipes}', () => {
        const ops = [
            // NO OP
            '',
            // INCEPTION
            '..',
            '.1',
            '...',
            '.2',
            '....',
            '.....',
            '.10',
            '.100',
            '.1000',
            // ENUMERATE
            '*',
            // FLATTEN
            '**'
        ];
        const pipes = [
            // NO OP
            '',
            // INCEPTION
            'foo',
            'bar',
            // ENUMERATE
            '*',
            // FLATTEN
            '**'
        ];

        const opCombinations = [
            // INCEPTION
            ['..', {}],
            ['...', {}],
            ['....', {}],
            ['.5', {}],
            ['.10', {}],
            ['.100', {}],
            // INVALID INCEPTION
            ['.1000', {}],
            // ENUMERATION
            ['*', {}],
            []// FLATENNING
            ['**', {}],
            // COMBINATIONS
            ['.. | *', {}],
            ['.1 | *', {}],
            ['.10 | *', {}],
            ['.. | **', {}],
            ['.1 | **', {}],
            ['.10 | **', {}],
            // INVALID COMBINATIONS
            [' * | .. ', {}],
            [' * | .1 ', {}],
            [' ** | .. ', {}],
            [' ** | .1 ', {}],
        ];
        it('captures ops, path and pipes', () => {
            const regex = /{(.*?){(.*?)}(.*?)}/g;
            const text = '{op{x.y.z}pipes}';
            expect(strings.tokenize(regex, text, [], false)).toEqual({
                [text]: [
                    'op',
                    'x.y.z',
                    'pipes'
                ]
            });
        });
        describe('captures all operations respecting allowed order', () => {
            it('#1 captures ops', () => {
                const regex = /{(.*?){(.*?)}(.*?)}/g;
                const text = '{op{x.y.z}pipes}';
                const opregex = /\s*(\.{2,}|\.\d{1,3})?\s*\|?\s*(\*{1,2})?\s*/;
                const opText = strings.tokenize(regex, text)[text][0];
                expect(strings.tokenize(regex, text)).toEqual({
                    $1: 'op',
                    $2: 'x.y.z',
                    $3: 'pipes'
                });
            });
        });
    });
});
