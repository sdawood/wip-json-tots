// see: https://github.com/teemualap/atoms
// see: https://github.com/cjohansen/js-atom

const {ValidationError} = require('./errors');

function Atom(x, validator = () => true) {
    if(!(this instanceof Atom)) {
        return new Atom(x);
    }
    this.val = x;
    this.validator = validator;
    this['@@version'] = 0;
}

Atom.prototype['@@type'] = 'ramda-fantasy/Atom';

/**
 * Applicative specification. Creates a new `Atom[a]` holding the value `a`.
 * @param {*} a Value of any type
 * @returns Atom[a]
 * @sig a -> Atom[a]
 */
Atom.of = function(x) {
    return new Atom(x);
};
Atom.prototype.of = Atom.of;

/**
 * Functor specification. Creates a new `Atom[a]` mapping function `fn` onto
 * `a` returning any value b.
 * @param {Function} fn Maps `a` to any value `b`
 * @returns Atom[b]
 * @sig @Atom[a] => (a -> b) -> Atom[b]
 */
Atom.prototype.map = function(fn) {
    return new Atom(fn(this.val));
};

/**
 * Apply specification. Applies the function inside the `Atom[a]`
 * type to another applicative type.
 * @param {Applicative[a]} app Applicative that will apply its function
 * @returns Applicative[b]
 * @sig (Atom[a -> b], fn: Applicative[_]) => fn[a] -> fn[b]
 */
Atom.prototype.ap = function(app) {
    return app.map(this.val);
};

/**
 * Chain specification. Transforms the value of the `Atom[a]`
 * type using an unary function to monads. The `Atom[a]` type
 * should contain a function, otherwise an error is thrown.
 *
 * @param {Function} fn Transforms `a` into a `Monad[b]`
 * @returns Monad[b]
 * @sig (Atom[a], m: Monad[_]) => (a -> m[b]) -> m[b]
 */
Atom.prototype.chain = function(fn) {
    return fn(this.val);
};

// chainRec
Atom.chainRec = Atom.prototype.chainRec = function(fn, i) {
    let state = chainRecNext(i);
    while (state.isNext) {
        state = fn(chainRecNext, chainRecDone, state.value).get();
    }
    return Atom(state.value);
};

/**
 * Returns the value of `Atom[a]`
 *
 * @returns a
 * @sig (Atom[a]) => a
 */
Atom.prototype['@'] = Atom.prototype.deref = Atom.prototype.get = function() {
    return this.val;
};

Atom.prototype.swap = function(fn, ...args) {
    return transact(this, fn(this.val, ...args));
};

/**
 * compare-and-set
 * @param fn
 * @param args
 */
Atom.prototype.cas = function(expectedVal, newVal) {
    if(atom.val !== expectedVal) return false;// throw new ValidationError(`[${expectedVal}] failed validation!`, 'compare-and-set');
    transact(this, newVal);
    return true;
};

/**
 * compare-version-[and]-set
 * @param fn
 * @param args
 */
Atom.prototype.cvs = function(expectedVersion, newVal) {
    if(atom['@@version'] !== expectedVersion) return false;// throw new ValidationError(`[${expectedVal}] failed validation!`, 'compare-and-set');
    transact(this, newVal);
    return true;
};


Atom.prototype.reset = function(newVal) {
    return transact(this, newVal);
};

Object.defineProperty(Atom.prototype, 'value', {
    get: Atom.prototype.deref,
    set: Atom.prototype.reset
});

// equality method to enable testing
Atom.prototype.equals = function (that) {
    return that instanceof Atom && (this.val == that.val);
};

Atom.prototype.toString = function() {
    return `Atom(${this.val})`;
};

function transact(atom, newVal) {
    if(!atom.validator(newVal)) throw new ValidationError(`[${newVal}] failed validation!`, atom.validator.name); // throw an error since return value from the `value` setter is ignored. what about validating current version?
    const oldVal = atom.val;
    atom.val = newVal;
    atom['@@version'] += 1;
    // notifyWatchers(oldVal, newVal);
    return atom.val;
}

function chainRecNext(v) {
    return { isNext: true, value: v };
}

function chainRecDone(v) {
    return { isNext: false, value: v };
}

module.exports = Atom;