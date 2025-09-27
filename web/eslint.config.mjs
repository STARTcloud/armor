import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import pluginImport from "eslint-plugin-import";
import pluginJsxA11y from "eslint-plugin-jsx-a11y";
import prettierPlugin from "eslint-plugin-prettier";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
  // Ignore patterns
  {
    ignores: [
      "node_modules/**/*",
      "dist/**/*",
      "build/**/*",
      "coverage/**/*",
      "*.min.js",
      ".next/**/*",
      ".vite/**/*",
      "public/**/*",
      "*.log",
    ],
  },

  // JavaScript and JSX files configuration - Comprehensive React Frontend Rules
  {
    files: ["**/*.{js,mjs,cjs,jsx}"],
    plugins: {
      react: pluginReact,
      "react-hooks": pluginReactHooks,
      "jsx-a11y": pluginJsxA11y,
      import: pluginImport,
      prettier: prettierPlugin,
    },
    languageOptions: {
      ecmaVersion: 2024, // Latest ECMAScript version
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.es2021,
        // Vite global variables
        __APP_NAME__: "readonly",
        __APP_VERSION__: "readonly",
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },
    settings: {
      react: {
        version: "detect",
      },
      "import/resolver": {
        node: {
          extensions: [".js", ".jsx"],
          moduleDirectory: ["node_modules", "src/"],
        },
      },
    },
    rules: {
      // Base JavaScript rules (comprehensive)
      ...js.configs.recommended.rules,

      // React rules (comprehensive)
      ...pluginReact.configs.recommended.rules,
      ...pluginReactHooks.configs.recommended.rules,
      ...pluginJsxA11y.configs.recommended.rules,
      ...pluginImport.configs.recommended.rules,

      // Prettier rules
      ...prettierConfig.rules,
      "prettier/prettier": "error",

      // === VARIABLES & DECLARATIONS ===
      "prefer-const": "error",
      "no-var": "error",
      "no-undef": "error",
      "no-unused-vars": [
        "warn", // Warn for declared but unused variables
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
          caughtErrors: "none", // Don't warn about unused catch parameters
        },
      ],
      "no-use-before-define": [
        "error",
        { functions: false, classes: true, variables: true },
      ],
      "no-shadow": "error",
      "no-shadow-restricted-names": "error",
      "no-redeclare": "error",

      // === FUNCTIONS ===
      "func-style": ["error", "expression", { allowArrowFunctions: true }],
      "prefer-arrow-callback": "error",
      "arrow-body-style": ["error", "as-needed"],
      "no-loop-func": "error",
      "no-new-func": "error",
      "default-param-last": "error",
      "no-param-reassign": ["error", { props: false }],

      // === OBJECTS & ARRAYS ===
      "object-shorthand": ["error", "always"],
      "prefer-destructuring": ["error", { array: true, object: true }],
      "no-array-constructor": "error",
      "array-callback-return": ["error", { allowImplicit: true }],
      "prefer-spread": "error",
      "prefer-rest-params": "error",

      // === STRINGS & TEMPLATES ===
      "prefer-template": "error",
      "no-useless-escape": "error",
      "no-useless-concat": "error",

      // === COMPARISON & CONDITIONALS ===
      eqeqeq: ["error", "always"],
      "no-nested-ternary": "warn",
      "no-unneeded-ternary": "error",
      "no-else-return": "error",
      "consistent-return": "error",

      // === ERROR HANDLING ===
      "no-throw-literal": "error",
      "prefer-promise-reject-errors": "error",

      // === ASYNC/AWAIT & PROMISES ===
      "require-await": "error",
      "no-await-in-loop": "warn",
      "no-async-promise-executor": "error",
      "no-promise-executor-return": "error",

      // === MODULES ===
      "no-duplicate-imports": "error",
      "no-useless-rename": "error",

      // === SECURITY & BEST PRACTICES ===
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-script-url": "error",
      "no-caller": "error",
      "no-iterator": "error",
      "no-proto": "error",
      "no-extend-native": "error",
      "no-global-assign": "error",

      // === BROWSER SPECIFIC ===
      "no-alert": "warn", // Allow alerts but warn in browser code
      "no-console": "off", // Allow console statements in frontend development (build tools strip them)

      // === CODE QUALITY ===
      complexity: ["warn", 30], // Increased for complex React components
      "max-depth": ["warn", 6], // Increased for complex UI logic
      "max-params": ["warn", 8], // Increased for React components with many props
      // File and function size limits removed per user request

      // === NAMING CONVENTIONS ===
      camelcase: "off", // Allow snake_case (user preference)
      "new-cap": ["error", { newIsCap: true, capIsNew: false }],

      // === PERFORMANCE ===
      "no-lonely-if": "error",
      "no-useless-call": "error",
      "no-useless-return": "error",
      "no-useless-constructor": "error",

      // === MODERN JAVASCRIPT ===
      "prefer-object-spread": "error",
      "prefer-exponentiation-operator": "error",
      "prefer-numeric-literals": "error",
      "prefer-object-has-own": "error",

      // === STYLE (handled by Prettier, but keep logical ones) ===
      curly: ["error", "all"],
      "dot-notation": "error",
      "no-multi-assign": "error",
      "one-var": ["error", "never"],

      // === REGEX ===
      "prefer-named-capture-group": "warn",
      "prefer-regex-literals": "error",
      "no-useless-backreference": "error",

      // === UNICODE & SPECIAL CHARACTERS ===
      "unicode-bom": ["error", "never"],
      "no-irregular-whitespace": "error",

      // === REACT SPECIFIC RULES (Enhanced) ===
      "react/react-in-jsx-scope": "off", // Not needed in React 17+
      "react/prop-types": "warn", // Warn instead of error
      "react/display-name": "warn",
      "react/no-unused-prop-types": "warn",
      "react/no-unused-state": "warn",
      "react/prefer-stateless-function": "warn",
      "react/self-closing-comp": "error",
      "react/jsx-boolean-value": ["error", "never"],
      "react/jsx-closing-bracket-location": "error",
      "react/jsx-closing-tag-location": "error",
      "react/jsx-curly-spacing": ["error", "never"],
      "react/jsx-equals-spacing": ["error", "never"],
      "react/jsx-first-prop-new-line": ["error", "multiline-multiprop"],
      "react/jsx-indent-props": ["error", 2],
      "react/jsx-max-props-per-line": [
        "error",
        { maximum: 1, when: "multiline" },
      ],
      "react/jsx-no-duplicate-props": "error",
      "react/jsx-no-undef": "error",
      "react/jsx-pascal-case": "error",
      "react/jsx-uses-react": "off", // Not needed in React 17+
      "react/jsx-uses-vars": "error",
      "react/jsx-wrap-multilines": [
        "error",
        {
          declaration: "parens-new-line",
          assignment: "parens-new-line",
          return: "parens-new-line",
          arrow: "parens-new-line",
          condition: "parens-new-line",
          logical: "parens-new-line",
          prop: "parens-new-line",
        },
      ],
      "react/no-array-index-key": "warn",
      "react/no-danger": "warn",
      "react/no-did-mount-set-state": "error",
      "react/no-did-update-set-state": "error",
      "react/no-direct-mutation-state": "error",
      "react/no-multi-comp": ["warn", { ignoreStateless: true }],
      "react/no-string-refs": "error",
      "react/no-unknown-property": "error",
      "react/prefer-es6-class": "error",
      "react/require-render-return": "error",

      // === REACT HOOKS RULES ===
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",

      // === ACCESSIBILITY RULES (jsx-a11y) - Practical for Bulma CSS ===
      "jsx-a11y/alt-text": "warn",
      "jsx-a11y/aria-props": "error",
      "jsx-a11y/aria-proptypes": "error",
      "jsx-a11y/aria-unsupported-elements": "error",
      "jsx-a11y/role-has-required-aria-props": "error",
      "jsx-a11y/role-supports-aria-props": "error",
      "jsx-a11y/img-redundant-alt": "warn",
      "jsx-a11y/no-access-key": "warn",
      "jsx-a11y/no-onchange": "off", // Can be overly restrictive
      "jsx-a11y/click-events-have-key-events": "warn",
      "jsx-a11y/no-static-element-interactions": "warn",
      "jsx-a11y/anchor-is-valid": "warn",
      "jsx-a11y/label-has-associated-control": "warn", // Warn instead of error for Bulma patterns

      // === IMPORT/EXPORT RULES ===
      "import/order": [
        "error",
        {
          groups: [
            "builtin", // Node.js built-in modules
            "external", // npm packages
            "internal", // internal modules
            "parent", // parent modules
            "sibling", // sibling modules
            "index", // index modules
          ],
          "newlines-between": "always",
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
      "import/first": "error",
      "import/no-amd": "error",
      "import/no-webpack-loader-syntax": "error",
      "import/no-unresolved": ["error", { commonjs: true }],
      "import/named": "error",
      "import/default": "error",
      "import/namespace": "error",
      "import/no-absolute-path": "error",
      "import/no-dynamic-require": "warn",
      "import/no-self-import": "error",
      "import/no-cycle": ["error", { maxDepth: 10 }],
      "import/no-useless-path-segments": "error",
      "import/no-relative-parent-imports": "off", // Allow relative imports
      "import/newline-after-import": "error",
      "import/no-duplicates": "error",

      // === RESTRICTED IMPORTS ===
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../../**/node_modules/**"],
              message: "Do not import from nested node_modules directories.",
            },
          ],
          paths: [
            {
              name: "lodash",
              message:
                "Please use lodash-es or import individual functions instead.",
            },
          ],
        },
      ],
    },
  },

  // Vite configuration files - Special handling
  {
    files: ["**/vite.config.js", "**/vite.config.mjs"],
    rules: {
      "no-undef": "off", // Allow import assertions and special Vite syntax
      "import/no-unresolved": "off", // Vite handles special imports
    },
  },

  // Configuration files (JSON, etc.) - Minimal rules
  {
    files: ["**/*.{json,jsonc,json5}"],
    rules: {
      "no-unused-vars": "off",
      "no-undef": "off",
    },
  },

  // Test files configuration
  {
    files: [
      "**/*.test.{js,jsx}",
      "**/*.spec.{js,jsx}",
      "**/test/**/*.{js,jsx}",
      "**/tests/**/*.{js,jsx}",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.jest,
        describe: "readonly",
        it: "readonly",
        expect: "readonly",
        test: "readonly",
        beforeEach: "readonly",
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
      },
    },
    rules: {
      // Relax rules for test files
      "no-console": "off",
      "no-unused-expressions": "off",
      "max-lines": "off",
      "max-lines-per-function": "off",
      complexity: "off",
      "prefer-arrow-callback": "off",
      "func-style": "off",
      "react/display-name": "off",
      "react/prop-types": "off",
    },
  },
];
