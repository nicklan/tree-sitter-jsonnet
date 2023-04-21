[
 "assert"
 "else"
 "error"
 (false)
 "for"
 "if"
 "import"
 "importstr"
 "importbin"
 "in"
 "local"
 (null)
 (outer)
 "tailstrict"
 "then"
 (self)
 "super"
 (true)
] @keyword

"function" @function

(bind
 function_name: (id) @function)

(fieldname) @constant

(value) @variable

(hsep) @property

(number) @number

(string) @string

(line_comment) @comment

(block_comment) @comment

(function_application
 function_name: (id) @function)

(bind
 (id) @constant)

(index
 indexobj: (_) @variable.builtin)
