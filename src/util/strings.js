const coll = require('../core/collections');

module.exports = {
    isString,
    escapeStringForRegex,
    tokenize,
    lazyTemplateTag,
    templatePlaceholders,
    lazyTemplate
};

function escapeStringForRegex(str) {
    const matchOperatorsRe = /[|\\{}()[\]^$+*?.]/g;
    if (typeof str !== 'string') {
        throw new TypeError(`Expected a string, received ${typeof str}`);
    }

    return str.replace(matchOperatorsRe, '\\$&');
}

function _tokenize(regex, str, tokenNames = [], $n = true) {
    regex = regex instanceof RegExp ? regex : new RegExp(regex);
    let result = {};
    let matches;
    while ((matches = regex.exec(str)) !== null) {
        const match = matches.shift();
        matches.reduce((acc, captureGroup, index) => {
            acc[tokenNames[index] || ($n ? `$${index + 1}` : match)] = captureGroup;
            return acc;
        }, result);
    }
    return result;
}

/**
 * When tokenizing there are two levels of capture groups matching
 * /g matches on the outside and list of capture groups on the inside
 * example: /{{(.*?)}} \/ {{(.*?)}}/g.exec('{{x.y}} / {{y.z}} - {{x.y}} / {{y.z}}')
 * @param strings
 * @param keys
 * @returns {function(...[*])}
 */
function* tokenGenerator(regex, str) {
    regex = new RegExp(regex); // normalize string and regex args, also refresh exhausted regex
    const multi = regex.flags.includes('g');
    let matches = regex.exec(str);;
    if (matches === null) return;
    do {
        const match = matches.shift();
        yield* matches.map(token => ({match, token}));
    } while (multi && (matches = regex.exec(str)) !== null)
}

function tokenize(regex, str, tokenNames = [], $n = true) {
    const tokenIter = coll.iterator(tokenGenerator(regex, str), {indexed: true});
    return coll.reduce((acc, [{match, token}, index]) => {
        const key = tokenNames[index] || ($n ? `$${index + 1}` : match);
        acc[key] = acc[key] ? [...acc[key], token] : $n ? token : [token];
        return acc;
    }, () => ({}), tokenIter);
}


function lazyTemplateTag(strings, ...keys) {
    return (...values) => {
        const dict = values[values.length - 1] || {};
        const result = [strings[0]];
        keys.forEach((key, i) => {
            const value = Number.isInteger(key) ? values[key] : dict[key];
            result.push(value, strings[i + 1]);
        });
        return result.join('');
    };
}

function templatePlaceholders(template, {placeholder: { open = '${', close = '}'} = {}} = {}) {
    // const regex = /\${['"]?(.*?)['"]?}/g;
    const open_ = escapeStringForRegex(open);
    const _close = escapeStringForRegex(close);

    const regex = new RegExp(`${open_}['"]?(.*?)['"]?${_close}`, 'g');
    let matches;
    const mapping = {};
    // exec returns a single match, to get all matches you have to loop
    while ((matches = regex.exec(template)) !== null) {
        mapping[matches[1]] = matches[0];
    }
    if (!Object.keys(mapping).length) throw new Error(`Template has no parameters matching ${regex.source}`);
    return mapping;
}

function lazyTemplate(template, options) {
    const mapping = templatePlaceholders(template, options);
    return (parameters) => {
        for (const key in parameters) {
            if (mapping[key]) {
                const keyRegex = new RegExp(escapeStringForRegex(mapping[key]), 'g');
                template = template.replace(keyRegex, parameters[key]);
            }
        }
        return template;
    };
}

function isString(value) {
    return (typeof value === 'string' || value instanceof String);
}
