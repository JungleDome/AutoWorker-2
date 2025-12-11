module.exports = {
  root: true,
  ignorePatterns: ["dist/**", "ui/dist/**", "node_modules/**", "ui/node_modules/**"],
  overrides: [
    // Backend (Node, TypeScript)
    {
      files: ["src/**/*.{js,ts}"],
      env: {
        node: true,
        es2021: true,
      },
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
      },
      plugins: ["@typescript-eslint", "import", "prettier"],
      extends: ["airbnb-base", "plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
      rules: {
        "linebreak-style": "off",
        "import/extensions": "off",
        "import/no-unresolved": "off",
        "no-console": "off",
        "no-void": ["error", { allowAsStatement: true }],
        "no-use-before-define": "off",
        "@typescript-eslint/no-use-before-define": "off",
        "no-unused-vars": "off",
        "no-restricted-syntax": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
        "prettier/prettier": ["error", { singleQuote: false }],
      },
    },

    // Frontend (React, TypeScript)
    {
      files: ["ui/src/**/*.{js,jsx,ts,tsx}"],
      env: {
        browser: true,
        es2021: true,
      },
      parser: "@typescript-eslint/parser",
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        ecmaFeatures: {
          jsx: true,
        },
      },
      plugins: ["@typescript-eslint", "react", "react-hooks", "jsx-a11y", "import", "prettier"],
      extends: ["airbnb", "airbnb/hooks", "plugin:@typescript-eslint/recommended", "plugin:prettier/recommended"],
      settings: {
        react: {
          version: "detect",
        },
      },
      rules: {
        "linebreak-style": "off",
        "import/extensions": "off",
        "import/no-unresolved": "off",
        "react/react-in-jsx-scope": "off",
        "react/jsx-filename-extension": ["error", { extensions: [".jsx", ".tsx"] }],
        "react/jsx-props-no-spreading": "off",
        "react/require-default-props": "off",
        "quotes": ["error", "double", { avoidEscape: true }],
        "no-use-before-define": "off",
        "@typescript-eslint/no-use-before-define": ["error"],
        "no-unused-vars": "off",
        "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      },
    },
  ],
};
