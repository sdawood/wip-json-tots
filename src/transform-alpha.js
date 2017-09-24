const traverse = require('traverse');
const jp = require('jsonpath');

const coll = require('./core/collections');
const sx = require('./util/strings');

const regex = {
    safeDot: /\.(?![\w\.]+")/
};

const builtins = {
    defaultTo: (defaultValue, value) => coll.isEmptyValue(value) ? defaultValue : value
};

const placeholder = {open: '{{', close: '}}'};
const rejectPlaceHolder = {open: '{>>{', close: '}<<}'};
const reph = (ph = placeholder) => new RegExp(`${ph.open}(.*?)${ph.close}`, 'g'); // regex place holder, a.k.a reph

/**
 * deref loose path using jsonpath
 *
 * while it allows users to use {{a."x.y.z".name}} for invalid identifier keys instad of {{a["x.y.z"].name}}
 * it sacrifices the elegance of {{a.b[0].c}} and have to use {{a.b.0.c}} which stringifies to '$a.b["0"].c' but arrays don't mind string (numerical) indexes!
 *
 * alternatively, users would have to use jsonpath syntax, although prefixing with '$.' doesn't work for '["x"].y' but works for 'x.y' and will have to be handled
 * NOTE: we iterate with indexed = true over the refs object, hence we receive [value, key] not [key, value]
 * @param document
 */
const deref = document => (ref, ph = rejectPlaceHolder) => {
    let [key, [path]] = ref; // multiple uses of the placeholder regex within the same string returns the path multiple times, e.g. "({{x.y}})[{{x.y}}]"
    const parts = coll
        .reduce(
            coll.mapcat(s => s.split(regex.safeDot))(/*reducingFn*/),
            () => [],
            path.split(regex.safeDot))
        .map(s => s.replace(/"/g, ''));
    path = jp.stringify(parts);
    let value = jp.value(document, path);
    value = value === undefined ? `${ph.open}${path}${ph.close}` : value;
    return [key, value];
}

function transform(template, document, context = {}) {
    let counter = 1;
    const derefPath = deref(document);
    const result = traverse(template).map(function (node) {
        console.log(counter++, this.path);
        const {path, parent, key} = this;
        // console.log(`[${counter++}] : ${JSON.stringify(this.path, null, 0)}`);

        if (coll.isFunction(node)) {
            this.update(node(document)); // R.applySpec style
        } else if(coll.isArray(node)) {
            this.update(node)
        } else if(coll.isString(node)) {
            const refs = sx.tokenize(reph(), node, [], false);
            if (coll.isEmptyValue(refs)) {
                this.update(node);
            } else {
                const derefed = coll.mapUpdate(derefPath, coll.iterator(refs, {indexed: true, kv: true}));
                const replace = (acc, [ph, value]) => acc.replace(new RegExp(ph, 'g'), value);
                const rendered = coll.reduce(replace, () => node, coll.iterator(derefed, {indexed: true, kv: true}));
                this.update(rendered);
            }
        } else {
            this.update(node);
        }
    });
    return result;
}

module.exports = {
    transform
};
