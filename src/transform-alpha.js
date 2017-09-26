const traverse = require('traverse');
const jp = require('jsonpath');

const coll = require('./core/collections');
const sx = require('./util/strings');

const regex = {
    safeDot: /\.(?![\w\.]+")/
};

const operator = {
    oneOrMore: '*',
    flatten: '*',
    spread: /../,
    spreadN: /\.\d+/
};

const placeholder = {
    // https://regex101.com/r/dMUYpQ/1
    open: '{\\s*(\\*?|\\.{2,}?|\\.\\d+?)\\s*{',
    close: '}\\s*((\\*|\\|\\s*\\w+\\s*)*)\\s*}'
};
const rejectPlaceHolder = {open: '{>>{', close: '}<<}'};
const reph = (ph = placeholder) => new RegExp(`${ph.open}(.*?)${ph.close}`, 'g'); // regex place holder, a.k.a reph

const builtins = {
    defaultTo: (defaultValue, value) => coll.isEmptyValue(value) ? defaultValue : value,
    flatten: coll.flatten
};

const derefFrom = document => (ref, rph = rejectPlaceHolder) => {
    const noOp = '';
    let [key, [op, path, pipes]] = ref; // multiple uses of the placeholder regex within the same string returns the path multiple times, e.g. "({{x.y}})[{{x.y}}]"
    const memberOrDescendant = /^[\[\.]/;
    path = path.startsWith('$') ? path : memberOrDescendant.test(path) ? `$${path}` : `$.${path}`;
    let value = jp.query(document, path);
    value = op === operator.oneOrMore ? value : value.pop();
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

const hasSpreadOperator = element => {
    if (coll.isString(element)) {
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

const spreadMap = (iter, deref) => {
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

function renderArrayNode(node, deref) {
    // TODO: we need to know how many items ahead the .n or .... operator wants to consume to set the sticky value, CHICKEN & EGG problem???
    // TODO: we need the partitionBy function to be able to communicate to memorizeWhen decorator, how?
    const sticky2 = coll.sticky(2, {when: coll.always(true), recharge: true});
    const partitionedGen = coll.partitionBy(sticky2(hasSpreadOperator), node);
    const lols = coll.map(
        iter => iter.metadata() ? spreadMap(iter, deref) : coll.map(coll.identity, iter),
        partitionedGen
    );
    return coll.reduce(coll.cat(), () => [], lols);
}

const renderObjectNode = coll.identity;

function transform(template, document) {
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
                this.update(renderStringNode(node, deref));
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
    transform
};
