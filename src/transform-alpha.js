const traverse = require('traverse');
const jp = require('jsonpath');

const coll = require('./core/collections');
const sx = require('./util/strings');

const regex = {
    safeDot: /\.(?![\w\.]+")/
};

const operator = {
    oneOrMore: '*',
    spread: '...'
};

const placeholder = {open: '{(\\*?|\\.{3}?){', close: '}}'};
const rejectPlaceHolder = {open: '{>>{', close: '}<<}'};
const reph = (ph = placeholder) => new RegExp(`${ph.open}(.*?)${ph.close}`, 'g'); // regex place holder, a.k.a reph

const builtins = {
    defaultTo: (defaultValue, value) => coll.isEmptyValue(value) ? defaultValue : value
};


/**
 * deref loose path using jsonpath
 *
 * while it allows users to use {{a."x.y.z".name}} for invalid identifier keys instad of {{a["x.y.z"].name}}
 * it sacrifices the elegance of {{a.b[0].c}} and have to use {{a.b.0.c}} which stringifies to '$a.b["0"].c' but arrays don't mind string (numerical) indexes!
 * examples:
 * - productReview.fiveStar.0.comment
 * - "Safety.Warning.On.Root"
 * - tags."tag-name-with-dash".author
 * @param document
 */
// const derefSimple = document => (ref, rph = rejectPlaceHolder) => {
//     let [key, [__, path]] = ref; // multiple uses of the placeholder regex within the same string returns the path multiple times, e.g. "({{x.y}})[{{x.y}}]"
//     const parts = coll
//         .reduce(
//             coll.mapcat(s => s.split(regex.safeDot))(/*reducingFn*/),
//             () => [],
//             path.split(regex.safeDot))
//         .map(s => s.replace(/"/g, ''));
//     path = jp.stringify(parts);
//     let value = jp.value(document, path);
//     value = value === undefined ? `${rph.open}${path}${rph.close}` : value;
//     return [key, value];
// };

const derefFrom = document => (ref, rph = rejectPlaceHolder) => {
    const noOp = '';
    let [key, [op, path]] = ref; // multiple uses of the placeholder regex within the same string returns the path multiple times, e.g. "({{x.y}})[{{x.y}}]"
    const memberOrDescendant = /^[\[\.]/;
    path = path.startsWith('$') ? path : memberOrDescendant.test(path) ? `$${path}` : `$.${path}`;
    let value = jp.query(document, path);
    value = op === operator.oneOrMore ? value : value.pop();
    value = coll.isEmptyValue(value) ? `${rph.open}${path}${rph.close}` : value;
    return [key, value];
};

// const deref = {simple: derefSimple, js: derefJP, jsonpath: derefJP};

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
        const derefedPairs = coll.map(deref, coll.iterator(refs, {indexed: true, kv: true}));
        console.log('derefedPairs', JSON.stringify(derefedPairs, null, 0));
        console.log('node', node);
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
            let [[key, [op, path]]] = coll.iterator(refs, {indexed: true, kv: true});
            console.log('>>>>>>>>>>>>>>>>>>>', key, {op}, path);
            return op === operator.spread;
        }
    } else {
        return false;
    }
}

const spreadMap = (iter, deref) => {
    const [spreadableNode] = iter;
    const enumerable = renderStringNode(spreadableNode, deref);
    // should we verify that the derefed value is spread(able) with ...?
    // TODO: consider safe spread operator `{...?{`, similar to angular safe access .?
    if (coll.isContainer(enumerable)) {
        const [childTemplate] = iter;
        const iterator = coll.iterator(enumerable, {indexed: true}); // ...values for arrays, ...[value, key]* for objects
        return coll.map(child => transform(childTemplate, child), enumerable);
    } else {
        return enumerable;
    }

};

function renderArrayNode(node, deref) {

    // const hasSpreadOperator = element => {
    //     if (coll.isString(element)) {
    //         const refs = sx.tokenize(reph(), element, [], false);
    //         if (coll.isEmptyValue(refs)) {
    //             return false;
    //         } else {
    //             let [[key, [op, path]]] = coll.iterator(refs, {indexed: true, kv: true});
    //             console.log('>>>>>>>>>>>>>>>>>>>', key, {op}, path);
    //             return op === operator.spread;
    //         }
    //     } else {
    //         return false;
    //     }
    // }
    //
    // const spreadMap = iter => {
    //     const [spreadableNode] = iter;
    //     const enumerable = renderStringNode(spreadableNode, deref);
    //     // should we verify that the derefed value is spread(able) with ...?
    //     // TODO: consider safe spread operator `{...?{`, similar to angular safe access .?
    //     if (coll.isContainer(enumerable)) {
    //         const [childTemplate] = iter;
    //         const iterator = coll.iterator(enumerable, {indexed: true}); // ...values for arrays, ...[value, key]* for objects
    //         return coll.map(child => transform(childTemplate, child), enumerable);
    //     } else {
    //         return enumerable;
    //     }
    //
    // };

    const sticky2 = coll.sticky(2, {when: coll.always(true), recharge: true}); // return true
    const partitionedGen = coll.partitionBy(sticky2(hasSpreadOperator), node);
    const lols = coll.map(iter => iter.metadata() ? spreadMap(iter, deref) : coll.map(coll.identity, iter), partitionedGen);
    return coll.reduce(coll.cat(), () => [], lols);
}

const renderObjectNode = coll.identity;

function transform(template, document, {style = 'jsonpath'} = {}) {
    let counter = 1;
    const deref = derefFrom(document);

    const result = traverse(template).map(function (node) {
        console.log(counter++, this.path);
        const {path, parent, key} = this;
        // console.log(`[${counter++}] : ${JSON.stringify(this.path, null, 0)}`);

        if (coll.isFunction(node)) {
            this.update(node(document)); // R.applySpec style, discouraged since it is not declarative or serializable
        } else if (coll.isArray(node)) {
            this.update(renderArrayNode(node, deref));
        } else if (coll.isString(node)) {
            this.update(renderStringNode(node, deref));
        } else {
            this.update(renderObjectNode(node, deref));
        }
    });

    return result;
}

module.exports = {
    transform
};
