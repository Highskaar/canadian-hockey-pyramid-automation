# Canadian Hockey Pyramid Automation

Public automation repository for browser-based testing and deployment verification of Canadian Hockey Pyramid (CHP) and Canadian Hockey Pyramid Century Challenge (CHPCC).

## Purpose

This repository contains reviewed Playwright tests, safe deterministic fixtures, test helpers, package manifests, and GitHub Actions workflows.

The tests target exact Cloudflare preview or production URLs supplied to the workflows. This repository does not contain the CHP or CHPCC application source.

## Repository boundaries

This public repository must never contain:

- CHP or CHPCC application source
- complete playable builds
- transport ZIP or TXT archives
- real player save files
- personal information
- SSH keys
- API tokens or passwords
- Cloudflare credentials
- copied history from private or experimental repositories
- unsanitized screenshots, traces, videos, or diagnostic state

Application source remains in the private authoritative repositories.

## Planned test layers

- Fast smoke tests for every unique Cloudflare preview
- Broader release-candidate tests before production approval
- Small non-destructive production smoke tests
- Nightly rotating durability, persistence, and invariant tests
- Weekly selected deep-history, boundary, and performance tests

Scheduled tests should reuse an existing exact preview deployment and must not create unnecessary Cloudflare builds.
