The JS files can be mangled for smaller file size.

- uglify args

        uglifyjs -m --module --mangle-props 'regex=/^[#_]/' --

- Compression was not used in order to preserve the code as it was written.

- Mangle-able properties are prefixed with `#` for class-private properties, `_` for module-internal properties.
