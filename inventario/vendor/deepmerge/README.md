# Local deepmerge patch

This is a local copy of `deepmerge` 4.3.1, used by Jest through an npm override.
It includes the reviewed fix from
[`cristianfloresRC/deepmerge` commit `c5ad573`](https://github.com/cristianfloresRC/deepmerge/commit/c5ad573121574db1c625b0aabcc6114ed7df6c5a):
reject `__proto__` keys when copying both target and source properties.

The package version is `4.3.2-apiadmin.0` so dependency scanners no longer match
the affected upstream range. Keep the CommonJS and UMD builds in sync with
`index.js`, and replace this copy with an official patched release when one is
published.
