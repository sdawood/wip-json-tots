const traverse = require('traverse');

const coll = require('./core/collections');

const builtins = {
    defaultTo: (defaultValue, value) => coll.isEmptyValue(value) ? defaultValue : value
};

function transform(template, document, context = {}) {
    let counter = 1;
    const result = traverse(template).map(function (node) {
        const {path, parent, key} = this;
        // console.log(`[${counter++}] : ${JSON.stringify(this.path, null, 0)}`);

        if (coll.isFunction(node)) {
            this.update(node(document)); // R.applySpec style
        } else {
            this.update(node);
        }
    });
    return result;
}

module.exports = {
    transform
};
