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

const deref = document => (ref, rph = rejectPlaceHolder) => {
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

function renderStringNode(node, derefPath) {
    const refs = sx.tokenize(reph(), node, [], false);
    let rendered;
    if (coll.isEmptyValue(refs)) {
        rendered = node; // string literal with no placeholders
    } else {
        const derefedPairs = coll.map(derefPath, coll.iterator(refs, {indexed: true, kv: true}));
        console.log('derefedPairs', JSON.stringify(derefedPairs, null, 0));
        console.log('node', node);
        rendered = renderString(node, derefedPairs);
    }
    return rendered;
}

function renderArrayNode(node, derefPath) {
    function sticky(n, when = true) {
        const NONE = {};
        let counter = n;
        let memory = NONE;
        let lastResult;
        // TODO: wrap hasSpreadOperator with sticky(1) what returns the previous result one more time effectively consuming one more input into the (...) partition as argument for the operator
        // WIP: https://babeljs.io/repl-old/#?babili=false&evaluate=true&lineWrap=false&presets=stage-0&targets=&browsers=&builtIns=false&debug=false&build=&circleciRepo=&code_lz=GYVwdgxgLglg9mABAZ1hA1gTwBRgDSIDuAFgKZIC8iUATiKQcGAJSIDeAUIohAqogDkA8gICiiKmwC-Abi6IANqSiIAtqVVwamCYJGi53JSoUBDVACVSyEAqiHFyxGFKErNuw-M844KKRpdAAYHGmUQGiRQSFgEbAA6RNMaAHNkVk5uI3Mod1sVKnVNbQduGGBEbDNLa3yJCiphMQz5LOdXPLtdJgSk1PTSrKKtHSoXN1rPVsQpafLK8c6ChqIyFnZp7JqPAvaJncHuXj8A3TBB2bbp-VnZjl4wfhhkUQA3cl0ADwkAPkRvgCkiAATPUqCEOPc-CoACamKCmXQAbQAjARgQQAMwEAAsBAArAQAGwEADsBAAHAQAJwEFFBAC6cge_FQMAwmDeHyobI52EJ1DoDEQzy5LA4wC0lRZKlepgU9EQcAqcIRLSOfDgSniCjgKWwvPQpE57zA2DlCtIzGYcikQA&isEnvPresetTabExpanded=false&isPresetsTabExpanded=false&isSettingsTabExpanded=true&prettier=false&showSidebar=true&version=6.26.0
        function hasSpreadOperator(element) {
            if (coll.isString(element)) {
                const refs = sx.tokenize(reph(), element, [], false);
                if (coll.isEmptyValue(refs)) {
                    return false;
                } else {
                    let [[key, [op, path]]] = coll.iterator(refs, {indexed: true, kv: true});
                    console.log('>>>>>>>>>>>>>>>>>>>', key, {op}, path);
                    let result = op === operator.spread;

                }
            } else {
                return false;
            }
        }
    }

    const partitionedGen = coll.partitionBy(hasSpreadOperator, node);
    const rendered = coll.map(iter => coll.map(coll.identity, iter), partitionedGen);
    return [];
}

const renderObjectNode = coll.identity;

function transform(template, document, {style = 'jsonpath'} = {}) {
    let counter = 1;
    const derefPath = deref(document);

    const result = traverse(template).map(function (node) {
        console.log(counter++, this.path);
        const {path, parent, key} = this;
        // console.log(`[${counter++}] : ${JSON.stringify(this.path, null, 0)}`);

        if (coll.isFunction(node)) {
            this.update(node(document)); // R.applySpec style, discouraged since it is not declarative or serializable
        } else if (coll.isArray(node)) {
            this.update(renderArrayNode(node, derefPath));
        } else if (coll.isString(node)) {
            this.update(renderStringNode(node, derefPath));
        } else {
            this.update(renderObjectNode(node));
        }
    });

    return result;
}

module.exports = {
    transform
};
