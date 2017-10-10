const traverse = require('traverse');
const jp = require('jsonpath');

const F = require('./core/functional-pipelines');
const sx = require('./util/strings');
const operators = require('./core/operators');

const placeholder = {
    full: /{([^{]*?)?{(.*?)}([^}]*)?}/g,
    // allowing for all valid jsonpath characters in #<tag>, making the path valid is currently the user responsibility, e.g. #x.y["z w"]["v.q"], standalone # uses path from context
    operators: /\s*(\.{2,}|\.\d{1,3})?\s*\|?\s*(\*{1,2})?\s*\|?\s*(:|#[a-zA-Z0-9_\-\$\.\[\]"\s]*)?\s*\|?\s*([!|\?](?:[=|~]\w+(?:\s*\:\s*["]?[a-zA-Z0-9_\s\-\$]*["]?)*)?)?\s*\|?\s*(\+\d*)?\s*/g, // https://regex101.com/r/dMUYpQ/17
    operatorNames: ['inception', 'enumerate', 'symbol', 'constraints', 'query'],
    pipes: /(?:\s*\|\s*)((?:[a-zA-Z0-9_\-\$]+|\*{1,2})(?:\s*\:\s*[a-zA-Z0-9_\s-\$]*)*)/g // https://regex101.com/r/n2qnj7/5
};

const rejectPlaceHolder = {open: '{>>{', close: '}<<}'};

/**
 * regex place holder, a.k.a reph parser
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
    let ast = {source, value: null, '@meta': meta};

    if (F.isEmptyValue(path)) {
        ast.value = source;
        return F.reduced(ast);
    }

    ast['@meta']++;

    if (operators) {
        operators = sx.tokenize(placeholder.operators, operators, {tokenNames: placeholder.operatorNames});
        operators['@meta'] = ++ast['@meta'];
        ast.operators = operators;
    }

    if (pipes) {
        pipes = sx.tokenize(placeholder.pipes, pipes, {sequence: true});
        pipes['@meta'] = ++ast['@meta'];
        ast.pipes = pipes;
    }
    return {...ast, path};
};

const rephs = (text, meta = 0) => {
    let ast = {source: text, value: null, '@meta': meta};
    const regex = new RegExp(placeholder.full.source, 'g');
    const matches = sx.tokenize(regex, text, {$n: false, sequence: true, cgindex: true, cgi0: true});

    if (F.isEmptyValue(matches)) {
        ast.value = text;
        return F.reduced(ast);
    }

    return F.map(F.which(reph), F.iterator(matches, {indexed: true, kv: true}));
};

function renderString(node, derefedList) {
    let rendered;
    if (derefedList.length === 1 && derefedList[0].source === node) {
        rendered = derefedList[0].value; // stand alone '{{path}}' expands to value, without toString conversion
    } else {
        const replace = (acc, {source, value}) => acc.replace(new RegExp(sx.escapeStringForRegex(source), 'g'), value !== undefined ? value : '');
        rendered = F.reduce(replace, () => node, derefedList);
    }
    return rendered;
}

function renderStringNode(contextRef, {meta = 0, sources = {'default': {}}, tags = {}} = {}) {
    const refList = rephs(contextRef.node);
    if (F.isReduced(refList)) {
        return F.unreduced(contextRef.node);
    }

    const derefedList = F.map(operators.applyAll({meta, sources, tags, context: contextRef}), refList);
    const rendered = renderString(contextRef.node, derefedList);
    return rendered;
}

const renderObjectNode = F.identity;

const transform = (template, {meta = 0, sources = {'default': {}}, tags = {}} = {}) => document => {
    let counter = 1;
    let result;

    if (F.isString(template)) {
        result = renderStringNode(template, {meta, sources: {...sources, origin: document}});
    } else {
        result = traverse(template).map(function (node) {
            console.log('traverse :: ', counter++, this.path);
            const contextRef = this;
            let rendered;

            if (F.isFunction(node)) {
                rendered = node(document); // R.applySpec style, discouraged since it is not declarative or serializable
            } else if (F.isString(node)) {
                rendered = renderStringNode(contextRef, {meta, sources: {...sources, origin: document}, tags});
            } else if (F.isArray(node)) {
                // rendered = renderArrayNode(node, deref);
                rendered = node;
            } else {
                // rendered = renderObjectNode(node, deref);
                rendered = node;
            }

            if (this.isRoot) return;

            if (rendered === undefined) {
                this.remove(true); // JSON doesn't eat undefined, drop the key and stop traversing this subtree
            } else {
                this.update(rendered);
            }
        });
    }
    return result;
};

module.exports = {
    transform,
    rephs,
};
