/**
 * lambda
 * application
 *
 */

/*
- application (rator, rand)

{..{enumerable}}
==
apply(enumerate, enumerable) ? what syntax
1) enumerate(enumerable)
would look like this
{
  key: enumerate({
    x: 1,
    y: 2
  })
}
or
{
  key: enumerate([
    1,
    2
  ])
}

we still need to fit PIPEing somehow
alsow this should still be declarative, so enumerate is text not a fn reference, what syntax would tag it for next phase?
- CONS: the expanded rand is not json anymore, it is a string, which is not formatable or post-processable

alternatively, use the () application from lisp, scheme, clojure, but use [] as json array to represent it
example:
document = { pictures: [
       {
           view: 'front',
           images: [{big: 'http://example.com/products/123_front.jpg'}, {thumbnail: 'http://example.com/products/123_front_small.jpg'}]
       },
       {
           view: 'rear',
           images: [{big: 'http://example.com/products/123_rear.jpg'}, {thumbnail: 'http://example.com/products/123_rear_small.jpg'}]
       },
       {
           view: 'side',
           images: [{big: 'http://example.com/products/123_left_side.jpg'}, {thumbnail: 'http://example.com/products/123_left_side_small.jpg'}]
       }
   ]
}

template = {
   thumbnails: [
     '{...{pictures}*}', // we need to separate the concepts of .N meta lavels from destructuring (iterator(o)) by using }*} == enumerate
     { // <- for each picture
       label: '{{view}}',
       count: '{{images.length}}',
       images: '{{images}}' // <- this is happening too often, es6 shorthand would be nice
     },
     { // <-- for each result {label, count, images}
       '{...{images}}',
       '{..{$}}', // 1) destructure
       '{[KEY, VALUE]}' // <- here we need bind destrucred [value, key], what is a fitting syntax, extended angular input parameters []
       {
         page: '{{@index}}/{{count}}'
         label: '{{label}} / size: {{KEY}}',
         url: '{{VALUE}}'
       }

     }

}


eval rator
eval rand


*/
