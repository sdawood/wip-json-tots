const traverse = require('traverse');
const jp = require('jsonpath');

const coll = require('./core/collections');
const sx = require('./util/strings');

const regex = {
    safeDot: /\.(?![\w\.]+")/,
    memberOrDescendant: /^[\[\.]/
};

const operator = {
    inception: [/\.{2,}/, /\.\d{1,3}/],
    enumerate: [/\*{1,2}/],
    symbol: [/:/, /#\w+/],
    query: /\+/,
};

const builtinPipes = {
    '*': coll.flatten,
    '**': coll.iterator // {indexed: true, kv: true, metadata = () => path}
};

const placeholder = {
    full: /{([^{]*?)?{(.*?)}([^}]*)?}/g,
    operators: /\s*(\.{2,}|\.\d{1,3})?\s*\|?\s*(\*{1,2})?\s*\|?\s*(:|#\w+)?\s*\|?\s*(\+)?\s*/g, // https://regex101.com/r/dMUYpQ/7
    operatorNames: ['inception', 'enumerate', 'symbol', 'query'],
    pipes: /(?:\s*\|\s*)((?:\w+|\*{1,2})(?:\s*\:\s*[a-zA-Z0-9_-]*)*)/g // https://regex101.com/r/n2qnj7/4/
};

const rejectPlaceHolder = {open: '{>>{', close: '}<<}'};

/**
 * regex place holder, a.k.a reph tokenizer
 *
 * NOTE: the source placeholder can be repeated within the template-string, e.g. "{{x.y}} = {{x.y}}"
 * reph() would consume one only, effectively optimizing by removing the need to deref twice within the same scope
 * later when the dereffed value is replaced in the string, a //g regex is used and would cover all identical occurrences
 *
 * @param source
 * @param operators
 * @param path
 * @param pipes
 * @param meta
 * @returns {*}
 */
const reph = ([source, [[operators] = [], [path] = [], [pipes] = []] = []] = [], meta = 0) => {
    let ast = {source, value: null, reduced: false, '@meta': meta};

    if (coll.isEmptyValue(path)) {
        ast.value = source;
        ast.reduced = true;
        return ast;
    }

    ast['@meta'] = 1;

    if (operators) {
        operators = sx.tokenize(placeholder.operators, operators, {tokenNames: placeholder.operatorNames});
        operators['@meta'] = 2;
        ast.operators = operators;
    }

    if (pipes) {
        pipes = sx.tokenize(placeholder.pipes, pipes, {sequence: true});
        pipes['@meta'] = 3;
        ast.pipes = pipes;
    }
    return {...ast, path};
};

const rephs = (text, meta = 0) => {
    let ast = {source: text, value: null, reduced: false, '@meta': meta};
    const regex = new RegExp(placeholder.full.source, 'g');
    const matches = sx.tokenize(regex, text, {$n: false, sequence: true, cgindex: true, cgi0: true});

    if (coll.isEmptyValue(matches)) {
        ast.value = text;
        ast.reduced = true;
        return ast;
    }

    return coll.map(coll.which(reph), coll.iterator(matches, {indexed: true, kv: true}));
};

const builtins = {
    defaultTo: (defaultValue, value) => coll.isEmptyValue(value) ? defaultValue : value,
    flatten: coll.flatten
};

const jpify = path => path.startsWith('$') ? path : regex.memberOrDescendant.test(path) ? `$${path}` : `$.${path}`;

// meta-0 template transform :: document -> path -> value
/**
 * NOTE: data first as an exception allows for scoping the deref function into a nested scope by pre-evaluating with a scope-document
 * @param document
 */

const derefFrom = document => (ref, rph = rejectPlaceHolder) => {
    const noOp = '';
    let [key, [op, path, pipes]] = ref; // multiple uses of the placeholder regex within the same string returns the path multiple times, e.g. "({{x.y}})[{{x.y}}]"
    path = path.startsWith('$') ? path : /*path.startsWith(':') ? @HERE : */ jpify(path);
    let value = jp.query(document, path);
    value = op === operator.plus ? value : value.pop();
    value = coll.isEmptyValue(value) ? `${rph.open}${path}${rph.close}` : value;
    return [key, value];
};

function renderString(node, phValuePairs) {
    let rendered;
    if (phValuePairs.length === 1 && phValuePairs[0][0] === node) {
        rendered = phValuePairs[0][1]; // stand alone '{{path}}' expands to value, without toString conversion
    } else {
        const replace = (acc, [ph, value]) => acc.replace(new RegExp(sx.escapeStringForRegex(ph), 'g'), value);
        rendered = coll.reduce(replace, () => node, phValuePairs);
    }
    return rendered;
}

function XexpandStringNode(node) {
    const refs = sx.tokenize(reph(), node, [], false);
    let rendered;
    if (coll.isEmptyValue(refs)) {
        rendered = node; // string literal with no placeholders
    } else {
        const derefedPairs = coll.map(coll.which(deref), coll.iterator(refs, {indexed: true, kv: true}));
        rendered = renderString(node, derefedPairs);
    }
    return rendered;
}

function renderStringNode(node, deref) {
    const refs = sx.tokenize(reph(), node, [], false);
    let rendered;
    if (coll.isEmptyValue(refs)) {
        rendered = node; // string literal with no placeholders
    } else {
        const derefedPairs = coll.map(coll.which(deref), coll.iterator(refs, {indexed: true, kv: true}));
        rendered = renderString(node, derefedPairs);
    }
    return rendered;
}

const XhasSpreadOperator = element => {
    if (coll.isString(element)) {renderStringNode
        const refs = sx.tokenize(reph(), element, [], false);
        if (coll.isEmptyValue(refs)) {
            return false;
        } else {
            let [[key, [op, path, pipes]]] = coll.iterator(refs, {indexed: true, kv: true});
            return operator.spread.test(op);
        }
    } else {
        return false;
    }
};

const XforEach = (iter, deref) => {
    const [spreadableNode] = iter;
    const enumerable = renderStringNode(spreadableNode, deref);
    // TODO: consider safe spread operator `{..?{` or `{.5?{`, similar to angular safe access .?
    if (coll.isContainer(enumerable)) {
        const [childTemplate] = iter;
        const iterator = coll.iterator(enumerable, {indexed: true}); // ...values for arrays, ...[value, key]* for objects
        return coll.map(child => transform(childTemplate, child), enumerable);
    } else {
        return enumerable;
    }

};

function XrenderArrayNode(node, deref) {
    // TODO: we need to know how many items ahead the .n or .... operator wants to consume to set the sticky value, CHICKEN & EGG problem???
    // TODO: we need the partitionBy function to be able to communicate to memorizeWhen decorator, how?
    const sticky2 = coll.sticky(2, {when: coll.always(true), recharge: true});
    const partitionedGen = coll.partitionBy(sticky2(hasSpreadOperator), node);
    const lols = coll.map(
        iter => iter.metadata() ? forEach(iter, deref) : coll.map(coll.identity, iter),
        partitionedGen
    );
    return coll.reduce(coll.cat(), () => [], lols);
}

const renderObjectNode = coll.identity;

function transform(template, document, meta = 0) {
    let counter = 1;
    const deref = derefFrom(document);
    let result;

    if (coll.isString(template)) {
        result = renderStringNode(template, deref)
    } else {
        result = traverse(template).map(function (node) {
            console.log('traverse :: ', counter++, this.path);

            if (coll.isFunction(node)) {
                this.update(node(document)); // R.applySpec style, discouraged since it is not declarative or serializable
            } else if (coll.isString(node)) {
                this.update((node, deref));
            } else if (coll.isArray(node)) {
                this.update(renderArrayNode(node, deref));
            } else {
                this.update(renderObjectNode(node, deref));
            }
        });
    }
    return result;
}

module.exports = {
    transform,
    rephs,
};
