Template Modifier Operators

### @meta-1 :: jsonpath deref

### @meta-2 :: operators

#### (1) query operators
- `{ {path}}` === exactly one
- `{ + {path}}` === one or more
- `{ +N {path}}` === take(N)

#### (2) constraint operators

- `{ ? {path}}` === optional, drop if empty
- `{ ?=default {path}}` === if empty, lookup in defaults, if empty, drop
- `{ ?=default:VALUE {path}}` === if empty, use VALUE as default value

- `{ ! {path}}` === required, error (null) if empty
- `{ !=altSource {path}}` === if empty, lookup in altSource, if empty, null
- `{ !=altSource:VALUE {path}}` === if empty, lookup in altSource, if empty, use VALUE as default value

#### (3) symbol operators
#### (4) enumerate operators
#### (5) inception operators