Template Modifier Operators

### Meta-1 :: jsonpath deref
- {?{path}} === optional, drop if empty
- {!{path}} === required, error (how) if empty
- {+N{path}} === one or more, optimize by passing N to jp.query(obj, pathExpression[, count]) , can be mixed with the above

given the above, [?|!] are combinable with +[N] <- N is optional, missing means all