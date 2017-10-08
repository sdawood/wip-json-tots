const traverse = require('traverse');
const jp = require('jsonpath');

const F = require('./core/functional-pipelines');
const sx = require('./util/strings');

const regex = {
    safeDot: /\.(?![\w\.]+")/,
    memberOrDescendant: /^[\[\.]/
};

const operator = {
    plus: '+',
    flatten: '*',
    spread: /../,
    spreadN: /\.\d+/
};

const placeholder = {
    // https://regex101.com/r/dMUYpQ/1
    // "{" oneOrMoare | expand(n) = [.... | .n ] "{" path "}" pipe(...fns) | spread "}"
    open: '{\\s*(\\+?|\\.{2,}?|\\.\\d+?)\\s*{',
    close: '}\\s*((\\*|\\|\\s*\\w+\\s*)*)\\s*}'
};
const rejectPlaceHolder = {open: '{>>{', close: '}<<}'};
const reph = (ph = placeholder) => new RegExp(`${ph.open}(.*?)${ph.close}`, 'g'); // regex place holder, a.k.a reph

const builtins = {
    defaultTo: (defaultValue, value) => F.isEmptyValue(value) ? defaultValue : value,
    flatten: F.flatten
};

const jpify = path => path.startsWith('$') ? path : regex.memberOrDescendant.test(path) ? `$${path}` : `$.${path}`;

const derefFrom = document => (ref, rph = rejectPlaceHolder) => {
    const noOp = '';
    let [key, [op, path, pipes]] = ref; // multiple uses of the placeholder regex within the same string returns the path multiple times, e.g. "({{x.y}})[{{x.y}}]"
    path = path.startsWith('$') ? path : /*path.startsWith(':') ? @HERE : */ jpify(path);
    let value = jp.query(document, path);
    value = op === operator.plus ? value : value.pop();
    value = F.isEmptyValue(value) ? `${rph.open}${path}${rph.close}` : value;
    return [key, value];
};

function renderString(node, phValuePairs) {
    let rendered;
    if (phValuePairs.length === 1 && phValuePairs[0][0] === node) {
        rendered = phValuePairs[0][1]; // stand alone '{{path}}' expands to value, without toString conversion
    } else {
        const replace = (acc, [ph, value]) => acc.replace(new RegExp(sx.escapeStringForRegex(ph), 'g'), value);
        rendered = F.reduce(replace, () => node, phValuePairs);
    }
    return rendered;
}

function expandStringNode(node) {
    const refs = sx.tokenize(reph(), node, [], false);
    let rendered;
    if (F.isEmptyValue(refs)) {
        rendered = node; // string literal with no placeholders
    } else {
        const derefedPairs = F.map(F.which(deref), F.iterator(refs, {indexed: true, kv: true}));
        rendered = renderString(node, derefedPairs);
    }
    return rendered;
}

function renderStringNode(node, deref) {
    const refs = sx.tokenize(reph(), node, [], false);
    let rendered;
    if (F.isEmptyValue(refs)) {
        rendered = node; // string literal with no placeholders
    } else {
        const derefedPairs = F.map(F.which(deref), F.iterator(refs, {indexed: true, kv: true}));
        rendered = renderString(node, derefedPairs);
    }
    return rendered;
}

const hasSpreadOperator = element => {
    if (F.isString(element)) {
        const refs = sx.tokenize(reph(), element, [], false);
        if (F.isEmptyValue(refs)) {
            return false;
        } else {
            let [[key, [op, path, pipes]]] = F.iterator(refs, {indexed: true, kv: true});
            return operator.spread.test(op);
        }
    } else {
        return false;
    }
};

const forEach = (iter, deref) => {
    const [spreadableNode] = iter;
    const enumerable = renderStringNode(spreadableNode, deref);
    // TODO: consider safe spread operator `{..?{` or `{.5?{`, similar to angular safe access .?
    if (F.isContainer(enumerable)) {
        const [childTemplate] = iter;
        const iterator = F.iterator(enumerable, {indexed: true}); // ...values for arrays, ...[value, key]* for objects
        return F.map(child => transform(childTemplate, child), enumerable);
    } else {
        return enumerable;
    }

};

function renderArrayNode(node, deref) {
    // TODO: we need to know how many items ahead the .n or .... operator wants to consume to set the sticky value, CHICKEN & EGG problem???
    // TODO: we need the partitionBy function to be able to communicate to memorizeWhen decorator, how?
    const sticky2 = F.sticky(2, {when: F.always(true), recharge: true});
    const partitionedGen = F.partitionBy(sticky2(hasSpreadOperator), node);
    const lols = F.map(
        iter => iter.metadata() ? forEach(iter, deref) : F.map(F.identity, iter),
        partitionedGen
    );
    return F.reduce(F.cat(), () => [], lols);
}

const renderObjectNode = F.identity;

function transform(template, document) {
    let counter = 1;
    const deref = derefFrom(document);
    let result;

    if (F.isString(template)) {
        result = renderStringNode(template, deref)
    } else {
        result = traverse(template).map(function (node) {
            console.log('traverse :: ', counter++, this.path);

            if (F.isFunction(node)) {
                this.update(node(document)); // R.applySpec style, discouraged since it is not declarative or serializable
            } else if (F.isString(node)) {
                this.update(renderStringNode(node, deref));
            } else if (F.isArray(node)) {
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
