const traverse = require('traverse');
const jp = require('jsonpath');

const defaultConfig = require('./config.json');
const F = require('./core/functional-pipelines');
const sx = require('./util/strings');
const bins = require('./core/builtins');
const operators = require('./core/operators');

const placeholder = {
    full: /{([^{]*?)?{(.*?)}([^}]*)?}/g,
    // allowing for all valid jsonpath characters in #<tag>, making the path valid is currently the user responsibility, e.g. #x.y["z w"]["v.q"], standalone # uses path from context
    operators: /\s*(\.{2,}|\.\d{1,3})?\s*\|?\s*(\*{1,2})?\s*\|?\s*(:|#[a-zA-Z0-9_\-\$\.\[\]"\s]*)?\s*\|?\s*([!|\?](?:=?\w+(?:\s*\:\s*["]?[a-zA-Z0-9_\s\-\$]*["]?)*)?)?\s*\|?\s*(\+\d*)?\s*/g, // https://regex101.com/r/dMUYpQ/17
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

function renderStringNode(contextRef, {meta = 0, sources = {'default': {}}, tags = {}, tagHandlers = {}, config} = {}) {
    const refList = rephs(contextRef.node);
    if (F.isReduced(refList)) {
        return {rendered: F.unreduced(refList).value};
    }

    const derefedList = F.map(operators.applyAll({meta, sources, tags, tagHandlers, context: contextRef, config}), refList);
    const rendered = renderString(contextRef.node, derefedList);
    return {rendered, asts: derefedList};
}

/**
 * Similar to lens composition left to right [{...{a}}, {{b}}, {{c}}]
 * Where a is derefed from @origin, b is derefed from @a, c is derefed from @b
 * @param enumerable
 */
function transduception(enumerable, {meta, sources, tags, tagHandlers, config} = {}) {
    // literal value, can't be used as origin document! inception ref should deref to a container ([] | {})
    meta = 4;
    const [inceptionNode] = enumerable;
    const ast = enumerable.metadata();


    /*
    Currently enumerable.metadata() returns result from rephs(inceptionNode)[0]
    //TODO: is it a desirable scenario to have the inception node containing multiple regex placeholders (rephs) ?
    const refList = rephs(inceptionNode);
    if (F.isReduced(refList)) {
        return [F.unreduced(refList).value];
    }
    const derefedList = F.map(operators.applyAll({meta, sources, tags, tagHandlers, context: {mediumContext: context, node: inceptionNode}, config}), refList);
    const derefed = derefedList.pop();
    */

    const derefed = operators.applyAll({meta, sources, tags, tagHandlers, context: {medium: ast.medium, node: inceptionNode}, config})(ast);
    const isForEach = derefed.operators.enumerate !== undefined;
    const flatten = derefed.operators.enumerate === '**' ? F.flatten : F.identity;

    let reduced;
    if (isForEach) {
        const viewFrom = document => template => transform(template, {meta: meta, sources, tags, tagHandlers, config})(document);
        const viewFromFns = F.map(viewFrom, derefed.value);

        reduced = flatten(F.map(template => F.map(fn => fn(template), viewFromFns), enumerable));
    } else {
        const lens = template => document => transform(template, {meta: ++meta, sources, tags, tagHandlers, config})(document);
        const lenses = F.map(lens, enumerable);
        reduced = F.pipes(...lenses)(derefed.value);
    }

    return [reduced];
}

function renderArrayNode(contextRef, {meta = 0, sources = {'default': {}}, tags = {}, tagHandlers = {}, config} = {}) {
    const NONE = {};
    const isString = x => F.isString(x) ? x : F.reduced(NONE);
    const hasReph0 = x => {
        const refList = rephs(x);
        return F.isReduced(refList) ? F.reduced(NONE) : refList[0]
    };

    const hasInception = ast => jp.value(ast, '$.operators.inception') ? ast : F.reduced(NONE);

    const partitionFn = F.composes(ast => {ast.medium = contextRef; return ast}, operators.inception, hasInception, hasReph0, isString);
    const stickyWhen = (x, _, ctx) => { ctx.n = x.$depth ? x.$depth : ctx.n; return x.$depth !== undefined};

    const partitionedGen = F.partitionBy(F.sticky(1, {when: stickyWhen, recharge: false})(partitionFn), contextRef.node);
    const lols = F.map(
        iter => iter.metadata().$depth ? transduception(iter, {meta, sources, tags, tagHandlers, config}) : iter,
        partitionedGen
    );
    return {rendered: F.flatten(lols), asts: {}}
}

const renderObjectNode = F.identity;

const transform = (template, {meta = 0, sources = {'default': {}}, tags = {}, tagHandlers = {}, config = defaultConfig} = {}) => document => {
    let counter = 1;
    let result;

    tagHandlers = {...bins.tagHandlers, ...tagHandlers};
    if (F.isString(template)) {
        ({rendered: result} = renderStringNode({node: template, path: ['$']}, {meta, sources: {...sources, origin: document}, tags, tagHandlers, config}));
    } else {
        result = traverse(template).map(function (node) {
            console.log('traverse :: ', counter++, this.path);
            const contextRef = this;
            let rendered;
            let asts;

            if (F.isFunction(node)) {
                rendered = node(document); // R.applySpec style, discouraged since it is not declarative or serializable
            } else if (F.isString(node)) {
                ({rendered, asts} = renderStringNode(contextRef, {meta, sources: {...sources, origin: document}, tags, tagHandlers, config}));
            } else if (F.isArray(node)) {
                ({rendered, asts} = renderArrayNode(contextRef, {meta, sources: {...sources, origin: document}, tags, tagHandlers, config}));
                // rendered = node;
            } else {
                // rendered = renderObjectNode(node, deref);
                rendered = node;
            }

            if (this.isRoot) return;

            if (rendered === undefined) {
                if (jp.value(config, '$.operators.constraints["?"].drop')) {
                    this.remove(true); // JSON doesn't eat undefined, drop the key and stop traversing this subtree
                } else {
                    this.update(null);
                }
            } else if (rendered === null) {
                if (jp.value(config, '$.operators.constraints["!"].nullable')) {
                    this.update(null);
                } else {
                    throw new Error(`Missing required attribute [${jp.stringify(this.path)}: ${asts ? asts[0].source : ''}]`);
                }
            } else {
                if (F.isReduced(rendered)) {
                    this.update(F.unreduced(rendered), true); // stopHere, don't traverse children
                } else {
                    this.update(rendered);
                }
            }
        });
    }
    return result;
};

module.exports = {
    transform,
    rephs,
};
