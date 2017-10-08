const traverse = require('traverse');
const jp = require('jsonpath');

const F = require('./core/functional-pipelines');
const sx = require('./util/strings');

const regex = {
    safeDot: /\.(?![\w\.]+")/,
    memberOrDescendant: /^[\[\.]/
};

const builtinPipes = {
    '*': F.flatten,
    '**': F.iterator // {indexed: true, kv: true, metadata = () => path}
};

const placeholder = {
    full: /{([^{]*?)?{(.*?)}([^}]*)?}/g,
    operators: /\s*(\.{2,}|\.\d{1,3})?\s*\|?\s*(\*{1,2})?\s*\|?\s*(:|#\w+)?\s*\|?\s*([!|\?](?:=\w+(?:\s*\:\s*["]?[a-zA-Z0-9_\s-]*["]?)*)?)?\s*\|?\s*(\+\d*)?\s*/g, // https://regex101.com/r/dMUYpQ/12
    operatorNames: ['inception', 'enumerate', 'symbol', 'constraints', 'query'],
    pipes: /(?:\s*\|\s*)((?:\w+|\*{1,2})(?:\s*\:\s*[a-zA-Z0-9_-]*)*)/g // https://regex101.com/r/n2qnj7/4/
};

const rejectPlaceHolder = {open: '{>>{', close: '}<<}'};

const builtins = {
    defaultTo: (defaultValue, value) => F.isEmptyValue(value) ? defaultValue : value,
    flatten: F.flatten
};


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
        operators['@meta']++;
        ast.operators = operators;
    }

    if (pipes) {
        pipes = sx.tokenize(placeholder.pipes, pipes, {sequence: true});
        pipes['@meta']++;
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

const jpify = path => path.startsWith('$') ? path : regex.memberOrDescendant.test(path) ? `$${path}` : `$.${path}`;

const deref = sources => (ast, {meta = 1} = {}) => {
    // if(F.isReduced(ast)) return F.unreduced(ast);
    const values = jp.query(sources['original'], jpify(ast.path));
    return {...ast, value: values};
};


function renderStringNode(node, {meta = 0, sources = {defaults: {}}} = {}) {
    const refList = rephs(node);
    const derefedList = F.map(F.compose(deref(sources)), refList);
    const rendered = renderString(node, derefedList);
    return rendered;
}

const renderObjectNode = F.identity;

const transform = (template, {meta = 0, sources = {defaults: {}}} = {}) => document => {
    let counter = 1;
    let result;

    if (F.isString(template)) {
        result = renderStringNode(template, {meta, sources: {...sources, original: document}});
    } else {
        result = traverse(template).map(function (node) {
            console.log('traverse :: ', counter++, this.path);

            if (F.isFunction(node)) {
                this.update(node(document)); // R.applySpec style, discouraged since it is not declarative or serializable
            } else if (F.isString(node)) {
                this.update(renderStringNode(node, {meta, sources: {...sources, original: document}}));
            } else if (F.isArray(node)) {
                // this.update(renderArrayNode(node, deref));
            } else {
                // this.update(renderObjectNode(node, deref));
            }
        });
    }
    return result;
};

module.exports = {
    transform,
    rephs,
};
