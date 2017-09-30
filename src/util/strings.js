const coll = require('../core/collections');

module.exports = {
    isString: coll.isString,
    escapeStringForRegex,
    tokenGenerator,
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
function* tokenGenerator(regex, str, {sequence = false} = {}) {
    regex = new RegExp(regex); // normalize string and regex args, also refresh exhausted regex
    const multi = regex.flags.includes('g');
    let matches = regex.exec(str);
    if (matches === null) return;
    let lastIndex;
    do {
        lastIndex = matches.index;
        const match = matches.shift();
        // yield* matches/*.filter(token => !!token)*/.map(token => ({match, token})); // if we filter out undefined capture groups when the regex matches empty string we shift capture group identifiers!
        if (sequence) { // WARNING: only use to get sequences of matches for interpolation purposes, don't use for strict capture group tokenization, capture group names/indexes might shift up
            yield* matches.map(token => ({match, token}));
        } else {
            yield matches;
        }

    } while (multi && (matches = regex.exec(str)) !== null && (matches.index !== lastIndex)) // avoid infinite loop if the regex (by design) matches empty string, exec would keep on returning the same match over and over
}

function tokenize(regex, str, {tokenNames = [], $n = true, sequence = false} = {}) {
    if (sequence) {
        // interpolation, find all placeholders with the intention of later replacement, a placeholder might repeat, and there is no notion of $1 $2 as specific capture groups
        const tokenIter = coll.iterator(tokenGenerator(regex, str, {sequence}), {indexed: true});
        return coll.reduce((acc, [{match, token}, index]) => {
            if (token == null) return acc;
            const key = tokenNames[index] || ($n ? `$${index + 1}` : match);
            acc[key] = acc[key] ? [...acc[key], token] : $n ? token : [token];
            return acc;
        }, () => ({}), tokenIter);
    } else {
        // capture group oriented tokenization
        const tokenIter = coll.iterator(tokenGenerator(regex, str));
        return coll.reduce((acc, matches) => {
            for (const [index, token] of matches.entries()) {
                if (token == null) continue;
                const key = tokenNames[index] || `$${index + 1}`;
                acc[key] = token;
            }
            return acc;
        }, () => ({}), tokenIter);
    }
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

// function isString(value) {
//     return (typeof value === 'string' || value instanceof String);
// }
