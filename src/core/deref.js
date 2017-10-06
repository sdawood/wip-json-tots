const __ = {'@@functional/placeholder': true};
const _is__ = a => a != null && typeof a === 'object' && a['@@functional/placeholder'] === true;

const withOneSlot = fn => (...args) => {
    const slots = args.reduce((acc, a, index) => {
        if (_is__(a)) acc['__1'] = index;
        return acc;
    }, {});
    return (coin) => {
        args[slots['__1']] = coin;
        return fn(...args)
    };
};

module.exports = {
    __,
    withOneSlot,
    oneslot: withOneSlot
};
