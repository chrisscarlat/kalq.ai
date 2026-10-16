#!/bin/sh
# Vercel's install step. Q-Site (the engine, package.json) is a private GitHub repo, so on Vercel git fetches it over
# HTTPS with Q_SITE_GITHUB_TOKEN (a read-only fine-grained token for chrisscarlat/q-site only, set in the Vercel
# project, never in this repo). The token travels as a header, never in a URL, so no git or npm message can show it.
# Without the variable (your own machine) nothing changes: your own git login fetches it.
set -eu
if [ -n "${Q_SITE_GITHUB_TOKEN:-}" ]; then
    repo="https://github.com/chrisscarlat/q-site"
    # the lockfile may name it over ssh; there is no ssh key on Vercel, so every form goes to HTTPS
    git config --global url."$repo".insteadOf "ssh://git@github.com/chrisscarlat/q-site"
    git config --global --add url."$repo".insteadOf "git@github.com:chrisscarlat/q-site"
    git config --global --add url."$repo".insteadOf "git+ssh://git@github.com/chrisscarlat/q-site"
    auth=$(printf 'x-access-token:%s' "$Q_SITE_GITHUB_TOKEN" | base64 | tr -d '\n')
    git config --global "http.$repo.git/.extraHeader" "AUTHORIZATION: basic $auth"
    git config --global "http.$repo/.extraHeader" "AUTHORIZATION: basic $auth"
else
    echo "vercel-install: Q_SITE_GITHUB_TOKEN is not set, fetching Q-Site with the machine's own git login"
fi
npm install
