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
        const options = {placeholder: { open: '{{', close: '}}'}};

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
    const text = 'unprocessed/2017/07/17/01/segment-firehose-online-prod-1-2017-07-17-01-03-06-6f6765f9-0e4f-4949-bd9a-ce72be9dfe30';
    const regex = /^(.*?)\/(\d{4}\/\d{2}\/\d{2}\/\d{2})\/(.*)(?=-\d+-\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})-(\d+)-(\d{4}-\d{2}-\d{2}-\d{2}-\d{2}-\d{2})-(.*)$/; //https://regex101.com/r/yQ6Dyn/1
    const regexStr = '^(.*?)\\/(\\d{4}\\/\\d{2}\\/\\d{2}\\/\\d{2})\\/(.*)(?=-\\d+-\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2})-(\\d+)-(\\d{4}-\\d{2}-\\d{2}-\\d{2}-\\d{2}-\\d{2})-(.*)$';
    const attributeName = ['prefix', 'rangeStart', 'deliveryStreamName', 'deliveryStreamVersion', 'timestamp', 'uuid'];
    describe('when called with regex string', () => {
        // NOTE: to get properly escaped regex string, create a regex using /your-regex-here/ then use .source()

        it('defaults to $index of capture group when attributeNames are not provided', () => {
            expect(strings.tokenize(regexStr, text)).toEqual({
                $1: 'unprocessed',
                $2: '2017/07/17/01',
                $3: 'segment-firehose-online-prod',
                $4: '1',
                $5: '2017-07-17-01-03-06',
                $6: '6f6765f9-0e4f-4949-bd9a-ce72be9dfe30'
            });
        });

        it('uses attribute names as keys when attributeNames are provided', () => {
            expect(strings.tokenize(regexStr, text, attributeName)).toEqual({
                deliveryStreamName: 'segment-firehose-online-prod',
                rangeStart: '2017/07/17/01',
                prefix: 'unprocessed',
                timestamp: '2017-07-17-01-03-06',
                uuid: '6f6765f9-0e4f-4949-bd9a-ce72be9dfe30',
                deliveryStreamVersion: '1'
            });
        });

        it('uses partial attribute names as keys when partial attributeNames are provided', () => {
            expect(strings.tokenize(regexStr, text, [attributeName[0], undefined, attributeName[2]])).toEqual(expect.objectContaining({
                prefix: 'unprocessed',
                deliveryStreamName: 'segment-firehose-online-prod'
            }));
        });
    });

    describe('when called with RegExp instance', () => {
        it('defaults to $index of capture group when attributeNames are not provided', () => {
            expect(strings.tokenize(regex, text)).toEqual({
                $1: 'unprocessed',
                $2: '2017/07/17/01',
                $3: 'segment-firehose-online-prod',
                $4: '1',
                $5: '2017-07-17-01-03-06',
                $6: '6f6765f9-0e4f-4949-bd9a-ce72be9dfe30'
            });
        });

        it('uses attribute names as keys when attributeNames are provided', () => {
            expect(strings.tokenize(regex, text, attributeName)).toEqual({
                deliveryStreamName: 'segment-firehose-online-prod',
                rangeStart: '2017/07/17/01',
                prefix: 'unprocessed',
                timestamp: '2017-07-17-01-03-06',
                uuid: '6f6765f9-0e4f-4949-bd9a-ce72be9dfe30',
                deliveryStreamVersion: '1'
            });
        });

        it('uses partial attribute names as keys when partial attributeNames are provided', () => {
            expect(strings.tokenize(regex, text, [attributeName[0], undefined, attributeName[2]])).toEqual(expect.objectContaining({
                prefix: 'unprocessed',
                deliveryStreamName: 'segment-firehose-online-prod'
            }));
        });
    });
});
